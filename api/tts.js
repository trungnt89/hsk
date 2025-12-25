export default async function handler(req, res) {
  const text = req.query.text;
  if (!text) {
    return res.status(400).send("Missing text");
  }

  const key = process.env.AZURE_TTS_KEY;
  const region = process.env.AZURE_TTS_REGION;

  const ssml = `
<speak version="1.0" xml:lang="zh-CN">
  <voice name="zh-CN-XiaoxiaoNeural">
    ${text}
  </voice>
</speak>`;

  const response = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      },
      body: ssml,
    }
  );

  const audio = await response.arrayBuffer();
  res.setHeader("Content-Type", "audio/mpeg");
  res.send(Buffer.from(audio));
}
