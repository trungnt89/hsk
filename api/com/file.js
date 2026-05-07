const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

const CONFIG_URL = {
    GAS_API: "https://script.google.com/macros/s/AKfycbxHrD3vVhHGOfkmEteluf1EdkyKpeL3MvR6oerOYpLJIPC9KJSlxt9cJOOjwzbbF6_N/exec"
};

// Khởi tạo các biến cache
let cachedSheetsClient = null;
let cachedDriveClient = null;

/**
 * Đảm bảo xác thực và khởi tạo sẵn cả Sheets và Drive Client
 */
export async function ensureAuthenticated() {
    // Nếu cả hai đã được khởi tạo thì trả về đối tượng chứa cả hai
    if (cachedSheetsClient && cachedDriveClient) {
        return { sheets: cachedSheetsClient, drive: cachedDriveClient };
    }
    
    const auth = new GoogleAuth({
        credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]
    });
    
    const client = await auth.getClient();
    
    // Khởi tạo và lưu vào cache
    cachedSheetsClient = google.sheets({ version: 'v4', auth: client });
    cachedDriveClient = google.drive({ version: 'v3', auth: client });
    
    return { sheets: cachedSheetsClient, drive: cachedDriveClient };
}

// 1. Lưu file thông qua GAS
export async function handleUploadRecorder(body) {
    const gasRes = await fetch(CONFIG_URL.GAS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, action: 'upload' })
    });
    return await gasRes.json();
}


export async function handleUploadFile(filename, base64) {
    console.log(`[LOG] Bắt đầu upload file: ${filename}`);
    const { drive } = await ensureAuthenticated();
    const buffer = Buffer.from(base64, 'base64');
    const { Readable } = require('stream');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const response = await drive.files.create({
        requestBody: { name: filename },
        media: { body: stream }
    });
    console.log(`[LOG] Upload thành công, fileID: ${response.data.id}`);
    return response.data.id;
}

export async function handleCheckFileExist(fileName) {
    console.log(`[LOG] Kiểm tra tồn tại file: ${fileName}`);
    const { drive } = await ensureAuthenticated();
    const response = await drive.files.list({
        q: `name contains '${fileName}' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 1
    });
    const file = response.data.files[0];
    if (file) {
        console.log(`[LOG] File tồn tại. ID: ${file.id}`);
        return file.id;
    }
    console.log(`[LOG] File không tồn tại.`);
    return "";
}

// 2. Lấy danh sách file (Sử dụng cachedDriveClient từ ensureAuthenticated)
export async function handleGetDriveFileByKw(keyword) {
    const { drive } = await ensureAuthenticated();
    
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

// 4. Trả về audio stream cho client (Sử dụng cachedDriveClient từ ensureAuthenticated)
export async function handleReadFileMedia(fileId, headers, res) {
    const { drive } = await ensureAuthenticated();
    
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