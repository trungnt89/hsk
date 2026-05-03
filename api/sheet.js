const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

/**
 * GOOGLE SHEETS MANAGER - HYBRID METHOD (GET/POST)
 */

export default async function sheetManagerHandler(req, res) {
    const { method, query, body } = req;

    try {
        const auth = new GoogleAuth({
            credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        // --- XỬ LÝ PHƯƠNG THỨC GET (Chỉ dùng cho READ) ---
        if (method === 'GET') {
            const { spreadsheetId, sheetName, action } = query;
            
            console.log(`[LOG] [${new Date().toISOString()}] GET Request - Action: ${action}`);

            if (action === 'read') {
                if (!spreadsheetId || !sheetName) {
                    return res.status(400).json({ error: "Missing spreadsheetId or sheetName in query" });
                }
                return await readAllData(sheets, spreadsheetId, sheetName, res);
            }
            return res.status(400).json({ error: "Invalid GET action. Use action=read" });
        }

        // --- XỬ LÝ PHƯƠNG THỨC POST (Dùng cho ADD và UPDATE) ---
        if (method === 'POST') {
            const { spreadsheetId, sheetName, action, data } = body;

            console.log(`[LOG] [${new Date().toISOString()}] POST Request - Action: ${action}`);

            if (!spreadsheetId || !sheetName || !action) {
                return res.status(400).json({ error: "Missing spreadsheetId, sheetName or action in body" });
            }

            switch (action) {
                case 'add':
                    return await insertAtLastRow(sheets, spreadsheetId, sheetName, data, res);
                case 'update':
                    return await updateRowByKeyword(sheets, spreadsheetId, sheetName, data, res);
                default:
                    return res.status(400).json({ error: "Invalid POST action. Use 'add' or 'update'" });
            }
        }

        // Nếu là phương thức khác
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${method} Not Allowed`);

    } catch (err) {
        console.error("[SERVER ERR]", err.message);
        return res.status(500).json({ error: err.message });
    }
}

/**
 * 1. Đọc toàn bộ nội dung sheet (Phương thức GET)
 */
async function readAllData(sheets, spreadsheetId, sheetName, res) {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}`,
        });
        const rows = response.data.values || [];
        console.log(`[LOG] Read successful from ${sheetName}. Rows: ${rows.length}`);
        return res.status(200).json({ totalRows: rows.length, values: rows });
    } catch (err) {
        console.error("[READ ERR]", err.message);
        throw err;
    }
}

/**
 * 2. Insert vào row cuối cùng (Phương thức POST)
 */
async function insertAtLastRow(sheets, spreadsheetId, sheetName, data, res) {
    if (!Array.isArray(data)) {
        return res.status(400).json({ error: "Data for 'add' must be an array" });
    }
    try {
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [data] },
        });
        console.log(`[LOG] Appended new row to ${sheetName}`);
        return res.status(200).json({ message: "Row added", details: response.data });
    } catch (err) {
        console.error("[ADD ERR]", err.message);
        throw err;
    }
}

/**
 * 3. Update toàn bộ dòng theo Keyword (Phương thức POST)
 */
async function updateRowByKeyword(sheets, spreadsheetId, sheetName, data, res) {
    const { keyword, newRowData } = data;

    if (!keyword || !Array.isArray(newRowData)) {
        return res.status(400).json({ error: "Update requires 'keyword' and 'newRowData' array" });
    }

    try {
        const getRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}`,
        });
        const rows = getRes.data.values || [];
        const rowIndex = rows.findIndex(row => row.includes(keyword));

        if (rowIndex === -1) {
            console.log(`[LOG] Keyword "${keyword}" not found.`);
            return res.status(404).json({ error: "Keyword not found" });
        }

        const range = `${sheetName}!A${rowIndex + 1}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [newRowData] },
        });

        console.log(`[LOG] Fully updated row ${rowIndex + 1}`);
        return res.status(200).json({ message: "Update successful", updatedRowIndex: rowIndex + 1 });
    } catch (err) {
        console.error("[UPDATE ERR]", err.message);
        throw err;
    }
}

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };