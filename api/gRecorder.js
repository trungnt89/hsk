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
    let result;

    // Ghi log để debug khi có lỗi
    console.log(`[LOG] Action: ${action}, Name: ${name}, Method: ${method}`);

    try {
        switch (action) {
            case 'audio':
                console.log(`[LOG] Handling audio stream: ${query.id}`);
                return await util.handleReadFileMedia(query.id, headers, res);

            case 'list':
                result = await handleListAction(query.lessionId);
                return res.status(200).json(result);

            case 'uploadRecorder':
                console.log(`[LOG] Uploading recorder data`);
                result = await util.handleUploadRecorder(body);
                return res.status(200).json(result);
			
            case 'uploadAudioTTS':
                console.log(`[LOG] Uploading TTS audio`);
                result = await util.handleUploadTTS(body);
                return res.status(200).json(result);

            case 'check':
                result = await util.handleCheckFileExist(name);
                return res.status(200).json(result);

            case 'delete':
                const fileId = query.id || query.fileId;
                console.log(`[LOG] Deleting file: ${fileId}`);
                result = await util.handleDeleteFile(fileId);
                return res.status(200).json(result);

            default:
                console.error(`[ERROR] Invalid action: ${action}`);
                return res.status(400).json({ error: "Invalid or missing action" });
        }
    } catch (err) {
        console.error(`[FATAL ERROR] ${err.stack}`);
        return res.status(500).json({ error: err.message });
    }
}

module.exports = handler;
module.exports.config = config;

/**
 * Hàm xử lý trọn gói cho action 'list'
 */
async function handleListAction(lessionId) {
    console.log(`[LOG] handleListAction for: ${lessionId}`);
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
        ...(scoreMap.get(file.id) || { score: null, analysis: null })
    }));
}