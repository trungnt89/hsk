export default async function handler(req, res) {
  try {
    const { text, lang, voice, rate, filename = 'speech' } = req.query;
    const fileKey = `${filename}_${text}_${lang}_${voice}_${rate}`;
    //const gasUrl = process.env.GAS_WEBHOOK_URL;
	const gasUrl = "https://script.google.com/macros/s/AKfycbxUcnkzBAkguAxlZx3Z3R6dcaYapY46FeXAjxqfrweqPFiBsiUvShZp-BnfPyEpzf0/exec";

    console.log(`[Vercel Log] Start: ${fileKey}`);

    // 1. KIỂM TRA QUA GAS (Requirement 1)
    if (gasUrl) {
      const checkRes = await fetch(`${gasUrl}?action=check&key=${encodeURIComponent(fileKey)}`);
      const checkData = await checkRes.json();
      if (checkData.exists) {
        console.log(`[Vercel Log] HIT: Returning Drive URL`);
        return res.status(200).json({ source: 'driver', url: checkData.url });
      }
    }

    // 2. LẤY MỚI TỪ AZURE (Requirement 2)
    console.log(`[Vercel Log] MISS: Fetching Azure TTS`);
    const endpoint = process.env.AZURE_TTS_ENDPOINT.replace(/\/$/, '');
    const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}"><prosody rate="${rate}">${text}</prosody></voice></speak>`;
    
    const azureRes = await fetch(`${endpoint}/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.AZURE_TTS_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3'
      },
      body: ssml
    });

    const audioBuffer = await azureRes.arrayBuffer();
    
    // Trả về JSON chứa fileKey để Frontend biết đường gọi lại GAS
    res.setHeader('x-file-key', fileKey); 
    return res.status(200).json({
      source: 'azure',
      fileKey: fileKey,
      audioData: Buffer.from(audioBuffer).toString('base64') // Chuyển tạm qua base64 trong JSON để dễ đóng gói metadata
    });

  } catch (e) {
    console.error('[Vercel Log] Error:', e);
    res.status(500).send(e.message);
  }
}