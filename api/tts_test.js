export default async function handler(req, res) {
  try {
    // 1️⃣ PARAMS (Sử dụng WHATWG URL API để triệt tiêu DEP0169)
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const fullUrl = new URL(req.url, `${protocol}://${host}`);
    
    const text = fullUrl.searchParams.get('text') || '你好';
    const lang = fullUrl.searchParams.get('lang') || 'ja-JP';
    const voice = fullUrl.searchParams.get('voice') || 'ja-JP-KeitaNeural';
    const rate = fullUrl.searchParams.get('rate') || '1.0';
    const format = fullUrl.searchParams.get('format') || 'audio-16khz-32kbitrate-mono-mp3';

    const rawKey = `${text}_${lang}_${voice}_${rate}`;
    //const filename = Buffer.from(rawKey).toString('base64').substring(0, 50);
	const filename = rawKey;
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbxUcnkzBAkguAxlZx3Z3R6dcaYapY46FeXAjxqfrweqPFiBsiUvShZp-BnfPyEpzf0/exec';

    console.log(`\n=== [NEW REQUEST] ===`);
    console.log(`> Text: ${text.substring(0, 50)}`);
    console.log(`> Filename: ${filename}`);

    // 2️⃣ CHECK GOOGLE DRIVE
    try {
      console.log(`[STEP 1] Checking Drive via GAS...`);
      const checkRes = await fetch(`${GAS_URL}?action=check&filename=${encodeURIComponent(filename)}`);
      const checkData = await checkRes.json();
      
      // Log toàn bộ JSON để xem xử lý bên trong GAS
      console.log(`[GAS_CHECK_RESPONSE]: ${JSON.stringify(checkData, null, 2)}`);

      if (checkData.exists && checkData.directLink) {
        console.log(`[STEP 2] FOUND on Drive. Downloading...`);
        const driveResponse = await fetch(checkData.directLink);
        if (driveResponse.ok) {
          const audio = await driveResponse.arrayBuffer();
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('X-Audio-Source', 'Google-Drive');
          console.log(`[RESULT] Download Success.Send void to client`);
          return res.send(Buffer.from(audio));
        }
      }
      console.log(`[STEP 2] MISSING or ERROR on Drive. Proceeding to Azure...`);
    } catch (driveErr) {
      console.error(`[ERROR] Drive process error: ${driveErr.message}`);
    }

    // 3️⃣ AZURE TTS
    const endpoint = process.env.AZURE_TTS_ENDPOINT;
    const key = process.env.AZURE_TTS_KEY;

    if (!endpoint || !key) {
      console.error(`[CRITICAL] Azure environment variables missing!`);
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const ttsUrl = `${endpoint.replace(/\/$/, '')}/cognitiveservices/v1`;
    const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}"><prosody rate="${rate}">${text.replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]))}</prosody></voice></speak>`;

    console.log(`[STEP 3] Calling Azure Cloud TTS...`);
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
      console.error(`[ERROR] Azure API failed: ${azureResponse.status} - ${errDetail}`);
      return res.status(500).send(errDetail);
    }

    const audio = await azureResponse.arrayBuffer();
    console.log(`[STEP 4] Azure TTS Success. Binary size: ${audio.byteLength} bytes.`);

    // 4️⃣ SAVE TO DRIVE (Chạy ngầm)
    if (audio && GAS_URL) {
      console.log(`[STEP 5] Triggering Background Save to Google Drive...`);
      fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: "upload", 
          filename: filename, 
          fileData: Array.from(new Uint8Array(audio)) 
        })
      })
      .then(async (r) => {
          const resSave = await r.json();
          // Log kết quả lưu file
          console.log(`[GAS_SAVE_RESPONSE]: ${JSON.stringify(resSave, null, 2)}`);
      })
      .catch(e => console.error(`[ASYNC ERROR] Save to Drive failed: ${e.message}`));
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Audio-Source', 'Azure-Cloud');
    console.log(`[RESULT] Success: Served from Azure Cloud.`);
    res.send(Buffer.from(audio));

  } catch (e) {
    console.error(`[CRASH] Global Exception: ${e.message}`);
    res.status(500).json({ error: 'TTS failed' });
  }
}