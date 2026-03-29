// Hàm ghi log Backend chuẩn yêu cầu
function logBackend(message, data = '') {
    const timestamp = new Date().toISOString();
    console.log(`[VERCEL-API][${timestamp}] ${message}`, data);
}

export default async function handler(req, res) {
    const { id } = req.query;
    
    // Thay URL GAS của bạn vào đây
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbxCz3Ubtqok3fm0VYOJtwnvO5a39gKRPKEi2WvCM_bzV8Ami6b2c2IFbwFIF9EDwcxGsQ/exec';

    // TRƯỜNG HỢP 1: KHÔNG TRUYỀN ID -> THỰC HIỆN LẤY DANH SÁCH PLAYLIST
    if (!id) {
        logBackend('Đang gọi sang GAS để lấy danh sách file...');
        try {
            const response = await fetch(GAS_URL);
            const result = await response.json();
            return res.status(200).json(result);
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // TRƯỜNG HỢP 2: CÓ TRUYỀN ID -> GỌI GAS LẤY BASE64 VÀ TRẢ VỀ BINARY
    logBackend('Đang rút ruột video ID:', id);

    try {
        const gasRes = await fetch(`${GAS_URL}?type=getFileBlob&fileId=${id}`);
        
        if (!gasRes.ok) {
            throw new Error('Không thể kết nối tới Google Apps Script');
        }

        const json = await gasRes.json();

        if (json.status === "success" && json.data) {
            logBackend('Đã nhận Base64 từ GAS. Đang giải mã sang Buffer...');
            
            // Giải mã Base64 sang Binary Buffer
            const videoBuffer = Buffer.from(json.data, 'base64');

            // Thiết lập Header chuẩn phát video
            res.setHeader('Content-Type', 'video/mp4'); 
            res.setHeader('Content-Length', videoBuffer.length);
            res.setHeader('Cache-Control', 'public, max-age=3600, immutable');

            logBackend(`Thành công. Đã đẩy luồng binary (${videoBuffer.length} bytes) về Frontend.`);
            
            // Gửi dữ liệu binary thô về cho thẻ video
            return res.send(videoBuffer);
        } else {
            logBackend('LỖI: GAS không trả về data hợp lệ');
            return res.status(404).json({ error: 'Video không tồn tại hoặc lỗi từ GAS' });
        }

    } catch (error) {
        logBackend('CRASH:', error.message);
        return res.status(500).json({ error: 'Proxy failed', details: error.message });
    }
}