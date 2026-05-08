export const config = {
  runtime: 'edge',
};

const API_URL = 'https://hsk-gilt.vercel.app/api/gRecorder';

export default async function handler(req, context) {
  try {
    const fullUrl = new URL(req.url);
    const text = (fullUrl.searchParams.get('text') || '你好').trim();
    const lang = fullUrl.searchParams.get('lang') || 'ja-JP';
    const voice = fullUrl.searchParams.get('voice') || 'ja-JP-KeitaNeural';
    const rate = fullUrl.searchParams.get('rate') || '1.0';
    const format = fullUrl.searchParams.get('format') || 'audio-16khz-32kbitrate-mono-mp3';

    const filename = `${voice}_${rate}_${text}`;
    context.waitUntil(writeLog("TTS", `Text2Speed: ${text}`));

    // 1️⃣ CHECK DRIVE CACHE
    try {
      const cachedResponse = await checkDriveCache(filename, context);
      if (cachedResponse) return cachedResponse;
    } catch (e) {
      console.warn("[Drive Check Error]", e.message);
    }

	context.waitUntil(writeLog("TTS", `Bắt đầu gọi TTS để lấy audio`));
    // 2️⃣ AZURE TTS
    const azureResponse = await fetchAzureTTS(text, lang, voice, rate, format, context);
    if (!azureResponse.body) {
      return new Response("Azure Body Empty", { status: 500 });
    }

	context.waitUntil(writeLog("TTS", `Convert audio to Base64`));
    // Chuyển đổi để lưu Drive nhưng vẫn trả về stream cho Client
    const arrayBuffer = await azureResponse.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
	context.waitUntil(writeLog("TTS", `Bắt đầu lưu audio tới Driver`));
    let binary = '';
    uint8Array.forEach(b => binary += String.fromCharCode(b));
    const base64Data = btoa(binary);

    // 3️⃣ SAVE TO DRIVE (Chạy ngầm)
    context.waitUntil(uploadToDrive(base64Data, filename, context));

    // 4️⃣ PHẢN HỒI STREAMING
    //context.waitUntil(writeLog("TTS", `⚡ AZURE COMPLETED`));
    
    return new Response(arrayBuffer, {
      headers: { 
        'Content-Type': 'audio/mpeg', 
        'X-Audio-Source': 'Azure-TTS-Streaming'
      }
    });

  } catch (e) {
    context.waitUntil(writeLog("TTS", `[Fatal Error]: ${e.message}`));
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

/**
 * Hàm kiểm tra file trên Drive và trả về Response Streaming
 */
/**
 * Hàm kiểm tra file trên Drive và trả về Response Streaming
 */
async function checkDriveCache(filename, context) {
  try {
    context.waitUntil(writeLog("TTS", `Checking Drive Cache: ${filename}`));

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: "check", 
        name: filename 
      })
    });

    // Kiểm tra nếu API trả về stream audio thành công
    const contentType = response.headers.get('content-type');
    
    if (response.ok && contentType && contentType.includes('audio/')) {
      context.waitUntil(writeLog("TTS", `⚡ Đã tồn tại trong driver: Streaming started.`));
      
      return new Response(response.body, {
        headers: {
          'Content-Type': contentType,
          'X-Audio-Source': 'Google-Drive-Direct-Streaming',
          'Cache-Control': 'public, max-age=31536000, immutable',
          // Giữ nguyên độ dài file nếu có
          ...(response.headers.get('content-length') && { 
            'Content-Length': response.headers.get('content-length') 
          })
        }
      });
    }

    // Nếu không phải audio, có thể là lỗi 404 hoặc JSON báo lỗi
    const errorData = response.status !== 200 ? await response.text() : "Not an audio stream";
    console.warn(`[Drive Cache] status: ${response.status}, info: ${errorData}`);

  } catch (e) {
    context.waitUntil(writeLog("TTS", `Cache Stream Error: ${e.message}`));
  }

  context.waitUntil(writeLog("TTS", `🐢 DRIVE CACHE MISS: Moving to Azure TTS`));    
  return null; 
}
/**
 * Hàm gọi Azure TTS API
 */
async function fetchAzureTTS(text, lang, voice, rate, format, context) {
  console.log("GOI MAY LAN O DAY");
  const endpoint = process.env.AZURE_TTS_ENDPOINT;
  const key = process.env.AZURE_TTS_KEY;
  const ttsUrl = `${endpoint.replace(/\/$/, '')}/cognitiveservices/v1`;
  const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}"><prosody rate="${rate}">${text.replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]))}</prosody></voice></speak>`;

  const res = await fetch(ttsUrl, {
    method: 'POST',
    headers: { 
      'Ocp-Apim-Subscription-Key': key, 
      'Content-Type': 'application/ssml+xml', 
      'X-Microsoft-OutputFormat': format 
    },
    body: ssml
  });

  if (!res.ok) {
    context.waitUntil(writeLog("TTS", `Azure Error Status: ${res.status}`));
    throw new Error(`Azure TTS Failed: ${res.status}`);
  }
  return res;
}

/**
 * Hàm upload file lên Drive bằng Base64
 */
 // uploadAudioTTS(gRecorder) -> upload_record(GAS)
async function uploadToDrive(base64Data, filename, context) {
  try {
    context.waitUntil(writeLog("TTS", `🚀 Uploading to Drive (${base64Data.length} chars)`));
    
    const resAPI =await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: "uploadAudioTTS", 
        name: filename, 
        base64: base64Data 
      })
    });
	const result = await resAPI.json();
	console.log(result);
    context.waitUntil(writeLog("TTS", "✅ SAVED DRIVE FILE "));
  } catch (e) {
    context.waitUntil(writeLog("TTS", `[SAVE ERROR]: ${e.message}`));
  }
}

/**
 * Hàm ghi log vào GSheet
 */
async function writeLog(type, message) {
  console.log(message);
  /*
  const time = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false }).replace(/\//g, "-").replace(/ /g, "-");
  const url = "https://hsk-gilt.vercel.app/api/gSheet";
  const rowData = [time, type, message];
  const paramsObj = { 
    act: 'add', 
    sheet: 'Logs', 
    spread: '1g2COnzVdo8SlqJVq5osT5hfNVfdTsXqzYp0bN1S8ZIc', 
    data: JSON.stringify(rowData) 
  };
				
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paramsObj)
    });
  } catch (e) {
    console.error("Log to GSheet failed", e);
  }
  */
}
