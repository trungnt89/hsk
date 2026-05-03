const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

/**
 * GOOGLE SHEETS API - CLEAN VERSION
 * Tách biệt logic xử lý dữ liệu và logic phản hồi API
 * Example : 
 *    https://hsk-gilt.vercel.app/api/sheet?spread=1_OuLRGiUEzXUpMf-QmPeNYCQee0L1ueGAZcUvNELp8A&sheet=Score&act=read
 *    https://hsk-gilt.vercel.app/api/sheet?spread=1_OuLRGiUEzXUpMf-QmPeNYCQee0L1ueGAZcUvNELp8A&sheet=Score&act=getByVal&pos=0&val=1776989931734
 */

export default async function handler(req, res) {
    const { method, query, body } = req;
    const spreadsheetId = query.spread || query.spreadsheetId || body.spread || body.spreadsheetId;
    const sheetName = query.sheet || query.sheetName || body.sheet || body.sheetName;
    const action = query.act || body.act;

    try {
        const auth = new GoogleAuth({
            credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        console.log(`[LOG] [${new Date().toISOString()}] Action: ${action}`);

        if (!spreadsheetId || !sheetName || !action) {
            return res.status(400).json({ error: "Missing spreadsheetId, sheetName or act" });
        }

        // BIẾN CHỨA KẾT QUẢ CUỐI CÙNG
        let result;

        switch (action) {
            case 'read':
                result = await handleRead(sheets, spreadsheetId, sheetName);
                break;
            case 'add':
                result = await handleAdd(sheets, spreadsheetId, sheetName, query.data || body.data);
                break;
            case 'getByVal':
                result = await handleGetByVal(sheets, spreadsheetId, sheetName, query.pos, query.val);
                break;
            case 'updateByRowID':
                result = await handleUpdateByRowID(sheets, spreadsheetId, sheetName, query.rowID || body.rowID, query.data || body.data);
                break;
            default:
                return res.status(400).json({ error: "Invalid action" });
        }

        // PHẢN HỒI DUY NHẤT TẠI ĐÂY
        return res.status(200).json(result);

    } catch (err) {
        console.error("[SERVER ERR]", err.message);
        return res.status(err.code === 404 ? 404 : 500).json({ error: err.message });
    }
}

// --- CÁC HÀM LOGIC CHỈ TRẢ VỀ DATA, KHÔNG DÙNG RES ---

async function handleRead(sheets, spreadsheetId, sheetName) {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName });
    return { values: response.data.values || [] };
}

async function handleAdd(sheets, spreadsheetId, sheetName, rawData) {
    const data = parseData(rawData);
    const rowValues = Array.isArray(data) ? data : [data];
    const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowValues] },
    });
    return { success: true, details: response.data };
}

async function handleGetByVal(sheets, spreadsheetId, sheetName, pos, val) {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName });
    const rows = response.data.values || [];
    // Sửa lỗi: Sử dụng filter để lấy tất cả các row khớp giá trị
    const results = rows.filter(row => row[parseInt(pos, 10)] == val);

    if (results.length === 0) throw { message: "Value not found", code: 404 };

    return { total: results.length, data: results };
}

async function handleUpdateByRowID(sheets, spreadsheetId, sheetName, rowID, rawData) {
    if (!rowID) throw new Error("Missing rowID");
    const data = parseData(rawData);
    const rowValues = Array.isArray(data) ? data : [data];
    
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${rowID}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] },
    });
    return { success: true, updatedRow: rowID };
}

function parseData(input) {
    if (typeof input === 'string') {
        try { return JSON.parse(input); } catch (e) { return [input]; }
    }
    return input;
}

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };