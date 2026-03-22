export const config = {
  runtime: 'edge',
};

export default async function handler(req, context) {
  const startTime = Date.now(); // Ghi nhận thời điểm nhận request
  const GAS_URL = process.env.GAS_URL || 'https://script.google.com/macros/s/AKfycbxUcnkzBAkguAxlZx3Z3R6dcaYapY46FeXAjxqfrweqPFiBsiUvShZp-BnfPyEpzf0/exec';

  try {
    const fullUrl = new URL(req.url);
    const text = (fullUrl.searchParams.get('text') || '你好').trim();
    const lang = fullUrl.searchParams.get('lang') || 'ja-JP';
    const voice = fullUrl.searchParams.get('voice') || 'ja-JP-KeitaNeural';
    const rate = fullUrl.searchParams.get('rate') || '1.0';
    const format = fullUrl.searchParams.get('format') || 'audio-16khz-32kbitrate-mono-mp3';

    const filename = `${voice}_${rate}_${text}`;

    console.log(`\n=== [NEW REQUEST: ${text}] ===`);

    // 1️⃣ CHECK DRIVE
    try {
      const checkRes = await fetch(`${GAS_URL}?action=check&filename=${encodeURIComponent(filename)}`);
      const contentType = checkRes.headers.get('content-type');

      if (checkRes.ok && contentType?.includes('application/json')) {
        const checkData = await checkRes.json();
        const returnedName = checkData.filename ? checkData.filename.replace('.mp3', '').trim() : '';

        if (checkData.exists && returnedName === filename && checkData.directLink) {
          const hitTime = Date.now();
          console.log(`[PERF] 🎯 CACHE HIT (Drive) lúc: ${hitTime - startTime}ms`);
          return Response.redirect(checkData.directLink);
        }
      }
    } catch (e) { console.warn("[Drive Check Error]", e.message); }

    // 2️⃣ AZURE TTS
    const endpoint = process.env.AZURE_TTS_ENDPOINT;
    const key = process.env.AZURE_TTS_KEY;
    const ttsUrl = `${endpoint.replace(/\/$/, '')}/cognitiveservices/v1`;
    const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}"><prosody rate="${rate}">${text.replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]))}</prosody></voice></speak>`;

    const azureResponse = await fetch(ttsUrl, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': format },
      body: ssml
    });

    if (!azureResponse.ok) return new Response("Azure Failed", { status: 500 });
    const audio = await azureResponse.arrayBuffer();

    // 3️⃣ SAVE TO DRIVE (Chạy ngầm - Edge sẽ đợi task này hoàn thành sau khi trả audio)
    const saveTask = (async () => {
      const saveStart = Date.now();
      console.log(`[PERF] 🚀 Bắt đầu gọi lưu Drive lúc: ${saveStart - startTime}ms`);
      
      if (audio && GAS_URL) {
        try {
          await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: "upload", filename: filename, fileData: Array.from(new Uint8Array(audio)) 
            })
          });
          const saveEnd = Date.now();
          console.log(`[PERF] ✅ Lưu Drive XONG lúc: ${saveEnd - startTime}ms (Tổng thời gian lưu: ${saveEnd - saveStart}ms)`);
        } catch (e) { console.error(`[SAVE ERROR]: ${e.message}`); }
      }
    })();

    // Đăng ký tác vụ chạy nền (Cực kỳ quan trọng trên Edge)
    context.waitUntil(saveTask);

    // 4️⃣ PHẢN HỒI NGAY
    const responseTime = Date.now();
    console.log(`[PERF] ⚡ TRẢ VỀ CLIENT LÚC: ${responseTime - startTime}ms`);
    
    return new Response(audio, {
      headers: { 'Content-Type': 'audio/mpeg', 'X-Audio-Source': 'Azure-Cloud' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}