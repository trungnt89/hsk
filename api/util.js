const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

let cachedSheetsClient = null;

export async function ensureAuthenticated() {
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

export async function handleRead(spreadsheetId, sheetName) {
    console.log(`[LOG] handleRead: Reading data from ${sheetName}`);
    const response = await cachedSheetsClient.spreadsheets.values.get({ spreadsheetId, range: sheetName });
    const rowCount = response.data.values ? response.data.values.length : 0;
    console.log(`[LOG] handleRead: Success. Total rows read: ${rowCount}`);
    return { values: response.data.values || [] };
}

export async function handleAdd(spreadsheetId, sheetName, rawData) {
    console.log("[LOG] handleAdd - Step 1: Receiving rawData", JSON.stringify(rawData));
    if (rawData === undefined || rawData === null) {
        console.error("[LOG] handleAdd Error: Data is null or undefined");
        throw new Error("Dữ liệu gửi lên (data) bị trống!");
    }
    let data = parseData(rawData);
    if (data && typeof data === 'object' && data.data && !Array.isArray(data)) {
        data = data.data;
    }
    const rowValues = Array.isArray(data) ? (Array.isArray(data[0]) ? data[0] : data) : [data];
    const response = await cachedSheetsClient.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowValues] },
    });
    console.log("[LOG] handleAdd - Step 4: Google API Response", response.data.updates);
    return { success: true, details: response.data };
}

export async function handleReadByPosVal(spreadsheetId, sheetName, pos, val) {
    console.log(`[LOG] handleReadByPosVal: Searching ${sheetName} at index ${pos} for value "${val}"`);
    const response = await cachedSheetsClient.spreadsheets.values.get({ spreadsheetId, range: sheetName });
    const rows = response.data.values || [];
    const results = rows
        .map((row, index) => ({ rowID: index + 1, data: row }))
        .filter(item => item.data[parseInt(pos, 10)] == val);
    if (results.length === 0) throw { message: "Value not found", code: 404 };
    return { total: results.length, values: results };
}

export async function handleUpdateByPosVal(spreadsheetId, sheetName, pos, val, rawData) {
    try {
        const search = await handleReadByPosVal(spreadsheetId, sheetName, pos, val);
        const rowID = search.values[0].rowID;
        let data = parseData(rawData);
        if (data && typeof data === 'object' && data.data && !Array.isArray(data)) data = data.data;
        const rowValues = Array.isArray(data) ? (Array.isArray(data[0]) ? data[0] : data) : [data];
        await cachedSheetsClient.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A${rowID}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [rowValues] },
        });
        return { success: true, action: "update", updatedRow: rowID };
    } catch (err) {
        if (err.code === 404 || err.message === "Value not found") {
            return await handleAdd(spreadsheetId, sheetName, rawData);
        }
        throw err;
    }
}

export async function handleDeleteByPosVal(spreadsheetId, sheetName, pos, val) {
    const search = await handleReadByPosVal(spreadsheetId, sheetName, pos, val);
    const rowID = search.values[0].rowID;
    const sheetRes = await cachedSheetsClient.spreadsheets.get({ spreadsheetId });
    const sheet = sheetRes.data.sheets.find(s => s.properties.title === sheetName);
    const sheetId = sheet.properties.sheetId;
    await cachedSheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests: [{
                deleteDimension: {
                    range: { sheetId: sheetId, dimension: 'ROWS', startIndex: rowID - 1, endIndex: rowID }
                }
            }]
        }
    });
    return { success: true, deletedRow: rowID };
}

/** Hàm ghi log */
export async function writeLog(content, type) {
    const sid = '1g2COnzVdo8SlqJVq5osT5hfNVfdTsXqzYp0bN1S8ZIc', sn = 'Logs';
    type = type || "COM";
    try {
        await ensureAuthenticated();

        const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false });
        const time = now.replace(/\//g, '/').replace(', ', '-').replace(/:/g, '');

        // 1. Lấy toàn bộ dữ liệu hiện có (tối đa 100 dòng đầu)
        const { data: { values = [] } } = await cachedSheetsClient.spreadsheets.values.get({ 
            spreadsheetId: sid, 
            range: `${sn}!A1:C100` 
        });

        // 2. Tạo mảng mới: [Log mới nhất] + [Dữ liệu cũ], sau đó cắt lấy đúng 100 dòng
        const newLogs = [[time, type, content], ...values].slice(0, 100);

        // 3. Ghi đè toàn bộ mảng mới vào dải ô từ A1
        await cachedSheetsClient.spreadsheets.values.update({
            spreadsheetId: sid,
            range: `${sn}!A1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: newLogs }
        });

    } catch (e) {
        console.error("[LOG ERR]", e.message);
    }
}

function parseData(input) {
    if (typeof input === 'string') {
        try { 
            let p = JSON.parse(input);
            return (p && typeof p === 'object' && p.data && !Array.isArray(p)) ? p.data : p;
        } catch (e) { return [input]; }
    }
    return input;
}