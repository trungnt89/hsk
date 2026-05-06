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
    writeLog(`\n=== [NEW REQUEST: ${text}] ===`);

    // 1️⃣ CHECK DRIVE & TRẢ FILE (Sửa lỗi CORS do redirect)
    try {
      const checkRes = await fetch(`${GAS_URL}?action=check&filename=${encodeURIComponent(filename)}`);
      const contentType = checkRes.headers.get('content-type');

      if (checkRes.ok && contentType?.includes('application/json')) {
        const checkData = await checkRes.json();
        const returnedName = checkData.filename ? checkData.filename.replace('.mp3', '').trim() : '';

        if (checkData.exists && returnedName === filename && checkData.directLink) {
          writeLog(`[TTS] 🎯 CACHE HIT! Đang proxy file từ Drive thay vì redirect...`);
          
          // Tuyệt đối không Response.redirect nữa để tránh lỗi CORS
          const driveFileRes = await fetch(checkData.directLink);
          if (driveFileRes.ok) {
            writeLog(`[TTS] ⚡ Lấy file từ Drive thành công lúc: ${Date.now() - startTime}ms`);
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
      writeLog(`[Azure Error] Status: ${azureResponse.status}`);
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
        writeLog(`[TTS] 🚀 Uploading to Drive... (${audioBuffer.byteLength} bytes)`);
        
        // Chuyển đổi sang Base64 thay vì Array.from truyền thống gây nặng RAM
        const base64Data = btoa(String.fromCharCode.apply(null, audioBuffer));

        await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: "upload", 
            filename: filename, 
            fileDataBase64: base64Data // Truyền bằng chuỗi Base64
          })
        });
        writeLog(`[TTS] ✅ Lưu Drive XONG lúc: ${Date.now() - startTime}ms`);
      } catch (e) { writeLog(`[SAVE ERROR]: ${e.message}`); }
    })();

    context.waitUntil(saveTask);

    // 4️⃣ PHẢN HỒI STREAMING
    writeLog(`[TTS] ⚡ BẮT ĐẦU STREAM CHO CLIENT LÚC: ${Date.now() - startTime}ms`);
    
    return new Response(clientStream, {
      headers: { 
        'Content-Type': 'audio/mpeg', 
        'X-Audio-Source': 'Azure-Streaming',
        'Transfer-Encoding': 'chunked' 
      }
    });

  } catch (e) {
    writeLog("[Fatal Error]", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

function writeLog(message) {
    util.writeLog(message, "SHEET");
}