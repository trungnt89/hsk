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
                if (query.action === 'getScore' && query.lessonId) {
                    return await handleGetScoreByLesson(auth, query.lessonId, res);
                }
                if (query.id) {
                    return await handleStreamMedia(drive, query.id, headers, res);
                }
                // Mặc định lấy list file kèm điểm số, lessionId đóng vai trò LessonID
                return await handleListFilesWithScores(drive, auth, query.lessionId, res);

            case 'POST':
                return await handleUploadFile(body, res);

            case 'DELETE':
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
 * Lấy dữ liệu điểm số từ Sheets (Có lọc theo LessonID nếu có)
 */
async function fetchAllScores(auth, lessonId = null) {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const spreadsheetId = '1_OuLRGiUEzXUpMf-QmPeNYCQee0L1ueGAZcUvNELp8A';
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'ScoreList!A:F', 
    });
    
    const rows = response.data.values || [];
    if (lessonId) {
        // Lọc dữ liệu dựa trên LessonID ở cột A (index 0)
        return rows.filter(row => row[0] === lessonId);
    }
    return rows;
}

/**
 * BỔ TRỢ 0: Lấy điểm số lẻ theo lessonId
 */
async function handleGetScoreByLesson(auth, lessonId, res) {
    try {
        const rows = await fetchAllScores(auth, lessonId);
        const record = rows[0]; // Vì đã lọc nên lấy phần tử đầu tiên

        if (!record) {
            return res.status(404).json({ error: "No record found for this lessonId" });
        }

        return res.status(200).json({
            lessonId: record[0],
            fileId: record[1] || null,
            score: (record.length > 3 && record[3] !== "") ? record[3] : null,
            analysis: (record.length > 4 && record[4] !== "") ? record[4] : null
        });
    } catch (err) {
        console.error("[SCORE ERR]", err.message);
        return res.status(500).json({ error: err.message });
    }
}

/**
 * FUNCTION TỔNG: Mapping danh sách file với điểm số
 */
async function handleListFilesWithScores(drive, auth, lessionId, res) {
    try {
        // lessionId ở đây chính là LessonID dùng để lọc Sheet
        const [files, scoreRows] = await Promise.all([
            fetchFiles(drive, lessionId),
            fetchAllScores(auth, lessionId)
        ]);

        const scoreMap = new Map();
        scoreRows.forEach(row => {
            if (row[1]) { // row[1] là FileID
                scoreMap.set(row[1], {
                    score: (row.length > 3 && row[3] !== "") ? row[3] : null,
                    analysis: (row.length > 4 && row[4] !== "") ? row[4] : null
                });
            }
        });

        const combined = files.map(file => {
            const scoreData = scoreMap.get(file.id) || { score: null, analysis: null };
            return { ...file, ...scoreData };
        });

        return res.status(200).json(combined);
    } catch (err) {
        console.error("[LIST SCORE ERR]", err.message);
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
 * BỔ TRỢ 2: Xóa file
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
 * BỔ TRỢ 4: Fetch dữ liệu file raw từ Drive
 */
async function fetchFiles(drive, lessionId) {
    let allFiles = [];
    let nextPageToken = null;
    let driveQuery = `trashed=false and (mimeType contains 'audio/' or mimeType contains 'video/')`;
    if (lessionId) driveQuery += ` and name contains '_${lessionId}_'`;

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
    return allFiles;
}

async function handleListFiles(drive, lessionId, res) {
    const files = await fetchFiles(drive, lessionId);
    return res.status(200).json(files);
}

/**
 * BỔ TRỢ 5: Upload file
 */
async function handleUploadFile(body, res) {
    const { name, base64Audio, lessionId } = body;
    const gasUrl = "https://script.google.com/macros/s/AKfycbxHrD3vVhHGOfkmEteluf1EdkyKpeL3MvR6oerOYpLJIPC9KJSlxt9cJOOjwzbbF6_N/exec";
    const gasRes = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, base64Audio, lessionId })
    });
    const result = await gasRes.json();
    return res.status(200).json(result);
}

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };