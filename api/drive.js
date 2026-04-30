const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

export default async function handler(req, res) {
    try {
        const auth = new GoogleAuth({
            credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        const { method, query, body } = req;
        const ROOT_FOLDER_ID = "1c5KXirMkSuPR5jIgNQrePlD2IX1FmIhW";

        if (method === 'GET' && query.id) {
            const client = await auth.getClient();
            const drive = google.drive({ version: 'v3', auth: client });

            const meta = await drive.files.get({ fileId: query.id, fields: 'size, mimeType' });
            const fileSize = meta.data.size;
            const range = req.headers.range;

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;

                const response = await drive.files.get(
                    { fileId: query.id, alt: 'media' },
                    { responseType: 'stream', headers: { Range: `bytes=${start}-${end}` } }
                );

                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': meta.data.mimeType,
                });
                return response.data.pipe(res);
            } else {
                const response = await drive.files.get({ fileId: query.id, alt: 'media' }, { responseType: 'stream' });
                res.setHeader('Content-Length', fileSize);
                res.setHeader('Content-Type', meta.data.mimeType);
                return response.data.pipe(res);
            }
        }

        if (method === 'GET') {
            const client = await auth.getClient();
            const drive = google.drive({ version: 'v3', auth: client });
            
            // Lấy identifier từ query parameter
            const identifier = query.identifier;
            
            let allFiles = [];
            let nextPageToken = null;

            // Xây dựng query lọc: 
            // 1. Không nằm trong thùng rác
            // 2. Định dạng audio hoặc video
            // 3. Tên file phải chứa "id_{identifier}_" (nếu có identifier)
            let driveQuery = `trashed=false and (mimeType contains 'audio/' or mimeType contains 'video/')`;
            if (identifier) {
                driveQuery += ` and name contains 'id_${identifier}_'`;
            }

            do {
                const response = await drive.files.list({
                    q: driveQuery,
                    fields: 'nextPageToken, files(id, name, mimeType, parents)',
                    pageSize: 100,
                    pageToken: nextPageToken
                });
                
                allFiles.push(...response.data.files);
                nextPageToken = response.data.nextPageToken;
            } while (nextPageToken);

            return res.status(200).json(allFiles);
        }

        if (method === 'POST') {
            const { name, base64Audio, identifier } = body; // Nhận thêm identifier từ body
            const gasUrl = "https://script.google.com/macros/s/AKfycbxHrD3vVhHGOfkmEteluf1EdkyKpeL3MvR6oerOYpLJIPC9KJSlxt9cJOOjwzbbF6_N/exec";
            const gasRes = await fetch(gasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, base64Audio, identifier })
            });
            const result = await gasRes.json();
            return res.status(200).json(result);
        }
    } catch (err) {
        console.error("[ERR]", err.message);
        return res.status(500).json({ error: err.message });
    }
}

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };
