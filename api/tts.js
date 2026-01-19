export default async function handler(req, res) {
  try {
    // ===============================
    // 1️⃣ PARAMS + DEFAULT
    // ===============================
    const {
      text = '你好',
      lang = 'zh-CN',
      voice = 'zh-CN-XiaoxiaoNeural', // default: Chinese female
      rate = '1.0',
      format = 'audio-16khz-32kbitrate-mono-mp3'
    } = req.query;

    // ===============================
    // 2️⃣ ENV
    // ===============================
    let endpoint = process.env.AZURE_TTS_ENDPOINT;
    const key = process.env.AZURE_TTS_KEY;

    if (!endpoint || !key) {
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    if (endpoint.includes('api.cognitive.microsoft.com')) {
      return res.status(500).json({
        error: 'Invalid Azure TTS endpoint'
      });
    }

    endpoint = endpoint.replace(/\/$/, '');
    const ttsUrl = `${endpoint}/cognitiveservices/v1`;

    // ===============================
    // 3️⃣ SSML (rate applied)
    // ===============================
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
    const response = await fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': format
      },
      body: ssml
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).send(err);
    }

    // ===============================
    // 5️⃣ RESPONSE
    // ===============================
    const audio = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audio));

  } catch (e) {
    console.error('TTS crash:', e);
    res.status(500).json({ error: 'TTS failed' });
  }
}

/**
 * Escape XML để tránh lỗi SSML
 */
function escapeXml(str) {
  return str.replace(/[<>&'"]/g, c => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  }[c]));
}
