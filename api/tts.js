export default async function handler(req, res) {
  try {
    const { text = '', lang = 'zh-CN', voice = 'zh-CN-XiaoxiaoNeural', rate = '1.0', filename = 'speech' } = req.query;
    
    // Tạo Key an toàn cho URL (Không dùng toàn bộ text nếu text quá dài)
    const shortText = text.substring(0, 15).replace(/[^a-z0-9]/gi, '_');
    const fileKey = `${filename}_${shortText}_${voice}_${rate}`;

    const gasUrl = "https://script.google.com/macros/s/AKfycbxUcnkzBAkguAxlZx3Z3R6dcaYapY46FeXAjxqfrweqPFiBsiUvShZp-BnfPyEpzf0/exec";

    console.log(`[Vercel Log] Processing Key: ${fileKey}`);

    // 1. KIỂM TRA QUA GAS
    if (gasUrl) {
      try {
        const checkRes = await fetch(`${gasUrl}?action=check&key=${encodeURIComponent(fileKey)}`);
        const checkData = await checkRes.json();
        if (checkData.exists) {
          console.log(`[Vercel Log] HIT: Found on Drive`);
          return res.status(200).json({ source: 'driver', url: checkData.url });
        }
      } catch (gasErr) {
        console.error(`[Vercel Log] GAS Check Failed: ${gasErr.message}`);
      }
    }

    // 2. LẤY MỚI TỪ AZURE
    const endpoint = (process.env.AZURE_TTS_ENDPOINT || '').replace(/\/$/, '');
    const azureKey = process.env.AZURE_TTS_KEY;

    if (!endpoint || !azureKey) {
      return res.status(500).json({ error: "Missing Azure Credentials" });
    }

    // Thoát ký tự XML để tránh lỗi "Invalid character"
    const escapedText = text.replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
    const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}"><prosody rate="${rate}">${escapedText}</prosody></voice></speak>`;
    
    const azureRes = await fetch(`${endpoint}/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3'
      },
      body: ssml
    });

    if (!azureRes.ok) {
      const errorDetail = await azureRes.text();
      console.error(`[Vercel Log] Azure API Error: ${errorDetail}`);
      return res.status(500).json({ error: `Azure TTS: ${errorDetail}` });
    }

    const audioBuffer = await azureRes.arrayBuffer();
    
    console.log(`[Vercel Log] Azure Success: Returning Base64`);
    return res.status(200).json({
      source: 'azure',
      fileKey: fileKey,
      audioData: Buffer.from(audioBuffer).toString('base64')
    });

  } catch (e) {
    console.error('[Vercel Log] Crash Error:', e);
    res.status(500).json({ error: e.message });
  }
}