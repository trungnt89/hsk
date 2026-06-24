import * as util from './com/sheet';

/**
 * GOOGLE SHEETS API - CLEAN VERSION
 * Hỗ trợ bóc tách dữ liệu lồng nhau từ Frontend {data: {data: []}}
 */


export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { method, query, body } = req;

    const p = { ...query, ...body };
    const spreadsheetId = p.spread || p.spreadsheetId;
    const sheetName     = p.sheet || p.sheetName;
    const action        = p.act || p.action || 'read';
	  
    const pos     = p.pos;
    const val     = p.val;
    const rawData = p.data;	
	const token   = p.token;

	if(token != process.env.PWTOKEN){
		return res.status(401).json({ success: false, error: "Invalid token" });
	}
	
	const authHeader = req.headers['authorization'];
	if(authHeader != process.env.PWTOKEN){
		return res.status(401).json({ success: false, error: "Auth　Invalid token" });
	}
	
    writeLog(`Action: ${action}, Sheet: ${sheetName}, pos=${pos}, val=${val}, SpreadID: ${spreadsheetId}, `);
    if(JSON.stringify(body) && JSON.stringify(body)!="") writeLog(JSON.stringify(body));

    try {
        await util.ensureAuthenticated();

        if (!spreadsheetId || !sheetName) {
            writeLog("[LOG] Error: Missing spreadsheetId or sheetName");
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
                writeLog(`[LOG] Warning: Invalid action received: ${action}`);
                return res.status(400).json({ error: "Invalid action" });
        }

        return res.status(200).json(result);

    } catch (err) {
        writeLog("[SERVER ERR]", err.message);
        return res.status(err.code === 404 ? 404 : 500).json({ error: err.message });
    }
}


function writeLog(message) {
    util.writeLog(message, "SHEET");
}

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };
