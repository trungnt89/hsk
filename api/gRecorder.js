const util = require('./com/file');

const SPREADSHEET_ID = "1_OuLRGiUEzXUpMf-QmPeNYCQee0L1ueGAZcUvNELp8A";

const config = { api: { bodyParser: { sizeLimit: '15mb' } } };

async function handler(req, res) {
    // Trích xuất an toàn để tránh lỗi "Cannot read properties of undefined"
    const method = req.method;
    const headers = req.headers;
    const query = req.query || {};
    const body = req.body || {};

    let action = query.action || body.action;
    let name = query.name || body.name;
	

	let lessionId = query.lessionId || body.lessionId;
	let folderId = query.folderId || body.folderId;	
	body.fileId = body.fileId || query.fileId;
	
    let result;

    // Ghi log để giám sát hệ thống
    console.log(`[${new Date().toISOString()}] Action: ${action} | Name: ${name}`);

    try {
        switch (action) {
			case 'check':
                console.log(`[LOG] Checking cache for file: ${name}`);
                const fileInfo = await util.handleCheckFileExist(name);
                
                if (fileInfo && fileInfo.id) {
                    console.log(`[LOG] Cache HIT. Streaming file ID: ${fileInfo.id}`);
                    // Thực hiện streaming audio trực tiếp cho client
                    return await util.handleReadFileMedia(fileInfo.id, headers, res);
                } else {
                    console.log(`[LOG] Cache MISS for file: ${name}`);
                    // Trả về 404 để Client (Edge Function) biết cần gọi Azure TTS
                    return res.status(404).json({ exists: false, message: "File not found" });
                }

            case 'audio':
                console.log(`[LOG] Streaming audio ID: ${fileId}`);
                return await util.handleReadFileMedia(fileId, headers, res);
            case 'list':
                result = await handleListAction(lessionId);
                return res.status(200).json(result);
			case 'byfolder':
                result = await util.handleGetDriveFilesByFolderId(folderId);
                return res.status(200).json(result);
			// Send To GAS
            case 'uploadRecorder':
                console.log(`[LOG] Processing Upload Recorder`);
                result = await util.handleSendToGAS(body);
                return res.status(200).json(result);
			
            case 'uploadAudioTTS':
                console.log(`[LOG] Processing Upload TTS`);
                result = await util.handleSendToGAS(body);
                return res.status(200).json(result);
			case 'uploadImage':
                console.log(`[LOG] Processing Upload TTS`);
                result = await util.handleSendToGAS(body);
                return res.status(200).json(result);
            case 'delete':
                console.log(`[LOG] Deleting file`);
                result = await util.handleSendToGAS(body);
                return res.status(200).json(result);

            default:
                console.warn(`[WARN] Unknown action: ${action}`);
                return res.status(400).json({ error: "Invalid or missing action" });
        }
    } catch (err) {
        console.error(`[FATAL ERROR] at ${action}:`, err.stack);
        return res.status(500).json({ error: err.message });
    }
}

module.exports = handler;
module.exports.config = config;

/**
 * Hàm xử lý trọn gói cho action 'list'
 */
async function handleListAction(lessionId) {
    console.log(`[LOG] handleListAction: Fetching data for ${lessionId}`);
    const { sheets } = await util.ensureAuthenticated();
    
    const [files, response] = await Promise.all([
        util.handleGetDriveFileByKw(lessionId),
        sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'ScoreList!A:F',
        })
    ]);

    const rows = response.data.values || [];
    const filteredRows = lessionId ? rows.filter(row => row[0] === lessionId) : rows;

    const scoreMap = new Map();
    filteredRows.forEach(row => {
        if (row[1]) {
            scoreMap.set(row[1], {
                score: row[3] || null,
                analysis: row[4] || null
            });
        }
    });

    return files.map(file => ({
        ...file,
        fileId: file.id,
        ...(scoreMap.get(file.id) || { score: null, analysis: null })
    }));
}