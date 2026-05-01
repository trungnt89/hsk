const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');
const { Readable } = require('stream');

/**
 * FUNCTION MAIN (API HANDLER)
 */
export default async function handler(req, res) {
    try {
        const auth = new GoogleAuth({
            credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        const drive = await getDriveClient(auth);
        const { method, query, body, headers } = req;

        console.log(`[LOG] Action: ${method} - Query: ${JSON.stringify(query)}`);

        switch (method) {
            case 'GET':
                if (query.id) {
                    return await handleStreamMedia(drive, query.id, headers, res);
                }
                return await handleListFiles(drive, query.identifier, res);

            case 'POST':
                // Chuyển sang xử lý trực tiếp qua SA
                return await handleUploadFile(drive, body, res);

            case 'DELETE':
                // Chuyển sang xử lý trực tiếp qua SA
                return await handleDeleteFile(drive, query, res);

            default:
                res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
                return res.status(405).end(`Method ${method} Not Allowed`);
        }
    } catch (err) {
        console.error("[SERVER ERR]", err.message);
        return res.status(500).json({ error: err.message });
    }
}

/**
 * BỔ TRỢ 1: Khởi tạo Drive Client
 */
async function getDriveClient(auth) {
    const client = await auth.getClient();
    return google.drive({ version: 'v3', auth: client });
}

/**
 * BỔ TRỢ 2: Xóa file trực tiếp qua Service Account
 */
async function handleDeleteFile(drive, query, res) {
    const fileId = query.id || query.fileId;
    if (!fileId) return res.status(400).json({ error: "Missing fileId" });

    try {
        await drive.files.delete({ fileId: fileId });
        console.log(`[LOG] Delete file success for ID: ${fileId}`);
        return res.status(200).json({ status: 'success', fileId });
    } catch (err) {
        console.error(`[DELETE ERR]`, err.message);
        return res.status(500).json({ error: err.message });
    }
}

/**
 * BỔ TRỢ 3: Stream media (Giữ nguyên)
 */
async function handleStreamMedia(drive, fileId, headers, res) {
    const meta = await drive.files.get({ fileId: fileId, fields: 'size, mimeType' });
    const fileSize = meta.data.size;
    const range = headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        const response = await drive.files.get(
            { fileId: fileId, alt: 'media' },
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
        const response = await drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'stream' });
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Content-Type', meta.data.mimeType);
        return response.data.pipe(res);
    }
}

/**
 * BỔ TRỢ 4: Lấy danh sách file (Giữ nguyên)
 */
async function handleListFiles(drive, identifier, res) {
    let allFiles = [];
    let nextPageToken = null;
    let driveQuery = `trashed=false and (mimeType contains 'audio/' or mimeType contains 'video/')`;
    
    if (identifier) {
        driveQuery += ` and name contains 'id_${identifier}_'`;
    }

    do {
        const response = await drive.files.list({
            q: driveQuery,
            fields: 'nextPageToken, files(id, name, mimeType)',
            pageSize: 100,
            pageToken: nextPageToken
        });
        allFiles.push(...response.data.files);
        nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    return res.status(200).json(allFiles);
}

/**
 * BỔ TRỢ 5: Upload file trực tiếp qua Service Account
 */
async function handleUploadFile(drive, body, res) {
    const { name, base64Audio, identifier } = body;
    if (!base64Audio) return res.status(400).json({ error: "Missing base64 data" });

    try {
        // Chuyển base64 thành Stream
        const buffer = Buffer.from(base64Audio, 'base64');
        const bufferStream = new Readable();
        bufferStream.push(buffer);
        bufferStream.push(null);

        const fileMetadata = {
            name: `id_${identifier}_${name}`,
            parents: ['1Z-YuFfWP5bFhdBdXoXE4qiIlOMpoBB8_'] 
        };

        const media = {
            mimeType: 'audio/mpeg', // Mặc định audio, có thể điều chỉnh theo nhu cầu
            body: bufferStream,
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name',
        });

        console.log(`[LOG] Upload to Drive via SA success: ${response.data.name}`);
        return res.status(200).json(response.data);
    } catch (err) {
        console.error(`[UPLOAD ERR]`, err.message);
        return res.status(500).json({ error: err.message });
    }
}

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };
