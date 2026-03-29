// Hàm ghi log Backend đúng chuẩn yêu cầu
function logBackend(message, data = '') {
    const timestamp = new Date().toISOString();
    console.log(`[VERCEL-API][${timestamp}] ${message}`, data);
}

export default async function handler(req, res) {
    const { id } = req.query;
    
    // TRƯỜNG HỢP 1: KHÔNG TRUYỀN ID -> THỰC HIỆN LẤY DANH SÁCH PLAYLIST
    if (!id) {
        const GAS_URL = "https://script.google.com/macros/s/AKfycby0kzPC-MjF90ATSyYAvoSNlJRlY0hKNXrlKJbRFb_z_5ZqpYIGHI18In4Eu3yQmmrq_A/exec";

        logBackend('Đang gọi sang GAS để lấy danh sách file...');

        try {
            const response = await fetch(GAS_URL);
            const result = await response.json();
            
            logBackend('Đã nhận phản hồi từ GAS. Số lượng file:', result.data ? result.data.length : 0);
            return res.status(200).json(result);
        } catch (error) {
            logBackend('LỖI khi gọi GAS:', error.message);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // TRƯỜP HỢP 2: CÓ TRUYỀN ID -> THỰC HIỆN XỬ LÝ STREAM VIDEO
    logBackend('Đang xử lý tạo link stream cho ID:', id);

    try {
        const driveUrl = `https://drive.google.com/uc?export=download&id=${id}`;
        
        // Gửi request ẩn danh đến Drive để check xem file có bị cảnh báo virus không
        const response = await fetch(driveUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        const htmlText = await response.text();
        const confirmMatch = htmlText.match(/confirm=([a-zA-Z0-9_]+)/);
        
        let finalStreamUrl = driveUrl;
        
        if (confirmMatch && confirmMatch[1]) {
            logBackend('Phát hiện file nặng. Đã lấy mã confirm bẻ khóa.');
            finalStreamUrl = `${driveUrl}&confirm=${confirmMatch[1]}`;
        } else {
            logBackend('File nhẹ, ép luồng trực tiếp.');
            finalStreamUrl = `${driveUrl}&confirm=no_antivirus`;
        }

        // REDIRECT (302) người dùng tới link sạch của Drive
        logBackend('Đẩy hướng dữ liệu video thành công.');
        return res.redirect(302, finalStreamUrl);
        
    } catch (error) {
        logBackend('LỖI Serverless:', error.message);
        return res.status(500).send('Internal Server Error');
    }
}