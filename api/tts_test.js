export default async function handler(req, res) {
  try {
    // ===============================
    // 1️⃣ PARAMS + DEFAULT
    // ===============================
    const {
      text = '你好',
      lang = 'zh-CN',
      voice = 'zh-CN-XiaoxiaoNeural',
      rate = '1.0',
      format = 'audio-16khz-32kbitrate-mono-mp3',
      driveUrl = 'https://drive.google.com/file/d/1rPebExM4pANHI0nmBQZaX-iPR79hS2xs/view'
    } = req.query;

    const rawKey = `${text}_${lang}_${voice}_${rate}`;
    const filename = Buffer.from(rawKey).toString('base64').substring(0, 50);
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbxUcnkzBAkguAxlZx3Z3R6dcaYapY46FeXAjxqfrweqPFiBsiUvShZp-BnfPyEpzf0/exec';

    // ===============================
    // 2️⃣ CHECK GOOGLE DRIVE FIRST
    // ===============================
    try {
      console.log(`[CHECK] Đang kiểm tra sự tồn tại của file ${filename} trên Drive...`);
      const checkRes = await fetch(`${GAS_URL}?action=check&filename=${filename}`);
      const checkData = await checkRes.json();

      if (checkData.exists && checkData.directLink) {
        const driveResponse = await fetch(checkData.directLink);
        if (driveResponse.ok) {
          const audio = await driveResponse.arrayBuffer();
          res.setHeader('Content-Type', 'audio/mpeg');
          console.log(`[SUCCESS] Trả về audio từ Drive: ${filename}`);
          return res.send(Buffer.from(audio));
        }
      }
    } catch (driveErr) {
      console.error('[DRIVE ERROR] File chưa có hoặc lỗi kết nối Drive, chuyển sang Azure:', driveErr.message);
    }

    // ===============================
    // 3️⃣ AZURE CONFIG
    // ===============================
    let endpoint = process.env.AZURE_TTS_ENDPOINT;
    const key = process.env.AZURE_TTS_KEY;

    if (!endpoint || !key) {
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    endpoint = endpoint.replace(/\/$/, '');
    const ttsUrl = `${endpoint}/cognitiveservices/v1`;

    const ssml = `
<speak version="1.0" xml:lang="${lang}">
  <voice name="${voice}">
    <prosody rate="${rate}">
      ${escapeXml(text)}
    </prosody>
  </voice>
</speak>`;

    // ===============================
    // 4️⃣ CALL AZURE
    // ===============================
    console.log(`[AZURE] Đang gọi Azure TTS cho: ${text.substring(0, 20)}...`);
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
      const err = await azureResponse.text();
      return res.status(500).send(err);
    }

    // ===============================
    // 5️⃣ RESPONSE & SAVE TO DRIVE
    // ===============================
    const audio = await azureResponse.arrayBuffer();

    // Lưu âm thanh đã lấy được vào Drive qua GAS để sử dụng về sau
    if (audio && GAS_URL) {
      console.log(`[SAVE] Đang lưu file mới lên Drive: ${filename}`);
      fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: "upload",
          filename: filename,
          fileData: Array.from(new Uint8Array(audio))
        })
      }).catch(err => console.error('[SAVE ERROR] Lưu Drive thất bại:', err.message));
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audio));

  } catch (e) {
    console.error('TTS crash:', e);
    res.status(500).json({ error: 'TTS failed' });
  }
}

function escapeXml(str) {
  return str.replace(/[<>&'"]/g, c => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  }[c]));
}