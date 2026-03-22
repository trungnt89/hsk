export const config = {
  runtime: 'edge',
};

export default async function handler(req, context) {
  try {
    const fullUrl = new URL(req.url);
    const text = fullUrl.searchParams.get('text') || '你好';
    const lang = fullUrl.searchParams.get('lang') || 'ja-JP';
    const voice = fullUrl.searchParams.get('voice') || 'ja-JP-KeitaNeural';
    const rate = fullUrl.searchParams.get('rate') || '1.0';
    const format = fullUrl.searchParams.get('format') || 'audio-16khz-32kbitrate-mono-mp3';

    const filename = `${voice}_${rate}_${text}`;
    const GAS_URL = process.env.GAS_URL || 'https://script.google.com/macros/s/AKfycbxUcnkzBAkguAxlZx3Z3R6dcaYapY46FeXAjxqfrweqPFiBsiUvShZp-BnfPyEpzf0/exec';

    console.log(`\n=== [NEW REQUEST] ===`);
    console.log(`> Text: ${text}`);

    // 2️⃣ CHECK GOOGLE DRIVE
    try {
      const checkRes = await fetch(`${GAS_URL}?action=check&filename=${encodeURIComponent(filename)}`);
      const checkData = await checkRes.json();
      
      if (checkData.exists && checkData.directLink) {
        const driveResponse = await fetch(checkData.directLink);
        if (driveResponse.ok) {
          const audio = await driveResponse.arrayBuffer();
          return new Response(audio, {
            headers: { 'Content-Type': 'audio/mpeg', 'X-Audio-Source': 'Google-Drive' }
          });
        }
      }
    } catch (driveErr) {
      console.error(`[ERROR] Drive process error: ${driveErr.message}`);
    }

    // 3️⃣ AZURE TTS
    const endpoint = process.env.AZURE_TTS_ENDPOINT;
    const key = process.env.AZURE_TTS_KEY;

    if (!endpoint || !key) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 });
    }

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

    if (!azureResponse.ok) {
      const errDetail = await azureResponse.text();
      return new Response(errDetail, { status: 500 });
    }

    const audio = await azureResponse.arrayBuffer();

    // 4️⃣ SAVE TO DRIVE (Chạy ngầm với waitUntil)
    // Tác vụ này sẽ chạy sau khi phản hồi đã được gửi trả cho client
    const saveTask = (async () => {
      if (audio && GAS_URL) {
        try {
          await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: "upload", 
              filename: filename, 
              fileData: Array.from(new Uint8Array(audio)) 
            })
          });
          console.log(`[GAS_SAVE_RESPONSE]: Success`);
        } catch (e) {
          console.error(`[ASYNC ERROR] Save to Drive failed: ${e.message}`);
        }
      }
    })();
    
    // Đăng ký tác vụ chạy nền
    context.waitUntil(saveTask);

    // 5️⃣ PHẢN HỒI NGAY LẬP TỨC
    return new Response(audio, {
      headers: { 
        'Content-Type': 'audio/mpeg', 
        'X-Audio-Source': 'Azure-Cloud' 
      }
    });

  } catch (e) {
    console.error(`[CRASH] Global Exception: ${e.message}`);
    return new Response(JSON.stringify({ error: 'TTS failed' }), { status: 500 });
  }
}