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
    console.log(`\n=== [NEW REQUEST: ${text}] ===`);

    // 1️⃣ CHECK DRIVE (Sửa lỗi parse HTML và so khớp chính xác)
    try {
      const checkRes = await fetch(`${GAS_URL}?action=check&filename=${encodeURIComponent(filename)}`);
      const contentType = checkRes.headers.get('content-type');

      if (checkRes.ok && contentType?.includes('application/json')) {
        const checkData = await checkRes.json();
        const returnedName = checkData.filename ? checkData.filename.replace('.mp3', '').trim() : '';

        // So khớp tuyệt đối để tránh lấy nhầm câu thoại ngắn trong câu thoại dài
        if (checkData.exists && returnedName === filename && checkData.directLink) {
          console.log(`[PERF] 🎯 CACHE HIT lúc: ${Date.now() - startTime}ms`);
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

    if (!azureResponse.ok || !azureResponse.body) return new Response("Azure Failed", { status: 500 });

    // ⚡ STREAMING: Sử dụng tee() để nhân đôi luồng dữ liệu
    const [clientStream, saveStream] = azureResponse.body.tee();

    // 3️⃣ SAVE TO DRIVE (Chạy ngầm)
    const saveTask = (async () => {
      try {
        const reader = saveStream.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        // Gom các mảnh dữ liệu lại thành một Buffer hoàn chỉnh
        const audioBuffer = new Uint8Array(await new Blob(chunks).arrayBuffer());

        console.log(`[PERF] 🚀 Uploading to Drive... (${audioBuffer.byteLength} bytes)`);
        await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: "upload", filename: filename, fileData: Array.from(audioBuffer) 
          })
        });
        console.log(`[PERF] ✅ Lưu Drive XONG lúc: ${Date.now() - startTime}ms`);
      } catch (e) { console.error(`[SAVE ERROR]: ${e.message}`); }
    })();

    context.waitUntil(saveTask);

    // 4️⃣ PHẢN HỒI STREAMING (Phát nhạc ngay khi có dữ liệu đầu tiên)
    console.log(`[PERF] ⚡ BẮT ĐẦU STREAM CHO CLIENT LÚC: ${Date.now() - startTime}ms`);
    
    return new Response(clientStream, {
      headers: { 
        'Content-Type': 'audio/mpeg', 
        'X-Audio-Source': 'Azure-Streaming',
        'Transfer-Encoding': 'chunked' 
      }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}