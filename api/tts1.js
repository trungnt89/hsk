/**
 * =========================================================
 * Azure Text-to-Speech Serverless API (Vercel / Node.js)
 * =========================================================
 *
 * 📌 MÔ TẢ
 * - API đọc text → audio bằng Azure Speech TTS
 * - Hỗ trợ đa ngôn ngữ, đa giọng (NAM / NỮ)
 * - Nếu KHÔNG truyền tham số → mặc định:
 *     🇨🇳 Tiếng Trung (zh-CN) – Giọng NỮ
 *
 * =========================================================
 * 📌 CẤU HÌNH ENV (bắt buộc)
 *
 * AZURE_TTS_ENDPOINT=https://<region>.tts.speech.microsoft.com
 * AZURE_TTS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *
 * =========================================================
 * 📌 QUERY PARAMS
 *
 * text   : nội dung cần đọc (URL encoded)
 * lang   : mã ngôn ngữ (vd: zh-CN, ja-JP, en-US)
 * voice  : giọng đọc Azure Neural (NAM / NỮ)
 * format : (optional) format audio
 *
 * =========================================================
 * 📌 GIỌNG ĐỌC MẪU (NAM / NỮ)
 *
 * 🇨🇳 Chinese (zh-CN)
 *   - Nữ : zh-CN-XiaoxiaoNeural
 *   - Nam: zh-CN-YunxiNeural
 *
 * 🇯🇵 Japanese (ja-JP)
 *   - Nữ : ja-JP-NanamiNeural
 *   - Nam: ja-JP-KeitaNeural
 *
 * 🇺🇸 English (en-US)
 *   - Nữ : en-US-JennyNeural
 *   - Nam: en-US-GuyNeural
 *
 * =========================================================
 * 📌 VÍ DỤ GỌI API
 *
 * 🇨🇳 Trung – Giọng NỮ (default)
 * /api/tts?text=你好
 *
 * 🇨🇳 Trung – Giọng NAM
 * /api/tts?text=你好&voice=zh-CN-YunxiNeural
 *
 * 🇯🇵 Nhật – Giọng NỮ
 * /api/tts?text=こんにちは&lang=ja-JP&voice=ja-JP-NanamiNeural
 *
 * 🇺🇸 Anh – Giọng NAM
 * /api/tts?text=Hello&lang=en-US&voice=en-US-GuyNeural
 *
 * =========================================================
 */

export default async function handler(req, res) {
  try {
    // ===============================
    // 1️⃣ DEFAULT: Chinese – Female
    // ===============================
    const {
      text = '你好',
      lang = 'zh-CN',
      voice = 'zh-CN-XiaoxiaoNeural', // 👈 mặc định giọng NỮ
      format = 'audio-16khz-32kbitrate-mono-mp3'
    } = req.query;

    // ===============================
    // 2️⃣ ENV
    // ===============================
    let endpoint = process.env.AZURE_TTS_ENDPOINT;
    const key = process.env.AZURE_TTS_KEY;

    if (!endpoint || !key) {
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    if (endpoint.includes('api.cognitive.microsoft.com')) {
      return res.status(500).json({
        error: 'Invalid Azure TTS endpoint. Use *.tts.speech.microsoft.com'
      });
    }

    endpoint = endpoint.replace(/\/$/, '');
    const ttsUrl = `${endpoint}/cognitiveservices/v1`;

    // ===============================
    // 3️⃣ SSML
    // ===============================
    const ssml = `
<speak version="1.0" xml:lang="${lang}">
  <voice name="${voice}">
    ${escapeXml(text)}
  </voice>
</speak>`;

    // ===============================
    // 4️⃣ CALL AZURE
    // ===============================
    const response = await fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': format
      },
      body: ssml
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).send(err);
    }

    // ===============================
    // 5️⃣ RESPONSE
    // ===============================
    const audio = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audio));

  } catch (e) {
    console.error('TTS crash:', e);
    res.status(500).json({ error: 'TTS failed' });
  }
}

/**
 * Escape XML để tránh lỗi SSML
 */
function escapeXml(str) {
  return str.replace(/[<>&'"]/g, c => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  }[c]));
}
