const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');
const { Readable } = require('stream');

export default async function handler(req, res) {
    try {
        const auth = new GoogleAuth({
            credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        const drive = await getDriveClient(auth);
        const { method, query, body, headers } = req;

        switch (method) {
            case 'GET':
                if (query.id) return await handleStreamMedia(drive, query.id, headers, res);
                return await handleListFiles(drive, query.identifier, res);

            case 'POST':
                // Truyền thêm drive vào hàm upload
                return await handleUploadFileDirect(drive, body, res);

            case 'DELETE':
                // Xóa trực tiếp bằng drive client
                return await handleDeleteFileDirect(drive, query, res);

            default:
                res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
                return res.status(405).end(`Method ${method} Not Allowed`);
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

async function getDriveClient(auth) {
    const client = await auth.getClient();
    return google.drive({ version: 'v3', auth: client });
}

/**
 * UPLOAD TRỰC TIẾP (Thay thế GAS)
 */
async function handleUploadFileDirect(drive, body, res) {
    const { name, base64Audio, identifier } = body;
    
    // ID Folder của tài khoản cá nhân đã share cho SA
    const FOLDER_ID = 'ID_FOLDER_CUA_BAN'; 

    const buffer = Buffer.from(base64Audio, 'base64');
    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null);

    const response = await drive.files.create({
        requestBody: {
            name: `id_${identifier}_${name}`,
            parents: [FOLDER_ID] 
        },
        media: {
            mimeType: 'audio/mpeg',
            body: bufferStream,
        },
        fields: 'id, name'
    });

    return res.status(200).json(response.data);
}

/**
 * XÓA TRỰC TIẾP (Thay thế GAS)
 */
async function handleDeleteFileDirect(drive, query, res) {
    const fileId = query.id || query.fileId;
    if (!fileId) return res.status(400).json({ error: "Missing fileId" });

    try {
        // Dùng .delete để xóa vĩnh viễn hoặc .update({trashed: true}) để vào thùng rác
        await drive.files.delete({ fileId: fileId });
        return res.status(200).json({ success: true, message: `Deleted ${fileId}` });
    } catch (err) {
        return res.status(500).json({ error: "Delete failed: " + err.message });
    }
}

// Các hàm handleStreamMedia và handleListFiles giữ nguyên như code cũ của bạn...
