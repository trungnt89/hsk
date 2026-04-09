// api/mazii.js
const axios = require('axios');

module.exports = async (req, res) => {
  // 1. Cấu hình CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 2. Kiểm tra Method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Chỉ chấp nhận phương thức POST" });
  }

  // 3. Thực thi chính
  try {
    const { query } = req.body || {};
    if (!query) {
      return res.status(400).json({ error: "Thiếu tham số query trong body" });
    }

    console.log(`[START] Đang tra từ: ${query}`);

    const response = await axios.post("https://mazii.net/api/search/word", {
      dict: "javi",
      limit: 5,
      page: 1,
      query: query,
      type: "word"
    }, {
      timeout: 8000, // 8 giây timeout để tránh treo function
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/110.0.0.0'
      }
    });

    console.log(`[SUCCESS] Mazii trả về data cho từ: ${query}`);
    return res.status(200).json(response.data);

  } catch (error) {
    // Ghi log chi tiết ra Vercel console để bạn check
    console.error("[CRITICAL ERROR]", error.response ? error.response.data : error.message);
    
    // Luôn trả về JSON thay vì để function bị crash
    return res.status(500).json({ 
      error: "Lỗi hệ thống hoặc Mazii từ chối kết nối",
      message: error.message 
    });
  }
};