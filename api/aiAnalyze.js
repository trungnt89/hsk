import * as util from './util';
import fetch from 'node-fetch';

export default async function handler(req, res) {
    writeLog("[LOG] --- Bắt đầu xử lý request phân tích âm thanh ---");

    if (req.method !== 'POST') {
        writeLog("[LOG] Phát hiện phương thức không hợp lệ: " + req.method);
        return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST' });
    }

    try {
        const { apiKey, script, audioBase64, mimeType, fileId, lessionId, webAppUrl } = req.body;

        if (!apiKey || !audioBase64) {
            writeLog("[LOG] Thiếu tham số bắt buộc: API Key hoặc Audio Data");
            return res.status(400).json({ error: 'Thiếu dữ liệu đầu vào' });
        }

        writeLog("[LOG] Đang gọi Gemini API...");
        const modelName = 'gemini-2.5-flash'; 
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const promt = `Bạn là chuyên gia ngôn ngữ Nhật Bản. Dưới đây là kịch bản gốc và file ghi âm thực tế. Hãy thực hiện các yêu cầu sau bằng TIẾNG VIỆT:
                                  KỊCH BẢN GỐC: "${script || 'Không cung cấp - Hãy tự nhận diện nội dung'}"
                                  YÊU CẦU:
                                  1. SO SÁNH: Đối chiếu giữa kịch bản gốc và những gì người nói thực tế đã nói. Chỉ ra các từ bị nói sai, nói thiếu hoặc biến âm.
                                  2. NHẬT XÉT CHI TIẾT: Phân tích về phát âm (seion, dakuon, youon...), trường âm (chouon), âm ngắt (sokuon) và đặc biệt là Pitch Accent.
                                  3. CHẤM ĐIỂM: Đưa ra điểm số trên thang điểm 1000 dựa trên độ chính xác, ngữ điệu và sự tự nhiên (Ví dụ: 850/1000) và lý do tại sao đưa ra con số điểm đó.
                                  4. KHUYÊN CẢI THIỆN: Đưa ra 2-3 lời khuyên thực tế để nói tốt hơn.`;
        
        writeLog("[LOG] Prompt prepared.");
		writeLog(promt);
                                  
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: promt },
                        { inline_data: { mime_type: mimeType || "audio/mp4", data: audioBase64 } }
                    ]
                }]
            })
        });

        const data = await geminiResponse.json();
        writeLog(JSON.stringify(data));
        
        if (!data.candidates || !data.candidates[0]) {
            writeLog("[LOG] Lỗi từ Gemini API: " + JSON.stringify(data));
            throw new Error(JSON.stringify(data));
        }

        const aiText = data.candidates[0].content.parts[0].text;
        const scoreMatch = aiText.match(/(\d+)\/1000/);
        const score = scoreMatch ? scoreMatch[1] : "0";

        writeLog(`[LOG] AI Phân tích xong. Điểm số: ${score}`);

        if (webAppUrl && fileId) {
            writeLog("[LOG] Đang gửi dữ liệu lưu trữ tới Google Sheets...");
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
            writeLog("[LOG] Gửi Google Sheets thành công.");
        }

        writeLog("[LOG] Hoàn tất xử lý, trả kết quả về Client.");
        return res.status(200).json({
            analysis: aiText,
            score: score
        });

    } catch (error) {
        writeLog("[LOG] LỖI SERVER: " + error.message);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Hàm ghi Log được đưa ra ngoài scope export để tận dụng tối đa cơ chế Hoisting
 * Giúp code chính sạch sẽ và không gặp lỗi ReferenceError
 */
function writeLog(message) {
    const timestamp = new Date().toISOString();
    console.log(`[LOG] [${timestamp}] ${message}`);
    util.writeLog(message, "AI ANALYSIS");
}