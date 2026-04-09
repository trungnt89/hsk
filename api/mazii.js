const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { query, type } = req.body || {};
    if (!query) return res.status(400).json({ error: "Missing query" });

    let response;
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    };

    if (type === "kanji") {
      // API TRA CỨU KANJI CHI TIẾT
      console.log(`[KANJI] Tra cứu chi tiết: ${query}`);
      const url = `https://mazii.net/api/mazii/${encodeURIComponent(query)}/10`;
      response = await axios.get(url, { headers, timeout: 8000 });
    } else {
      // API TRA CỨU TỪ VỰNG (WORD)
      console.log(`[WORD] Tra cứu từ vựng: ${query}`);
      response = await axios.post("https://mazii.net/api/search/word", {
        dict: "javi",
        limit: 5,
        page: 1,
        query: query,
        type: "word"
      }, { headers, timeout: 8000 });
    }

    return res.status(200).json(response.data);

  } catch (error) {
    console.error("[CRITICAL ERROR]", error.message);
    return res.status(500).json({ error: "Mazii connection failed", message: error.message });
  }
};