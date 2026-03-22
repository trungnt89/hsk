export const config = {
  runtime: 'edge',
};

export default async function handler(req, context) {
  try {
    const fullUrl = new URL(req.url);
    const text = (fullUrl.searchParams.get('text') || '你好').trim();
    const lang = fullUrl.searchParams.get('lang') || 'ja-JP';
    const voice = fullUrl.searchParams.get('voice') || 'ja-JP-KeitaNeural';
    const rate = fullUrl.searchParams.get('rate') || '1.0';
    const format = fullUrl.searchParams.get('format') || 'audio-16khz-32kbitrate-mono-mp3';

    const filename = `${voice}_${rate}_${text}`;
    const GAS_URL = process.env.GAS_URL || 'https://script.google.com/macros/s/AKfycbxUcnkzBAkguAxlZx3Z3R6dcaYapY46FeXAjxqfrweqPFiBsiUvShZp-BnfPyEpzf0/exec';

    console.log(`\n=== [NEW REQUEST] ===`);
    console.log(`> Text: ${text}`);

    // 2️⃣ CHECK GOOGLE DRIVE (Sửa lỗi parse HTML và so khớp chính xác tên)
    try {
      const checkRes = await fetch(`${GAS_URL}?action=check&filename=${encodeURIComponent(filename)}`);
      const contentType = checkRes.headers.get('content-type');

      // CHỈ parse nếu GAS trả về JSON hợp lệ (tránh lỗi Unexpected token '<')
      if (checkRes.ok && contentType && contentType.includes('application/json')) {
        const checkData = await checkRes.json();
        
        // Chuẩn hóa tên file trả về để so sánh chính xác
        const returnedName = checkData.filename ? checkData.filename.replace('.mp3', '').trim() : '';

        // KIỂM TRA CHÍNH XÁC: Tránh lấy nhầm file "我家在后面" khi tìm "后面"
        if (checkData.exists && returnedName === filename && checkData.directLink) {
          console.log(`[RESULT] Exact match found on Drive. Serving audio...`);
          const driveResponse = await fetch(checkData.directLink);
          if (driveResponse.ok) {
            const audio = await driveResponse.arrayBuffer();
            return new Response(audio, {
              headers: { 'Content-Type': 'audio/mpeg', 'X-Audio-Source': 'Google-Drive' }
            });
          }
        } else if (checkData.exists) {
          console.log(`[SKIP] Filename mismatch: Got "${returnedName}"`);
        }
      } else {
        console.warn(`[GAS_WARNING] GAS returned non-JSON response (HTML or Error).`);
      }
    } catch (driveErr) {
      // Nếu lỗi parse JSON xảy ra, log lại và vẫn tiếp tục xuống bước Azure
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
    const saveTask = (async () => {
      if (audio && GAS_URL) {
        try {
          // Gửi lệnh upload lên GAS
          await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: "upload", 
              filename: filename, 
              fileData: Array.from(new Uint8Array(audio)) 
            })
          });
          console.log(`[GAS_SAVE_RESPONSE]: Success for ${filename}`);
        } catch (e) {
          console.error(`[ASYNC ERROR] Save to Drive failed: ${e.message}`);
        }
      }
    })();
    
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