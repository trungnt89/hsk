const fetch = require('node-fetch');

module.exports = async (req, res) => {
    console.log("[LOG] --- Bắt đầu xử lý request phân tích âm thanh ---");

    if (req.method !== 'POST') {
        console.warn("[LOG] Phát hiện phương thức không hợp lệ:", req.method);
        return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST' });
    }

    try {
        const { apiKey, script, audioBase64, mimeType, fileId, lessionId, webAppUrl } = req.body;

        if (!apiKey || !audioBase64) {
            console.error("[LOG] Thiếu tham số bắt buộc: API Key hoặc Audio Data");
            return res.status(400).json({ error: 'Thiếu dữ liệu đầu vào' });
        }

        console.log("[LOG] Đang gọi Gemini API...");
        const modelName = 'gemini-1.5-flash'; // Sử dụng bản ổn định nhất
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: `Bạn là chuyên gia ngôn ngữ Nhật Bản. Dưới đây là kịch bản gốc và file ghi âm thực tế. Hãy thực hiện các yêu cầu sau bằng TIẾNG VIỆT:
                                  KỊCH BẢN GỐC: "${script || 'Không cung cấp - Hãy tự nhận diện nội dung'}"
                                  YÊU CẦU:
                                  1. SO SÁNH: Đối chiếu giữa kịch bản gốc và những gì người nói thực tế đã nói. Chỉ ra các từ bị nói sai, nói thiếu hoặc biến âm.
                                  2. NHẬT XÉT CHI TIẾT: Phân tích về phát âm (seion, dakuon, youon...), trường âm (chouon), âm ngắt (sokuon) và đặc biệt là Pitch Accent.
                                  3. CHẤM ĐIỂM: Đưa ra điểm số trên thang điểm 1000 dựa trên độ chính xác, ngữ điệu và sự tự nhiên (Ví dụ: 850/1000) và lý do tại sao đưa ra con số điểm đó.
                                  4. KHUYÊN CẢI THIỆN: Đưa ra 2-3 lời khuyên thực tế để nói tốt hơn.` },
                        { inline_data: { mime_type: mimeType || "audio/mp4", data: audioBase64 } }
                    ]
                }]
            })
        });

        const data = await geminiResponse.json();
        
        if (!data.candidates || !data.candidates[0]) {
            console.error("[LOG] Lỗi từ Gemini API:", JSON.stringify(data));
            throw new Error("Không nhận được phản hồi từ AI");
        }

        const aiText = data.candidates[0].content.parts[0].text;
        const scoreMatch = aiText.match(/(\d+)\/1000/);
        const score = scoreMatch ? scoreMatch[1] : "0";

        console.log(`[LOG] AI Phân tích xong. Điểm số: ${score}`);

        // Gửi dữ liệu tới Google Sheets nếu có Web App URL
        if (webAppUrl && fileId) {
            console.log("[LOG] Đang gửi dữ liệu lưu trữ tới Google Sheets...");
            await fetch(webAppUrl, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'score',
                    script: script,
                    lessionID: lessionId,
                    fileId: fileId,
                    score: score,
                    analysis: aiText
                })
            });
            console.log("[LOG] Gửi Google Sheets thành công.");
        }

        console.log("[LOG] Hoàn tất xử lý, trả kết quả về Client.");
        return res.status(200).json({
            analysis: aiText,
            score: score
        });

    } catch (error) {
        console.error("[LOG] LỖI SERVER:", error.message);
        return res.status(500).json({ error: error.message });
    }
};