// api/mazii.js
const axios = require('axios');

module.exports = async (req, res) => {
  // Thiết lập CORS và Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log(`[LOG] Method ${req.method} not allowed`);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  console.log("[LOG] Request body received:", JSON.stringify(req.body));

  try {
    const { query } = req.body;
    if (!query) {
      console.error("[ERROR] Missing query parameter in request body");
      return res.status(400).json({ error: "Missing query" });
    }

    const payload = {
      dict: "javi",
      limit: 5,
      page: 1,
      query: query,
      type: "word"
    };

    console.log(`[LOG] Calling Mazii API for query: "${query}"`);

    const response = await axios.post("https://mazii.net/api/search/word", payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
      }
    });

    console.log("[LOG] Mazii API responded status:", response.status);
    
    // Ghi log kiểm tra dữ liệu thô nhận được
    if (response.data && response.data.data && response.data.data.words) {
      console.log(`[LOG] Found ${response.data.data.words.length} words in "words" tag`);
    } else {
      console.log("[LOG] No data found in "words" tag");
    }

    return res.status(200).json(response.data);

  } catch (error) {
    console.error("[ERROR] Axios/Server Error:", error.message);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
};