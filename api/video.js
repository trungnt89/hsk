// Hàm ghi log Backend chuẩn yêu cầu
function logBackend(message, data = '') {
    const timestamp = new Date().toISOString();
    console.log(`[VERCEL-API][${timestamp}] ${message}`, data);
}

export default async function handler(req, res) {
    const { id } = req.query;
    
    // URL GAS của bạn
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

    // TRƯỜNG HỢP 2: CÓ TRUYỀN ID -> STREAM TRỰC TIẾP QUA GOOGLE DRIVE
    logBackend('Đang chuẩn bị stream video ID:', id);

    try {
        // Trình duyệt sẽ bám theo link này để nhận luồng video chuẩn MP4 có thể tua và bắt sự kiện onended
        const directStreamUrl = `https://drive.google.com/uc?export=download&id=${id}`;
        
        logBackend('Tạo link stream thành công. Chuyển hướng trình duyệt...');
        
        return res.redirect(302, directStreamUrl);

    } catch (error) {
        logBackend('CRASH:', error.message);
        return res.status(500).json({ error: 'Proxy failed', details: error.message });
    }
}