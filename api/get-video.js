// Hàm ghi log đúng tiêu chuẩn bạn yêu cầu ở Backend
function logBackend(message, data = '') {
    const timestamp = new Date().toISOString();
    console.log(`[BACKEND][${timestamp}] ${message}`, data);
}

export default async function handler(req, res) {
    const { id } = req.query;
    
    if (!id) {
        logBackend('LỖI: Không nhận được file ID từ Client.');
        return res.status(400).send('Missing file ID');
    }

    logBackend('Đang xử lý request lấy video cho ID:', id);

    try {
        // 1. Gửi request ẩn danh đến Google Drive để lấy cookie xác nhận
        const driveUrl = `https://drive.google.com/uc?export=download&id=${id}`;
        const response = await fetch(driveUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const htmlText = await response.text();
        
        // 2. Tìm mã xác nhận "confirm" trong trường hợp file nặng > 100MB
        const confirmMatch = htmlText.match(/confirm=([a-zA-Z0-9_]+)/);
        
        let finalStreamUrl = driveUrl;
        
        if (confirmMatch && confirmMatch[1]) {
            const confirmToken = confirmMatch[1];
            logBackend('Phát hiện file nặng. Đã lấy mã xác nhận bypass thành công:', confirmToken);
            finalStreamUrl = `${driveUrl}&confirm=${confirmToken}`;
        } else {
            logBackend('File nhẹ hoặc link trực tiếp, không cần mã confirm.');
            finalStreamUrl = `${driveUrl}&confirm=no_antivirus`; // Thử ép bypass
        }

        // 3. Redirect (302) trình duyệt thẳng tới link stream gốc
        // Giúp Vercel không bị quá 10 giây xử lý mà vẫn tải được video nặng
        logBackend('Đẩy hướng dữ liệu thành công tới URL gốc.');
        return res.redirect(302, finalStreamUrl);
        
    } catch (error) {
        logBackend('LỖI Serverless nghiêm trọng:', error.message);
        return res.status(500).send('Internal Server Error');
    }
}