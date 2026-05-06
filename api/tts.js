export const config = {
  runtime: 'edge',
};

export default async function handler(req, context) {
  const startTime = Date.now();
  const GAS_URL = process.env.GAS_URL || 'https://script.google.com/macros/s/AKfycbxUcnkzBAkguAxlZx3Z3R6dcaYapY46FeXAjxqfrweqPFiBsiUvShZp-BnfPyEpzf0/exec';

  try {
    const fullUrl = new URL(req.url);
    const text = (fullUrl.searchParams.get('text') || '你好').trim();
    const lang = fullUrl.searchParams.get('lang') || 'ja-JP';
    const voice = fullUrl.searchParams.get('voice') || 'ja-JP-KeitaNeural';
    const rate = fullUrl.searchParams.get('rate') || '1.0';
    const format = fullUrl.searchParams.get('format') || 'audio-16khz-32kbitrate-mono-mp3';

    const filename = `${voice}_${rate}_${text}`;
    context.waitUntil(writeLog("TTS", `=== NEW REQ: ${text} ===`));

    // 1️⃣ CHECK DRIVE & TRẢ FILE (Sửa lỗi CORS do redirect)
    try {
      const checkRes = await fetch(`${GAS_URL}?action=check&filename=${encodeURIComponent(filename)}`);
      const contentType = checkRes.headers.get('content-type');

      if (checkRes.ok && contentType?.includes('application/json')) {
        const checkData = await checkRes.json();
        const returnedName = checkData.filename ? checkData.filename.replace('.mp3', '').trim() : '';

        if (checkData.exists && returnedName === filename && checkData.directLink) {
          context.waitUntil(writeLog("TTS", "[CACHE HIT] Proxying from Drive..."));
          
          // Tuyệt đối không Response.redirect nữa để tránh lỗi CORS
          const driveFileRes = await fetch(checkData.directLink);
          if (driveFileRes.ok) {
            context.waitUntil(writeLog("TTS", `⚡ DRIVE SUCCESS: ${Date.now() - startTime}ms`));
            return new Response(driveFileRes.body, {
              headers: { 
                'Content-Type': 'audio/mpeg',
                'X-Audio-Source': 'Google-Drive-Cache'
              }
            });
          }
        }
      }
    } catch (e) { console.warn("[Drive Check/Proxy Error]", e.message); }

    // 2️⃣ AZURE TTS
    const endpoint = process.env.AZURE_TTS_ENDPOINT;
    const key = process.env.AZURE_TTS_KEY;
    
    // Chuẩn hóa URL an toàn
    const ttsUrl = `${endpoint.replace(/\/$/, '')}/cognitiveservices/v1`;
    const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}"><prosody rate="${rate}">${text.replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]))}</prosody></voice></speak>`;

    const azureResponse = await fetch(ttsUrl, {
      method: 'POST',
      headers: { 
        'Ocp-Apim-Subscription-Key': key, 
        'Content-Type': 'application/ssml+xml', 
        'X-Microsoft-OutputFormat': format 
      },
      body: ssml
    });

    if (!azureResponse.ok || !azureResponse.body) {
      context.waitUntil(writeLog("ERROR", `Azure Error Status: ${azureResponse.status}`));
      return new Response("Azure Failed", { status: 500 });
    }

    // Nhân đôi luồng dữ liệu
    const [clientStream, saveStream] = azureResponse.body.tee();

    // 3️⃣ SAVE TO DRIVE (Chuyển sang dùng Base64 để chống sập RAM Edge 500)
    const saveTask = (async () => {
      try {
        const reader = saveStream.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        const audioBuffer = new Uint8Array(await new Blob(chunks).arrayBuffer());
        context.waitUntil(writeLog("TTS", `🚀 Uploading to Drive (${audioBuffer.byteLength} bytes)`));
        
        // Tối ưu hóa chuyển Base64 theo từng cụm để tránh lỗi Maximum call stack size exceeded
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < audioBuffer.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, audioBuffer.subarray(i, i + chunkSize));
        }
        const base64Data = btoa(binary);

        await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: "upload", 
            filename: filename, 
            fileDataBase64: base64Data // Truyền bằng chuỗi Base64
          })
        });
        context.waitUntil(writeLog("TTS", `✅ SAVED DRIVE: ${Date.now() - startTime}ms`));
      } catch (e) { context.waitUntil(writeLog("ERROR", `[SAVE ERROR]: ${e.message}`)); }
    })();

    context.waitUntil(saveTask);

    // 4️⃣ PHẢN HỒI STREAMING
    context.waitUntil(writeLog("TTS", `⚡ STREAMING START: ${Date.now() - startTime}ms`));
    
    return new Response(clientStream, {
      headers: { 
        'Content-Type': 'audio/mpeg', 
        'X-Audio-Source': 'Azure-Streaming',
        'Transfer-Encoding': 'chunked' 
      }
    });

  } catch (e) {
    context.waitUntil(writeLog("FATAL", `[Fatal Error]: ${e.message}`));
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

async function writeLog(type, message) {
  // Định dạng: 2026-5-5-1:49:42 (Múi giờ Tokyo)
  const time = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false }).replace(/\//g, "-").replace(/ /g, "-");
  const url = "https://hsk-gilt.vercel.app/api/gSheet";
  
  
  const rowData = [time, type, message];

  const paramsObj = { act: 'add', sheet: 'Logs', spread: '1g2COnzVdo8SlqJVq5osT5hfNVfdTsXqzYp0bN1S8ZIc', data: JSON.stringify(rowData) };


				
  try {
   		
 const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(paramsObj)
                });
  } catch (e) {
    // Chỉ log console nếu log tới server thất bại để tránh vòng lặp vô tận
    console.error("Log to GSheet failed", e);
  }
}