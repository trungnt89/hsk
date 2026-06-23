export default async function handler(req, res) {
    // 1. Cấu hình CORS Headers cho phép Client gửi dữ liệu từ mọi nguồn (hoặc tên miền của bạn)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Trong production, bạn có thể thay đổi '*' thành URL cụ thể của app
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // 2. Xử lý yêu cầu xác thực CORS Preflight (Trả về trạng thái 200 OK ngay lập tức)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 3. Chỉ chấp nhận phương thức POST cho luồng Login
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: `Method ${req.method} not allowed` });
    }

    try {
        // 4. Đề phòng trường hợp `req.body` bị nhận là String thô (chưa được Serverless tự động parse JSON)
        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                return res.status(400).json({ success: false, error: "Invalid JSON format in body" });
            }
        }

        const { token } = body || {};

        if (!token) {
            return res.status(400).json({ success: false, error: "Token is required" });
        }

        // Kiểm tra Token với mã bí mật cấu hình trên biến môi trường PWTOKEN của Vercel
        if (token !== process.env.PWTOKEN) {
            return res.status(401).json({ success: false, error: "Invalid token" });
        }

        // Xác thực chính xác thành công!
        return res.status(200).json({ success: true });
        
    } catch (error) {
        console.error("Auth API Error:", error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}
