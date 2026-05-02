const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

/**
 * FUNCTION MAIN (API HANDLER)
 */
export default async function handler(req, res) {
    try {
        const auth = new GoogleAuth({
            credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
            scopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/spreadsheets.readonly'
            ]
        });

        const drive = await getDriveClient(auth);
        const { method, query, body, headers } = req;

        console.log(`[LOG] Action: ${method} - Query: ${JSON.stringify(query)}`);

        switch (method) {
            case 'GET':
                // 0. Xử lý lấy điểm số và phân tích theo lessonId (Yêu cầu mới)
                if (query.action === 'getScore' && query.lessonId) {
                    return await handleGetScoreByLesson(auth, query.lessonId, res);
                }
                // 1. Xử lý Stream (Nếu có ID)
                if (query.id) {
                    return await handleStreamMedia(drive, query.id, headers, res);
                }
                // 2. Xử lý danh sách (Mặc định)
                return await handleListFiles(drive, query.identifier, res);

            case 'POST':
                // 3. Xử lý Upload
                return await handleUploadFile(body, res);

            case 'DELETE':
                // 4. Xử lý xóa trực tiếp qua Method DELETE
                return await handleDeleteFile(query, res);

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
 * BỔ TRỢ 0: Lấy điểm số và phân tích từ Google Sheet qua SA
 */
async function handleGetScoreByLesson(auth, lessonId, res) {
    try {
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });
        const spreadsheetId = '1_OuLRGiUEzXUpMf-QmPeNYCQee0L1ueGAZcUvNELp8A';

        // 1. Tìm FileID từ sheet FileList dựa trên lessonId (Cột D)
        const fileListRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'FileList!A:D',
        });

        const fileRows = fileListRes.data.values || [];
        const fileRecord = fileRows.find(row => row[3] === lessonId);

        if (!fileRecord) {
            return res.status(404).json({ error: "No file found for this lessonId" });
        }

        const targetFileId = fileRecord[0];

        // 2. Lấy điểm và phân tích từ sheet Score dựa trên FileID (Cột A)
        const scoreRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Score!A:D',
        });

        const scoreRows = scoreRes.data.values || [];
        const scoreRecord = scoreRows.find(row => row[0] === targetFileId);

        if (!scoreRecord) {
            return res.status(200).json({ 
                fileId: targetFileId,
                score: null, 
                analysis: null,
                message: "Score not yet available"
            });
        }

        return res.status(200).json({
            fileId: targetFileId,
            score: (scoreRecord.length > 2 && scoreRecord[2] !== "") ? scoreRecord[2] : null,
            analysis: (scoreRecord.length > 3 && scoreRecord[3] !== "") ? scoreRecord[3] : null
        });

    } catch (err) {
        console.error("[SCORE ERR]", err.message);
        throw err;
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
 * BỔ TRỢ 2: Xóa file thông qua Google Apps Script (GAS)
 */
async function handleDeleteFile(query, res) {
    const fileId = query.id || query.fileId;
    if (!fileId) return res.status(400).json({ error: "Missing fileId" });

    const gasUrl = "https://script.google.com/macros/s/AKfycbxHrD3vVhHGOfkmEteluf1EdkyKpeL3MvR6oerOYpLJIPC9KJSlxt9cJOOjwzbbF6_N/exec";
    
    const gasRes = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', fileId: fileId })
    });

    const result = await gasRes.json();
    console.log(`[LOG] Delete file via GAS result for ID: ${fileId}`, result);
    return res.status(200).json(result);
}

/**
 * BỔ TRỢ 3: Stream media
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
 * BỔ TRỢ 4: Lấy danh sách file theo identifier
 */
async function handleListFiles(drive, identifier, res) {
    let allFiles = [];
    let nextPageToken = null;
    let driveQuery = `trashed=false and (mimeType contains 'audio/' or mimeType contains 'video/')`;
    
    if (identifier) {
        driveQuery += ` and name contains '_${identifier}_'`;
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
 * BỔ TRỢ 5: Upload file qua Google Apps Script
 */
async function handleUploadFile(body, res) {
    const { name, base64Audio, identifier } = body;
    const gasUrl = "https://script.google.com/macros/s/AKfycbxHrD3vVhHGOfkmEteluf1EdkyKpeL3MvR6oerOYpLJIPC9KJSlxt9cJOOjwzbbF6_N/exec";
    
    const gasRes = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, base64Audio, identifier })
    });
    
    const result = await gasRes.json();
    console.log(`[LOG] Upload to Drive via GAS success for: ${name}`);
    return res.status(200).json(result);
}

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };