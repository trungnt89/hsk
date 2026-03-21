export default async function handler(req, res) {
  try {
    // 1️⃣ Lấy fileId từ query params
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const fullUrl = new URL(req.url, `${protocol}://${host}`);
    
    const fileId = fullUrl.searchParams.get('fileId');
    // Thay URL GAS của bạn vào đây
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec';

    if (!fileId) {
      return res.status(400).json({ error: 'Missing fileId parameter' });
    }

    console.log(`\n=== [GET VOICE REQUEST] ===`);
    console.log(`> File ID: ${fileId}`);

    // 2️⃣ Gọi GAS để lấy dữ liệu Base64 của file
    console.log(`[STEP 1] Fetching from Google Drive via GAS...`);
    const gasRes = await fetch(`${GAS_URL}?type=getFileBlob&fileId=${fileId}`);
    
    if (!gasRes.ok) {
      throw new Error('Failed to connect to GAS');
    }

    const json = await gasRes.json();

    if (json.status === "success" && json.data) {
      console.log(`[STEP 2] File found. Converting Base64 to Buffer...`);
      
      // 3️⃣ Giải mã Base64 sang Binary Buffer
      const audioBuffer = Buffer.from(json.data, 'base64');

      // 4️⃣ Thiết lập Header chuẩn cho iPhone/Safari
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Audio-Source', 'Google-Drive-Proxy');

      console.log(`[RESULT] Success. Sending binary audio (${audioBuffer.length} bytes)`);
      
      // Gửi binary trực tiếp
      return res.send(audioBuffer);
    } else {
      console.error(`[ERROR] GAS returned error: ${json.error || 'Unknown'}`);
      return res.status(404).json({ error: 'File not found or GAS error' });
    }

  } catch (e) {
    console.error(`[CRASH] Global Exception: ${e.message}`);
    res.status(500).json({ error: 'Proxy failed', details: e.message });
  }
}