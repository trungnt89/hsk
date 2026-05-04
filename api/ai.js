import * as util from './util';
// Sử dụng biến môi trường (Environment Variables) trên Vercel để bảo mật Key
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;


/**
 * Handler chính cho Vercel (Serverless Function)
 */
export default async function handler(req, res) {
  // Chỉ cho phép phương thức POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { content, id } = req.body;
  writeLog(`--- Bắt đầu xử lý yêu cầu cho ID: ${id} ---`);

  let fullText = null;

  try {
    // Bước 1: Thử DeepSeek
    try {
      fullText = await callDeepSeek(content);
    } catch (e) {
      writeLog(`DeepSeek lỗi: ${e.message}`);
      // Bước 2: Thử Gemini nếu DeepSeek lỗi
      fullText = await callGemini(content);
    }

    if (!fullText) throw new Error("Cả hai dịch vụ AI đều không phản hồi.");

    // Logic tách chuỗi (Giữ nguyên logic cũ)
    const parts = fullText.split("---CONVERSATION---");
    const pPart = parts[0].replace("---PARAGRAPH---", "").trim();
    const cPart = parts[1] ? parts[1].trim() : "";

    writeLog('Parsed thành công Paragraph và Conversation');

    // Lưu ý: Việc cập nhật Google Sheet từ Vercel cần sử dụng Google Sheets API (v4)
    // Ở đây tôi trả về kết quả để Frontend hoặc App Script nhận và tự update
    return res.status(200).json({
      status: 'success',
      id: id,
      paragraph: pPart,
      conversation: cPart
    });

  } catch (error) {
    writeLog(`Error in Proxy: ${error.message}`);
    return res.status(500).json({ status: 'error', message: error.message });
  }
}

/**
 * Hàm gọi API DeepSeek
 */
async function callDeepSeek(prompt) {
  writeLog("Đang thử gọi DeepSeek...");
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    })
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`DeepSeek Error: ${json.error?.message || response.statusText}`);
  }
  
  writeLog("DeepSeek phản hồi thành công.");
  return json.choices[0].message.content;
}

/**
 * Hàm gọi API Gemini
 */
async function callGemini(prompt) {
  writeLog("Đang chuyển sang phương án dự phòng: Gemini...");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Gemini Error: ${json.error?.message || response.statusText}`);
  }

  writeLog("Gemini phản hồi thành công.");
  return json.candidates[0].content.parts[0].text;
}


// Hàm ghi Log (giả lập writeLog của GAS)
const writeLog = (message) => {
  console.log(`[LOG] [${new Date().toISOString()}] ${message}`);
  util.writeLog(${message},"AI TEXT"):
};