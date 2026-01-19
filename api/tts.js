// api/tts.js
const GAS_URL = "https://script.google.com/macros/s/AKfycbxUcnkzBAkguAxlZx3Z3R6dcaYapY46FeXAjxqfrweqPFiBsiUvShZp-BnfPyEpzf0/exec";

export default async function handler(req, res) {
    // Thêm log để kiểm tra request đầu vào
    console.log(`[LOG] Nhận yêu cầu TTS: ${new Date().toISOString()}`);
    
    const { text, filename, voice = "vi-VN-HoaiMyNeural", rate = "1.0" } = req.query;

    if (!text || !filename) {
        return res.status(400).json({ error: "Thiếu tham số text hoặc filename" });
    }

    const fileKey = filename.trim();

    try {
        // BƯỚC 1: Kiểm tra sự tồn tại trên Google Drive qua GAS
        console.log(`[CHECK] Đang kiểm tra fileKey: ${fileKey} trên Drive...`);
        const checkRes = await fetch(`${GAS_URL}?action=check&key=${encodeURIComponent(fileKey)}`);
        const driveData = await checkRes.json();

        if (driveData.exists) {
            console.log(`[FOUND] File đã có trên Drive. Trả về Proxy URL.`);
            return res.status(200).json({
                source: 'driver',
                proxyUrl: driveData.proxyUrl, // Link này để Frontend fetch binary không bị 403
                fileKey: fileKey
            });
        }

        // BƯỚC 2: Nếu không có trên Drive -> Gọi Azure TTS
        console.log(`[MISS] File chưa có. Đang gọi Azure TTS...`);
        
        // Cấu hình Azure TTS (Sử dụng REST API để tối ưu trên Vercel)
        const azureRegion = process.env.AZURE_REGION || "eastus";
        const azureKey = process.env.AZURE_KEY;
        const azureUrl = `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

        const response = await fetch(azureUrl, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': azureKey,
                'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
                'User-Agent': 'Vercel-TTS-Service'
            },
            body: `<speak version='1.0' xml:lang='vi-VN'>
                    <voice xml:lang='vi-VN' name='${voice}'>
                        <prosody rate='${rate}'>${text}</prosody>
                    </voice>
                  </speak>`
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Azure TTS Error: ${errText}`);
        }

        // Chuyển đổi ArrayBuffer sang Base64 để gửi về Client
        const audioBuffer = await response.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');

        console.log(`[SUCCESS] Đã tạo xong audio từ Azure cho: ${fileKey}`);

        return res.status(200).json({
            source: 'azure',
            audioData: audioBase64, // Gửi base64 về để Frontend phát và lưu IndexedDB/Drive
            fileKey: fileKey
        });

    } catch (error) {
        console.error(`[CRITICAL ERROR] ${error.message}`);
        return res.status(500).json({ error: error.message });
    }
}