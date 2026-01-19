// api/tts.js
const GAS_URL = "https://script.google.com/macros/s/AKfycbxUcnkzBAkguAxlZx3Z3R6dcaYapY46FeXAjxqfrweqPFiBsiUvShZp-BnfPyEpzf0/exec";

export default async function handler(req, res) {
    const { text, filename, voice = "vi-VN-HoaiMyNeural" } = req.query;
    const fileKey = (filename || "").trim();

    try {
        // 1. Check Drive qua GAS
        const checkRes = await fetch(`${GAS_URL}?action=check&key=${encodeURIComponent(fileKey)}`);
        const driveData = await checkRes.json();

        if (driveData.exists) {
            return res.status(200).json({
                source: 'driver',
                proxyUrl: driveData.proxyUrl,
                fileKey: fileKey
            });
        }

        // 2. Gọi Azure TTS REST API
        const azureRegion = process.env.AZURE_REGION || "eastus";
        const azureKey = process.env.AZURE_KEY; // Đảm bảo đã đặt trong Vercel Env
        const azureUrl = `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

        const azureRes = await fetch(azureUrl, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': azureKey,
                'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
                'User-Agent': 'Vercel-TTS'
            },
            body: `<speak version='1.0' xml:lang='vi-VN'><voice name='${voice}'>${text}</voice></speak>`
        });

        if (!azureRes.ok) throw new Error("Azure API trả về lỗi");

        const arrayBuffer = await azureRes.arrayBuffer();
        const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

        // Trả về JSON sạch
        return res.status(200).json({
            source: 'azure',
            audioData: audioBase64, // Chuỗi Base64 chuẩn 100%
            fileKey: fileKey
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}