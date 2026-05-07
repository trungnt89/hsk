const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

const CONFIG_URL = {
    GAS_API: "https://script.google.com/macros/s/AKfycbxHrD3vVhHGOfkmEteluf1EdkyKpeL3MvR6oerOYpLJIPC9KJSlxt9cJOOjwzbbF6_N/exec"
};

let cachedSheetsClient = null;

/**
 * Đảm bảo xác thực và trả về Sheets Client kèm theo đối tượng auth
 */
export async function ensureAuthenticated() {
    if (cachedSheetsClient) return cachedSheetsClient;
    
    const auth = new GoogleAuth({
        credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]
    });
    
    const client = await auth.getClient();
    cachedSheetsClient = google.sheets({ version: 'v4', auth: client });
    
    // Gắn ngược client auth vào để các dịch vụ khác (Drive) có thể tái sử dụng
    cachedSheetsClient.authInstance = client; 
    return cachedSheetsClient;
}

// 1. Lưu file thông qua GAS
export async function handleUploadFile(body) {
    const { name, base64Audio, lessionId } = body;
    const gasRes = await fetch(CONFIG_URL.GAS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, base64Audio, lessionId })
    });
    return await gasRes.json();
}

// 2. Lấy danh sách file (Sử dụng trực tiếp ensureAuthenticated)
export async function handleGetDriveFileByKw(keyword) {
    const sheets = await ensureAuthenticated();
    const drive = google.drive({ version: 'v3', auth: sheets.authInstance });
    
    let allFiles = [];
    let nextPageToken = null;
    let driveQuery = `trashed=false`;
    if (keyword) driveQuery += ` and name contains '_${keyword}_'`;

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

// 3. Xóa file thông qua fileID
export async function handleDeleteFile(fileId) {
    if (!fileId) throw new Error("Missing fileId");
    const gasRes = await fetch(CONFIG_URL.GAS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', fileId: fileId })
    });
    return await gasRes.json();
}

// 4. Trả về audio stream cho client (Sử dụng trực tiếp ensureAuthenticated)
export async function handleReadFileMedia(fileId, headers, res) {
    const sheets = await ensureAuthenticated();
    const drive = google.drive({ version: 'v4', auth: sheets.authInstance });
    
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
