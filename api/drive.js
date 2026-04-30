import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';

// 1. Khởi tạo Auth bên ngoài handler để tái sử dụng (Connection Pooling)
const auth = new GoogleAuth({
    credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
    scopes: ['https://www.googleapis.com/auth/drive']
});

let driveClient = null;

async function getDriveInstance() {
    if (!driveClient) {
        const client = await auth.getClient();
        driveClient = google.drive({ version: 'v3', auth: client });
    }
    return driveClient;
}

// 2. Cache folder nằm ngoài handler để không bị reset giữa các request (trong cùng 1 instance)
const folderCache = new Map();

async function getFolderName(drive, folderId) {
    if (!folderId) return 'ROOT';
    if (folderCache.has(folderId)) return folderCache.get(folderId);

    try {
        const res = await drive.files.get({
            fileId: folderId,
            fields: 'name'
        });
        const name = res.data.name;
        folderCache.set(folderId, name);
        return name;
    } catch (err) {
        console.error(`Error fetching folder ${folderId}:`, err.message);
        return 'Unknown Folder';
    }
}

export default async function handler(req, res) {
    try {
        const drive = await getDriveInstance();
        const { method, query, body } = req;

        // ====================================================
        // GET ?id=xxxx → Download file (Streaming)
        // ====================================================
        if (method === 'GET' && query.id) {
            const response = await drive.files.get(
                { fileId: query.id, alt: 'media' },
                { responseType: 'stream' }
            );

            res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
            return response.data.pipe(res);
        }

        // ====================================================
        // GET → Lấy danh sách file & Group (Optimized)
        // ====================================================
        if (method === 'GET') {
            let allFiles = [];
            let nextPageToken = null;

            // Tối ưu: Lấy tối đa 1000 items/lần để giảm số round-trip network
            do {
                const response = await drive.files.list({
                    q: "trashed=false and (mimeType contains 'audio/' or mimeType='video/mp4')",
                    fields: 'nextPageToken, files(id, name, mimeType, parents)',
                    pageSize: 1000, 
                    pageToken: nextPageToken
                });

                if (response.data.files) {
                    allFiles.push(...response.data.files);
                }
                nextPageToken = response.data.nextPageToken;
            } while (nextPageToken);

            const groupedByFolder = {};

            // TỐI ƯU QUAN TRỌNG: Xử lý song song bằng Promise.all
            // Thay vì đợi từng file, ta bắn tất cả request lấy folder name cùng lúc
            await Promise.all(
                allFiles.map(async (file) => {
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
                })
            );

            return res.status(200).json({
                totalFiles: allFiles.length,
                data: groupedByFolder
            });
        }

        // ====================================================
        // POST → Upload qua GAS
        // ====================================================
        if (method === 'POST') {
            const { name, base64Audio } = body;
            const gasUrl = 'https://script.google.com/macros/s/.../exec';

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
        console.error('[SERVER ERR]', err);
        return res.status(500).json({ error: err.message });
    }
}

export const config = {
    api: {
        bodyParser: { sizeLimit: '15mb' }
    }
};
