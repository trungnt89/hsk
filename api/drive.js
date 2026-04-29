const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

export default async function handler(req, res) {
    try {
        const auth = new GoogleAuth({
            credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        const { method, query, body } = req;
        const FOLDER_ID = "1c5KXirMkSuPR5jIgNQrePlD2IX1FmIhW"; // ID thư mục mục tiêu

        // --- 1. PHÁT MEDIA (STREAM FILE) ---
        if (method === 'GET' && query.id) {
            const client = await auth.getClient();
            const drive = google.drive({ version: 'v3', auth: client });
            const response = await drive.files.get(
                { fileId: query.id, alt: 'media' },
                { responseType: 'stream' }
            );
            res.setHeader('Content-Type', response.headers['content-type']);
            return response.data.pipe(res);
        }

        // --- 2. LẤY TẤT CẢ FILE TRONG THƯ MỤC CHỈ ĐỊNH ---
        if (method === 'GET') {
            const client = await auth.getClient();
            const drive = google.drive({ version: 'v3', auth: client });
            
            let allFiles = [];
            let nextPageToken = null;

            do {
                const response = await drive.files.list({
                    // THAY ĐỔI TẠI ĐÂY: Thêm điều kiện 'parents' để giới hạn thư mục
                    q: `'${FOLDER_ID}' in parents and trashed=false and (mimeType contains 'audio/' or mimeType contains 'video/mp4')`,
                    fields: 'nextPageToken, files(id, name, mimeType)',
                    pageSize: 100,
                    pageToken: nextPageToken
                });
                allFiles.push(...response.data.files);
                nextPageToken = response.data.nextPageToken;
            } while (nextPageToken);

            return res.status(200).json(allFiles);
        }

        // --- 3. LƯU FILE QUA GAS ---
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
        console.error("[LOG] Lỗi Server:", err.message);
        return res.status(500).json({ error: err.message });
    }
}

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };