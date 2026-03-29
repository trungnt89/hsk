// Hàm ghi log Backend chuẩn yêu cầu
function logBackend(message, data = '') {
    const timestamp = new Date().toISOString();
    console.log(`[VERCEL-API][${timestamp}] ${message}`, data);
}

export default async function handler(req, res) {
    const { id } = req.query;
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbxCz3Ubtqok3fm0VYOJtwnvO5a39gKRPKEi2WvCM_bzV8Ami6b2c2IFbwFIF9EDwcxGsQ/exec';

    // TRƯỜNG HỢP 1: LẤY DANH SÁCH PLAYLIST
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

    // TRƯỜNG HỢP 2: CÓ ID -> CHUYỂN HƯỚNG SANG LINK TẢI TRỰC TIẾP (DIRECT DOWNLOAD)
    logBackend('Đang tạo link stream cho ID:', id);
    
    // Link này ép Google Drive nhả luồng Media trực tiếp cho thẻ <video>
    const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${id}`;
    
    logBackend('Đẩy hướng dữ liệu video thành công.');
    
    // Chuyển hướng trình duyệt sang link tải trực tiếp
    return res.redirect(302, directDownloadUrl);
}