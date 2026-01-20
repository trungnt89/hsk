export default async function handler(req, res) {
  let debugLog = []; 
  try {
    // 1️⃣ PARAMS + DEFAULT (Sử dụng WHATWG URL API thay cho url.parse ẩn)
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const fullUrl = new URL(req.url, `${protocol}://${host}`);
    
    const text = fullUrl.searchParams.get('text') || '你好';
    const lang = fullUrl.searchParams.get('lang') || 'ja-JP';
    const voice = fullUrl.searchParams.get('voice') || 'ja-JP-KeitaNeural';
    const rate = fullUrl.searchParams.get('rate') || '1.0';
    const format = fullUrl.searchParams.get('format') || 'audio-16khz-32kbitrate-mono-mp3';

    const rawKey = `${text}_${lang}_${voice}_${rate}`;
    const filename = Buffer.from(rawKey).toString('base64').substring(0, 50);
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbxUcnkzBAkguAxlZx3Z3R6dcaYapY46FeXAjxqfrweqPFiBsiUvShZp-BnfPyEpzf0/exec';

    debugLog.push(`FN: ${filename}`);

    // 2️⃣ CHECK GOOGLE DRIVE FIRST
    try {
      debugLog.push("Action: CheckDrive");
      const checkRes = await fetch(`${GAS_URL}?action=check&filename=${encodeURIComponent(filename)}`);
      const checkData = await checkRes.json();
      
      debugLog.push(`GAS: ${checkData.exists ? 'Exist' : 'Missing'}`);

      if (checkData.exists && checkData.directLink) {
        const driveResponse = await fetch(checkData.directLink);
        if (driveResponse.ok) {
          const audio = await driveResponse.arrayBuffer();
          res.setHeader('Content-Type', 'audio/mpeg');
          debugLog.push("Result: Drive_OK");
          res.setHeader('X-Audio-Source', debugLog.join(' | '));
          return res.send(Buffer.from(audio));
        }
      }
    } catch (driveErr) {
      debugLog.push(`Err: Drive_Check_Failed`);
    }

    // 3️⃣ AZURE TTS
    let endpoint = process.env.AZURE_TTS_ENDPOINT;
    const key = process.env.AZURE_TTS_KEY;

    if (!endpoint || !key) {
      debugLog.push("Err: Azure_Config_Missing");
      res.setHeader('X-Audio-Source', debugLog.join(' | '));
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const ttsUrl = `${endpoint.replace(/\/$/, '')}/cognitiveservices/v1`;
    const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}"><prosody rate="${rate}">${text.replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]))}</prosody></voice></speak>`;

    debugLog.push("Action: CallAzure");
    const azureResponse = await fetch(ttsUrl, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': format },
      body: ssml
    });

    if (!azureResponse.ok) {
      debugLog.push(`Err: Azure_Fail_${azureResponse.status}`);
      res.setHeader('X-Audio-Source', debugLog.join(' | '));
      return res.status(500).send(await azureResponse.text());
    }

    const audio = await azureResponse.arrayBuffer();

    // 4️⃣ SAVE TO DRIVE (Bổ sung log đầy đủ)
    if (audio && GAS_URL) {
      debugLog.push("Action: SavingDrive");
      console.log(`[LOG] Đang lưu file lên Drive qua GAS...`);
      fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "upload", filename: filename, fileData: Array.from(new Uint8Array(audio)) })
      }).catch(e => console.error('[LOG] Ghi file Drive thất bại'));
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    debugLog.push("Result: Azure_OK");
    res.setHeader('X-Audio-Source', debugLog.join(' | '));
    res.send(Buffer.from(audio));

  } catch (e) {
    debugLog.push(`Crash: ${e.message}`);
    res.setHeader('X-Audio-Source', debugLog.join(' | '));
    res.status(500).json({ error: 'TTS failed' });
  }
}