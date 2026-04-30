
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';

const ROOT_FOLDER_ID = '1c5KXirMkSuPR5jIgNQrePlD2IX1FmIhW';

// ===== Cache folder name để tối ưu =====
const folderCache = new Map();

async function getFolderName(drive, folderId) {
    if (!folderId) return 'ROOT';

    if (folderCache.has(folderId)) {
        return folderCache.get(folderId);
    }

    const res = await drive.files.get({
        fileId: folderId,
        fields: 'id, name'
    });

    folderCache.set(folderId, res.data.name);
    return res.data.name;
}

export default async function handler(req, res) {
    try {
        const auth = new GoogleAuth({
            credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        const client = await auth.getClient();
        const drive = google.drive({ version: 'v3', auth: client });

        const { method, query, body } = req;

        // ====================================================
        // GET ?id=xxxx  → Download file
        // ====================================================
        if (method === 'GET' && query.id) {
            const response = await drive.files.get(
                { fileId: query.id, alt: 'media' },
                { responseType: 'stream' }
            );

            res.setHeader(
                'Content-Type',
                response.headers['content-type'] || 'application/octet-stream'
            );
            return response.data.pipe(res);
        }

        // ====================================================
        // GET → Lấy danh sách file & group theo folder
        // ====================================================
        if (method === 'GET') {
            let allFiles = [];
            let nextPageToken = null;

            do {
                const response = await drive.files.list({
                    q: `
                        trashed=false
                        and (
                            mimeType contains 'audio/'
                            or mimeType='video/mp4'
                        )
                    `,
                    fields: 'nextPageToken, files(id, name, mimeType, parents)',
                    pageSize: 100,
                    pageToken: nextPageToken
                });

                allFiles.push(...response.data.files);
                nextPageToken = response.data.nextPageToken;
            } while (nextPageToken);

            // ===== Group file theo folder =====
            const groupedByFolder = {};

            for (const file of allFiles) {
                const parentId = file.parents?.[0];
                const folderName = await getFolderName(drive, parentId);

                if (!groupedByFolder[folderName]) {
                    groupedByFolder[folderName] = [];
                }

                groupedByFolder[folderName].push({
                    id: file.id,
                    name: file.name,
                    mimeType: file.mimeType,
                    folderId: parentId
                });
            }

            return res.status(200).json({
                totalFiles: allFiles.length,
                data: groupedByFolder
            });
        }

        // ====================================================
        // POST → Upload audio (giữ nguyên như bạn)
        // ====================================================
        if (method === 'POST') {
            const { name, base64Audio } = body;

            const gasUrl =
                'https://script.google.com/macros/s/AKfycbxHrD3vVhHGOfkmEteluf1EdkyKpeL3MvR6oerOYpLJIPC9KJSlxt9cJOOjwzbbF6_N/exec';

            const gasRes = await fetch(gasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, base64Audio })
            });

            const result = await gasRes.json();
            return res.status(200).json(result);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('[ERR]', err);
        return res.status(500).json({ error: err.message });
    }
}

export const config = {
    api: {
        bodyParser: { sizeLimit: '15mb' }
    }
};
