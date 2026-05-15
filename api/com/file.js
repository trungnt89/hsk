const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

const CONFIG_URL = {
	// VoiceRecorder22
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


// -----------------------------------------------------
// READ FILE THÔNG QUA SA
// -----------------------------------------------------
export async function handleCheckFileExist(fileName) {
    console.log(`[LOG] Checking cache on Drive for name: ${fileName}`);
    const { drive } = await ensureAuthenticated();
    
    try {
        // Tìm kiếm chính xác tên file (dùng '=' thay vì 'contains' để tránh lấy nhầm file tương tự)
        const response = await drive.files.list({
            q: `name = '${fileName}' and trashed = false`,
            fields: 'files(id, name)',
            pageSize: 1
        });

        const file = response.data.files[0];
        
        if (file) {
            console.log(`[LOG] Cache Hit: ${file.name} [${file.id}]`);
            return file; // Trả về object {id, name}
        }

        console.log(`[LOG] Cache Miss: ${fileName}`);
        return null;
    } catch (error) {
        console.error(`[ERROR] handleCheckFileExist failure: ${error.message}`);
        return null;
    }
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

export async function handleGetDriveFilesByFolderId(folderId) {
    console.log(`[LOG] Get files from: ${folderId}`);
    const { drive } = await ensureAuthenticated();
    let allFiles = [], nextPageToken = null;
    do {
        const res = await drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            fields: 'nextPageToken, files(id, name, mimeType)',
            pageToken: nextPageToken
        });
        allFiles.push(...res.data.files);
        nextPageToken = res.data.nextPageToken;
        console.log(`[LOG] Found ${allFiles.length} files`);
    } while (nextPageToken);
    return allFiles;
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
// -----------------------------------------------------
// ADD, DELETE FILE THÔNG QUA GAS
// -----------------------------------------------------


export async function handleUploadFile(body) {
	//body.name
	//body.base64
	//body.lessionId
    console.log(`[LOG] Gửi yêu cầu create file đến GAS`);
	console.log(body);
    const gasRes = await fetch(CONFIG_URL.GAS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body})
    });
    return await gasRes.json();
}

// 1. Lưu file thông qua GAS
export async function handleUploadRecorder(body) {
    const gasRes = await fetch(CONFIG_URL.GAS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, action: 'upload_record' })
    });
    return await gasRes.json();
}


export async function handleUploadTTS(body) {
	//body.name
	//body.base64
	//body.lessionId
    console.log(`[LOG] Gửi yêu cầu create file đến GAS`);
	console.log(body);
    const gasRes = await fetch(CONFIG_URL.GAS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, action: 'upload_tts_audio' })
    });
    return await gasRes.json();
}

// 3. Xóa file thông qua fileID
export async function handleDeleteFile(body) {
	fileId = body.fileId;
    if (!fileId) throw new Error("Missing fileId");
    const gasRes = await fetch(CONFIG_URL.GAS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_record', fileId: fileId })
    });
    return await gasRes.json();
}
// -----------------------------------------------------
// -----------------------------------------------------