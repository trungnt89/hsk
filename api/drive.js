const { GoogleAuth } = require('google-auth-library');

export default async function handler(req, res) {
    // 1. Chỉ chấp nhận phương thức POST để upload
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    console.log("[LOG] Bắt đầu quá trình chuyển tiếp dữ liệu sang GAS...");

    try {
        const { name, base64Audio } = req.body;

        // 2. Xác thực Service Account (Lấy từ Environment Variables trên Vercel)
        // Bạn cần dán nội dung file JSON của Service Account vào biến SERVICE_ACCOUNT_KEY
        const auth = new GoogleAuth({
            credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        const accessToken = tokenResponse.token;

        // 3. Link GAS của bạn
        const gasUrl = "https://script.google.com/macros/s/AKfycbxHrD3vVhHGOfkmEteluf1EdkyKpeL3MvR6oerOYpLJIPC9KJSlxt9cJOOjwzbbF6_N/exec";

        // 4. Gửi dữ liệu sang GAS kèm theo mã xác thực Bearer Token
        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, base64Audio })
        });

        const result = await response.json();
        console.log("[LOG] GAS Response:", result);

        return res.status(200).json(result);

    } catch (err) {
        console.error("[LOG] Lỗi Server:", err.message);
        return res.status(500).json({ error: err.message });
    }
}

// Cấu hình giới hạn dung lượng file gửi lên (15MB)
export const config = {
    api: { bodyParser: { sizeLimit: '15mb' } }
};