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
      driveUrl = '1' // Nhận thêm tham số link drive từ frontend nếu có
    } = req.query;

    // ===============================
    // 2️⃣ CHECK GOOGLE DRIVE FIRST
    // ===============================
    if (1==1) {
      try {
        // Chuyển đổi link view sang link download trực tiếp
        const fileId = driveUrl.match(/[-\w]{25,}/)[0];
        const directLink = `https://drive.google.com/uc?export=download&id=${fileId}`;
        
        console.log(`[DRIVE] Đang lấy file từ ID: ${fileId}`);
        
        const driveResponse = await fetch(directLink);
        if (driveResponse.ok) {
          const audio = await driveResponse.arrayBuffer();
          res.setHeader('Content-Type', 'audio/mpeg');
          console.log(`[SUCCESS] Trả về audio từ Drive`);
          return res.send(Buffer.from(audio));
        }
      } catch (driveErr) {
        console.error('[DRIVE ERROR] Không thể lấy file từ Drive, chuyển sang Azure:', driveErr.message);
        // Nếu lỗi Drive, code sẽ tự động chạy xuống phần Azure bên dưới
      }
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
    // 5️⃣ RESPONSE
    // ===============================
    const audio = await azureResponse.arrayBuffer();
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