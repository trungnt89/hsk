export default async function handler(req, res) {
  let debugLog = []; // Biến tích lũy log
  try {
    // 1️⃣ PARAMS + DEFAULT
    const {
      text = '你好',
      lang = 'ja-JP',
      voice = 'ja-JP-KeitaNeural',
      rate = '1.0',
      format = 'audio-16khz-32kbitrate-mono-mp3'
    } = req.query;

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
          
          console.log(`[SUCCESS] Drive: ${filename}`);
          return res.send(Buffer.from(audio));
        } else {
          debugLog.push("Result: Drive_Fetch_Failed");
        }
      }
    } catch (driveErr) {
      debugLog.push(`Err: ${driveErr.message.substring(0, 20)}`);
    }

    // 3️⃣ AZURE TTS (Nếu Drive không có)
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

    // 4️⃣ SAVE TO DRIVE (Async)
    if (audio && GAS_URL) {
      debugLog.push("Action: SavingDrive");
      fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "upload", filename: filename, fileData: Array.from(new Uint8Array(audio)) })
      }).catch(e => console.error('Save fail'));
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