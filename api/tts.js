export const config = {
  runtime: 'edge',
};

const API_URL = 'https://hsk-gilt.vercel.app/api/gRecorder';

export default async function handler(req, context) {
  try {
    const { searchParams } = new URL(req.url);
    if (req.url.includes('favicon.ico')) return new Response(null, { status: 204 });

    const text = (searchParams.get('text') || '你好').trim();
    const lang = searchParams.get('lang') || 'ja-JP';
    const voice = searchParams.get('voice') || 'ja-JP-KeitaNeural';
    const rate = searchParams.get('rate') || '1.0';
    const format = searchParams.get('format') || 'audio-16khz-32kbitrate-mono-mp3';

    const safeText = text
      .replace(/[\r\n]+/g, ' ')
      .replace(/[^\w\s\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/gi, '')
      .trim()
      .substring(0, 20);

    const filename = `TTS_${voice}_${rate}_${safeText}.mp3`;
    context.waitUntil(writeLog("TTS", `Request: ${filename}`));

    // 1️⃣ CHECK DRIVE CACHE
    try {
      const cached = await checkDriveCache(filename, context);
      if (cached) return cached;
    } catch (e) {
      console.warn("Cache Error", e.message);
    }

    // 2️⃣ AZURE TTS
    context.waitUntil(writeLog("TTS", `Chưa có file, gọi Azure TTS: ${filename}`));
    const azureRes = await fetchAzureTTS(text, lang, voice, rate, format, context);
    const arrayBuffer = await azureRes.arrayBuffer();

    // 3️⃣ SAVE TO DRIVE (Chạy ngầm - Đã sửa lỗi Stack Size)
    context.waitUntil((async () => {
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64 = btoa(binary);
      await uploadToDrive(base64, filename, context);
    })());

    return new Response(arrayBuffer, {
      headers: { 
        'Content-Type': 'audio/mpeg', 
        'X-Audio-Source': 'Azure-Streaming' 
      }
    });

  } catch (e) {
    context.waitUntil(writeLog("TTS", `Error: ${e.message}`));
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

async function checkDriveCache(filename, context) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: "check", name: filename })
  });

  const contentType = res.headers.get('content-type');
  if (res.ok && contentType?.includes('audio/')) {
    context.waitUntil(writeLog("TTS", `HIT Driver: ${filename}`));
    return new Response(res.body, {
      headers: {
        'Content-Type': contentType,
        'X-Audio-Source': 'Drive-Cache',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  }
  return null;
}

async function fetchAzureTTS(text, lang, voice, rate, format, context) {
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

  if (!res.ok) throw new Error(`Azure status: ${res.status}`);
  return res;
}

async function uploadToDrive(base64, filename, context) {
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: "uploadAudioTTS", name: filename, base64 })
    });
    context.waitUntil(writeLog("TTS", `SAVED Driver: ${filename}`));
  } catch (e) {
    console.error("Upload failed", e.message);
  }
}

async function writeLog(type, message) {
  console.log(`[${type}] ${message}`);
  const time = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  try {
    await fetch("https://hsk-gilt.vercel.app/api/gSheet", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        act: 'add',
        sheet: 'Logs',
        spread: '1g2COnzVdo8SlqJVq5osT5hfNVfdTsXqzYp0bN1S8ZIc',
        data: JSON.stringify([time, type, message])
      })
    });
  } catch (e) {
    console.error("Log failed");
  }
}