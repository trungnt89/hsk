import * as util from './util';

/**
 * GOOGLE SHEETS API - CLEAN VERSION
 * Hỗ trợ bóc tách dữ liệu lồng nhau từ Frontend {data: {data: []}}
 */

export default async function handler(req, res) {
    const { method, query, body } = req;

    const p = { ...query, ...body };
    const spreadsheetId = p.spread || p.spreadsheetId;
    const sheetName     = p.sheet || p.sheetName;
    const action        = p.act || p.action || 'read';
	  
    const pos     = p.pos;
    const val     = p.val;
    const rawData = p.data;
	
    util.writeLog(`[LOG] Action: ${action}, SpreadID: ${spreadsheetId}, Sheet: ${sheetName}, pos=${pos}, val=${val}`);
    util.writeLog(`[LOG] Raw Body:`, JSON.stringify(body));

    try {
        await util.ensureAuthenticated();

        if (!spreadsheetId || !sheetName) {
            console.error("[LOG] Error: Missing spreadsheetId or sheetName");
            return res.status(400).json({ error: "Missing spreadsheetId or sheetName" });
        }

        let result;
        switch (action) {
            case 'read':
                result = await util.handleRead(spreadsheetId, sheetName);
                break;
            case 'add':
                result = await util.handleAdd(spreadsheetId, sheetName, rawData);
                break;
            case 'readByPosVal':
                result = await util.handleReadByPosVal(spreadsheetId, sheetName, pos, val);
                break;
            case 'updateByPosVal':
                result = await util.handleUpdateByPosVal(spreadsheetId, sheetName, pos, val, rawData);
                break;
            case 'deleteByPosVal':
                result = await util.handleDeleteByPosVal(spreadsheetId, sheetName, pos, val);
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