import * as util from './util_test';

const SPREADSHEET_ID = "1_OuLRGiUEzXUpMf-QmPeNYCQee0L1ueGAZcUvNELp8A";

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };


export default async function handler(req, res) {
    const { method, query, body, headers } = req;
    const action = query.action;

    if (!action) {
        if (method === 'POST') action = 'upload';
        else if (method === 'DELETE') action = 'delete';
        else if (method === 'GET') action = (query.id) ? 'audio' : 'list';
    }
    
    try {
        switch (action) {
            case 'audio':
                return await util.handleReadFileMedia(query.id, headers, res);

            case 'list':
                const listData = await handleListAction(query.lessionId);
                return res.status(200).json(listData);

            case 'upload':
                const uploadResult = await util.handleUploadFile(body);
                return res.status(200).json(uploadResult);

            case 'delete':
                const fileId = query.id || query.fileId;
                const deleteResult = await util.handleDeleteFile(fileId);
                return res.status(200).json(deleteResult);

            default:
                return res.status(400).json({ error: "Invalid or missing action" });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}


/**
 * Hàm xử lý trọn gói cho action 'list'
 */
async function handleListAction(lessionId) {
    const sheets = await util.ensureAuthenticated();
    
    // Gọi song song Drive (qua util) và Sheets (trực tiếp)
    const [files, response] = await Promise.all([
        util.handleGetDriveFileByKw(lessionId),
        sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'ScoreList!A:F',
        })
    ]);

    const rows = response.data.values || [];
    // Lọc rows theo lessonId nếu có
    const filteredRows = lessionId ? rows.filter(row => row[0] === lessionId) : rows;

    // Tạo Map để map điểm số theo fileId (cột B - index 1)
    const scoreMap = new Map();
    filteredRows.forEach(row => {
        if (row[1]) {
            scoreMap.set(row[1], {
                score: row[3] || null,
                analysis: row[4] || null
            });
        }
    });

    // Trả về dữ liệu đã gộp
    return files.map(file => ({
        ...file,
        ...(scoreMap.get(file.id) || { score: null, analysis: null })
    }));
}
