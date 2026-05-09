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
    await ensureAuthenticated();
    console.log(`[LOG] handleRead: Reading data from ${sheetName}`);
    const response = await cachedSheetsClient.spreadsheets.values.get({ spreadsheetId, range: sheetName });
    const rowCount = response.data.values ? response.data.values.length : 0;
    console.log(`[LOG] handleRead: Success. Total rows read: ${rowCount}`);
    return { values: response.data.values || [] };
}

export async function handleAdd(spreadsheetId, sheetName, rawData) {
    await ensureAuthenticated();
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
    await ensureAuthenticated();
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
	console.log("111");
    await ensureAuthenticated();
	console.log("222");
    try {
        const search = await handleReadByPosVal(spreadsheetId, sheetName, pos, val);
		console.log("333");
        const rowID = search.values[0].rowID;
        let data = parseData(rawData);
        if (data && typeof data === 'object' && data.data && !Array.isArray(data)) data = data.data;
		console.log("444");
        const rowValues = Array.isArray(data) ? (Array.isArray(data[0]) ? data[0] : data) : [data];
		console.log("555");
		console.log(rawData);
		console.log(data);
		console.log(rowValues);
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
    await ensureAuthenticated();
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

/** 
 * Hàm ghi log tối ưu tốc độ (Realtime)
 * Sử dụng append thay vì read-then-write để giảm độ trễ API.
 */
export async function writeLog(content, type) {
    const sid = '1g2COnzVdo8SlqJVq5osT5hfNVfdTsXqzYp0bN1S8ZIc', sn = 'Logs';
    
    // Kiểm tra nếu nội dung chứa chính ID của Spreadsheet thì bỏ qua
    if (typeof content === 'string' && content.includes(sid)) {
        return;
    }

    type = type || "COM";
    try {
        await ensureAuthenticated();

        const d = new Date();
        const time = d.toLocaleString('ja-JP', { 
            timeZone: 'Asia/Tokyo', 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            hour12: false 
        }).replace(/\s+/, '-');

        // Ghi trực tiếp vào cuối sheet - Chỉ tốn 1 round-trip
        await cachedSheetsClient.spreadsheets.values.append({
            spreadsheetId: sid,
            range: `${sn}!A1`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [[time, type, content]] }
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
