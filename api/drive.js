const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

export default async function handler(req, res) {
    try {
        // Khởi tạo xác thực Service Account
        const auth = new GoogleAuth({
            credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        // --- TRƯỜNG HỢP 1: LẤY DANH SÁCH FILE (GET) ---
        if (req.method === 'GET') {
            console.log("[LOG] Đang lấy danh sách file audio/mp4 từ Drive...");
            const client = await auth.getClient();
            const drive = google.drive({ version: 'v3', auth: client });

            const response = await drive.files.list({
                // Lấy tất cả audio và mp4
                q: "trashed=false and (mimeType contains 'audio/' or mimeType contains 'video/mp4')",
                fields: 'files(id, name, mimeType)',
                pageSize: 100
            });
            return res.status(200).json(response.data.files);
        }

        // --- TRƯỜNG HỢP 2: LƯU FILE QUA GAS (POST) ---
        if (req.method === 'POST') {
            console.log("[LOG] Đang chuyển tiếp file sang GAS...");
            const { name, base64Audio } = req.body;
            const gasUrl = "https://script.google.com/macros/s/AKfycbxHrD3vVhHGOfkmEteluf1EdkyKpeL3MvR6oerOYpLJIPC9KJSlxt9cJOOjwzbbF6_N/exec";

            const gasResponse = await fetch(gasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, base64Audio })
            });

            const result = await gasResponse.json();
            return res.status(200).json(result);
        }

        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (err) {
        console.error("[LOG] Lỗi hệ thống:", err.message);
        return res.status(500).json({ error: err.message });
    }
}

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };