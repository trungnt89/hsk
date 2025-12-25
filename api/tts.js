export default async function handler(req, res) {
  try {
    const text = req.query.text || '你好';

    const endpoint = process.env.AZURE_TTS_ENDPOINT;
    const key = process.env.AZURE_TTS_KEY;

    if (!endpoint || !key) {
      console.error("Missing Azure env");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    const ssml = `
<speak version="1.0" xml:lang="zh-CN">
  <voice name="zh-CN-XiaoxiaoNeural">${text}</voice>
</speak>`;

    const response = await fetch(
      `${endpoint}/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3'
        },
        body: ssml
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Azure error:", err);
      return res.status(500).send(err);
    }

    const audio = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audio));

  } catch (e) {
    console.error("TTS crash:", e);
    res.status(500).json({ error: "TTS failed" });
  }
}
