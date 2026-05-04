import * as sheetsUtil from './util';

/**
 * GOOGLE SHEETS API - CLEAN VERSION
 * Hỗ trợ bóc tách dữ liệu lồng nhau từ Frontend {data: {data: []}}
 */

export default async function handler(req, res) {
    const { method, query, body } = req;
    const spreadsheetId = query?.spread || query?.spreadsheetId || body?.spread || body?.spreadsheetId;
    const sheetName = query?.sheet || query?.sheetName || body?.sheet || body?.sheetName;
    const action = query?.act || body?.act || query?.action || body?.action || 'read';

    const pos = query?.pos !== undefined ? query?.pos : body?.pos;
    const val = query?.val !== undefined ? query?.val : body?.val;
    const rawData = query?.data || body?.data;

    writeLog(`[LOG] Action: ${action}`);
    writeLog(`[LOG] Target: SpreadID: ${spreadsheetId}, Sheet: ${sheetName}`);
    writeLog(`[LOG] Params: pos=${pos}, val=${val}`);
    writeLog(`[LOG] Raw Body:`, JSON.stringify(body));

    try {
        await sheetsUtil.ensureAuthenticated();

        if (!spreadsheetId || !sheetName) {
            console.error("[LOG] Error: Missing spreadsheetId or sheetName");
            return res.status(400).json({ error: "Missing spreadsheetId or sheetName" });
        }

        let result;
        switch (action) {
            case 'read':
                result = await sheetsUtil.handleRead(spreadsheetId, sheetName);
                break;
            case 'add':
                result = await sheetsUtil.handleAdd(spreadsheetId, sheetName, rawData);
                break;
            case 'readByPosVal':
                result = await sheetsUtil.handleReadByPosVal(spreadsheetId, sheetName, pos, val);
                break;
            case 'updateByPosVal':
                result = await sheetsUtil.handleUpdateByPosVal(spreadsheetId, sheetName, pos, val, rawData);
                break;
            case 'deleteByPosVal':
                result = await sheetsUtil.handleDeleteByPosVal(spreadsheetId, sheetName, pos, val);
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

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };