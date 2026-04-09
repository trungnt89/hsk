// api/mazii.js
const axios = require('axios');

module.exports = async (req, res) => {
  // Cho phép CORS để HTML/JS từ domain khác có thể gọi tới (nếu cần)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  console.log("[LOG] Request body received:", JSON.stringify(req.body));

  try {
    const { query } = req.body;
    if (!query) {
      console.error("[ERROR] Missing query parameter");
      return res.status(400).json({ error: "Missing query" });
    }

    const payload = {
      dict: "javi",
      limit: 5,
      page: 1,
      query: query,
      type: "word"
    };

    console.log(`[LOG] Calling Mazii API for: ${query}`);

    const response = await axios.post("https://mazii.net/api/search/word", payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    console.log("[LOG] Mazii API responded successfully");
    return res.status(200).json(response.data);

  } catch (error) {
    console.error("[ERROR] Call failed:", error.message);
    return res.status(500).json({
      error: "Failed to fetch from Mazii",
      details: error.response ? error.response.data : error.message
    });
  }
};