const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

export default async function handler(req, res) {
    try {
        const auth = new GoogleAuth({
            credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        const { method, query, body } = req;

        // --- TRƯỜNG HỢP 1: PHÁT MEDIA (GET với ID) ---
        if (method === 'GET' && query.id) {
            console.log(`[LOG] Đang stream file: ${query.id}`);
            const client = await auth.getClient();
            const drive = google.drive({ version: 'v3', auth: client });

            const response = await drive.files.get(
                { fileId: query.id, alt: 'media' },
                { responseType: 'stream' }
            );

            // Chuyển tiếp các Header quan trọng
            res.setHeader('Content-Type', response.headers['content-type']);
            return response.data.pipe(res);
        }

        // --- TRƯỜNG HỢP 2: LẤY DANH SÁCH FILE (GET không ID) ---
        if (method === 'GET') {
            const client = await auth.getClient();
            const drive = google.drive({ version: 'v3', auth: client });
            const response = await drive.files.list({
                q: "trashed=false and (mimeType contains 'audio/' or mimeType contains 'video/mp4')",
                fields: 'files(id, name, mimeType)',
                pageSize: 50
            });
            return res.status(200).json(response.data.files);
        }

        // --- TRƯỜNG HỢP 3: LƯU FILE QUA GAS (POST) ---
        if (method === 'POST') {
            const { name, base64Audio } = body;
            const gasUrl = "https://script.google.com/macros/s/AKfycbxHrD3vVhHGOfkmEteluf1EdkyKpeL3MvR6oerOYpLJIPC9KJSlxt9cJOOjwzbbF6_N/exec";
            const gasRes = await fetch(gasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, base64Audio })
            });
            const result = await gasRes.json();
            return res.status(200).json(result);
        }
    } catch (err) {
        console.error("[LOG] Lỗi:", err.message);
        return res.status(500).json({ error: err.message });
    }
}
export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };