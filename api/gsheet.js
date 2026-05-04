const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

// Biến global lưu trữ kết quả xác thực
let cachedSheetsClient = null;

/**
 * GOOGLE SHEETS API - CLEAN VERSION
 * Hỗ trợ bóc tách dữ liệu lồng nhau từ Frontend {data: {data: []}}
 */

/**
 * Hàm xác thực và khởi tạo client
 */
async function ensureAuthenticated() {
    if (cachedSheetsClient) return cachedSheetsClient;
    console.log("[LOG] Initializing Google Auth...");
    const auth = new GoogleAuth({
        credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const client = await auth.getClient();
    cachedSheetsClient = google.sheets({ version: 'v4', auth: client });
    return cachedSheetsClient;
}

export default async function handler(req, res) {
    const { method, query, body } = req;
    const spreadsheetId = query?.spread || query?.spreadsheetId || body?.spread || body?.spreadsheetId;
    const sheetName = query?.sheet || query?.sheetName || body?.sheet || body?.sheetName;
    const action = query?.act || body?.act || query?.action || body?.action || 'read';

    // Xử lý lỗi truyền param: Kiểm tra cả query và body cho pos, val và data
    const pos = query?.pos !== undefined ? query?.pos : body?.pos;
    const val = query?.val !== undefined ? query?.val : body?.val;
    const rawData = query?.data || body?.data;

    console.log(`[LOG] Action: ${action}`);
    console.log(`[LOG] Target: SpreadID: ${spreadsheetId}, Sheet: ${sheetName}`);
    console.log(`[LOG] Params: pos=${pos}, val=${val}`);
    console.log(`[LOG] Raw Body:`, JSON.stringify(body));

    try {
        // Gọi hàm xác thực trước khi xử lý
        const sheets = await ensureAuthenticated();

        if (!spreadsheetId || !sheetName) {
            console.error("[LOG] Error: Missing spreadsheetId or sheetName");
            return res.status(400).json({ error: "Missing spreadsheetId or sheetName" });
        }

        let result;
        switch (action) {
            case 'read':
                result = await handleRead(sheets, spreadsheetId, sheetName);
                break;
            case 'add':
                result = await handleAdd(sheets, spreadsheetId, sheetName, rawData);
                break;
            case 'readByPosVal':
                result = await handleReadByPosVal(sheets, spreadsheetId, sheetName, pos, val);
                break;
            case 'updateByPosVal':
                result = await handleUpdateByPosVal(sheets, spreadsheetId, sheetName, pos, val, rawData);
                break;
            case 'deleteByPosVal':
                result = await handleDeleteByPosVal(sheets, spreadsheetId, sheetName, pos, val);
                break;
            default:
                console.warn(`[LOG] Warning: Invalid action received: ${action}`);
                return res.status(400).json({ error: "Invalid action" });
        }

        return res.status(200).json(result);

    } catch (err) {
        console.error("[SERVER ERR]", err.message);
        return res.status(err.code === 404 ? 404 : 500).json({ error: err.message });
    }
}

async function handleRead(sheets, spreadsheetId, sheetName) {
    console.log(`[LOG] handleRead: Reading data from ${sheetName}`);
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName });
    const rowCount = response.data.values ? response.data.values.length : 0;
    console.log(`[LOG] handleRead: Success. Total rows read: ${rowCount}`);
    return { values: response.data.values || [] };
}

async function handleAdd(sheets, spreadsheetId, sheetName, rawData) {
    console.log("[LOG] handleAdd - Step 1: Receiving rawData", JSON.stringify(rawData));
    
    if (rawData === undefined || rawData === null) {
        console.error("[LOG] handleAdd Error: Data is null or undefined");
        throw new Error("Dữ liệu gửi lên (data) bị trống!");
    }

    let data = parseData(rawData);
    console.log("[LOG] handleAdd - Step 1.5: Data after parseData:", JSON.stringify(data));
    
    if (data && typeof data === 'object' && data.data && !Array.isArray(data)) {
        console.log("[LOG] handleAdd: Unpacking nested {data: ...} object");
        data = data.data;
    }

    const rowValues = Array.isArray(data) ? (Array.isArray(data[0]) ? data[0] : data) : [data];
    console.log("[LOG] handleAdd - Step 2: Formatted rowValues", JSON.stringify(rowValues));

    let response;
    try {
        response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [rowValues] },
        });
    } catch (gErr) {
        console.error("[LOG] handleAdd - Step 3 - ERROR: Google API Append Failed:", gErr.response?.data || gErr.message);
        throw gErr;
    }
    
    console.log("[LOG] handleAdd - Step 4: Google API Response", response.data.updates);
    return { success: true, details: response.data };
}

async function handleReadByPosVal(sheets, spreadsheetId, sheetName, pos, val) {
    console.log(`[LOG] handleReadByPosVal: Searching ${sheetName} at index ${pos} for value "${val}"`);
    
    if (pos === undefined || val === undefined) {
        console.error("[LOG] handleReadByPosVal Error: Missing pos or val");
        throw new Error("Missing search parameters: pos or val");
    }

    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName });
    const rows = response.data.values || [];
    const results = rows
        .map((row, index) => ({ rowID: index + 1, data: row }))
        .filter(item => item.data[parseInt(pos, 10)] == val);

    console.log(`[LOG] handleReadByPosVal: Found ${results.length} matches`);
    if (results.length === 0) throw { message: "Value not found", code: 404 };
    return { total: results.length, values: results };
}

async function handleUpdateByPosVal(sheets, spreadsheetId, sheetName, pos, val, rawData) {
    console.log(`[LOG] handleUpdateByPosVal: Starting update process for ${val}`);
    try {
        const search = await handleReadByPosVal(sheets, spreadsheetId, sheetName, pos, val);
        const rowID = search.values[0].rowID;
        console.log(`[LOG] handleUpdateByPosVal: Target RowID determined as ${rowID}`);
        
        let data = parseData(rawData);
        if (data && typeof data === 'object' && data.data && !Array.isArray(data)) {
            data = data.data;
        }
        
        const rowValues = Array.isArray(data) ? (Array.isArray(data[0]) ? data[0] : data) : [data];
        console.log(`[LOG] handleUpdateByPosVal: Updating row ${rowID} with values:`, JSON.stringify(rowValues));
        
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A${rowID}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [rowValues] },
        });
        console.log(`[LOG] handleUpdateByPosVal: Update successful for row ${rowID}`);
        return { success: true, action: "update", updatedRow: rowID };
    } catch (err) {
        if (err.code === 404 || err.message === "Value not found") {
            console.log("[LOG] handleUpdateByPosVal: Value not found, switching to handleAdd");
            return await handleAdd(sheets, spreadsheetId, sheetName, rawData);
        }
        console.error("[LOG] handleUpdateByPosVal Error:", err.message);
        throw err;
    }
}

async function handleDeleteByPosVal(sheets, spreadsheetId, sheetName, pos, val) {
    console.log(`[LOG] handleDeleteByPosVal: Deleting record where index ${pos} is "${val}"`);
    const search = await handleReadByPosVal(sheets, spreadsheetId, sheetName, pos, val);
    const rowID = search.values[0].rowID;
    
    const sheetRes = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = sheetRes.data.sheets.find(s => s.properties.title === sheetName);
    if (!sheet) {
        console.error(`[LOG] handleDeleteByPosVal Error: Sheet ${sheetName} not found`);
        throw new Error("Sheet name not found");
    }
    
    const sheetId = sheet.properties.sheetId;
    console.log(`[LOG] handleDeleteByPosVal: Resolved SheetID: ${sheetId}, RowID: ${rowID}`);

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests: [{
                deleteDimension: {
                    range: {
                        sheetId: sheetId,
                        dimension: 'ROWS',
                        startIndex: rowID - 1,
                        endIndex: rowID
                    }
                }
            }]
        }
    });
    console.log(`[LOG] handleDeleteByPosVal: Delete successful for rowID ${rowID}`);
    return { success: true, deletedRow: rowID };
}

function parseData(input) {
    if (typeof input === 'string') {
        try { 
            let p = JSON.parse(input);
            let result = (p && typeof p === 'object' && p.data && !Array.isArray(p)) ? p.data : p;
            return result;
        } catch (e) { 
            return [input]; 
        }
    }
    return input;
}

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };