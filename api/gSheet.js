import * as util from './com/sheet';

/**
 * GOOGLE SHEETS API - SECURED VERSION (BẢO MẬT BẰNG COOKIE)
 * Hỗ trợ bóc tách dữ liệu lồng nhau từ Frontend {data: {data: []}}
 * 
 * CHỈ CHO PHÉP: User có cookie 'PWTOKEN' khớp với biến môi trường PWTOKEN của Vercel mới vào được.
 * Nếu sai hoặc thiếu cookie, ngay lập tức trả về lỗi 401 và DỪNG xử lý, không chạm vào Google Sheets.
 */

export default async function handler(req, res) {
    // 1. Cấu hình CORS đầu tiên
    // Sử dụng origin từ client gửi lên hoặc '*' để tương thích với Credentials
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // Bắt buộc bật Credentials để trình duyệt gửi cookie chéo miền
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // =========================================================================
    // KHU VỰC BẢO MẬT: KIỂM TRA COOKIE VÀ BIẾN MÔI TRƯỜNG PWTOKEN
    // =========================================================================
    
    const SECURE_PWTOKEN = process.env.PWTOKEN;

    // Nếu biến môi trường PWTOKEN trên Vercel chưa được cấu hình
    if (!SECURE_PWTOKEN) {
        writeLog("[LỖI BẢO MẬT] Chưa định nghĩa biến t trong Environment Variables của Vercel!");
        return res.status(500).json({ 
            error: "Lỗi cấu hình hệ thống: Thiếu biến môi trường PWTOKEN trên Vercel." 
        });
    }

    // Đọc Cookie từ request gửi lên
    const cookies = req.cookies || {};
    let clientPWTOKENCookie = cookies.PWTOKEN || cookies.PWTOKEN;

    // Hỗ trợ tự giải mã cookie thô từ headers nếu môi trường serverless không tự động bóc tách
    if (!clientPWTOKENCookie && req.headers.cookie) {
        const rawCookies = req.headers.cookie.split(';');
        const cookieMap = {};
        rawCookies.forEach(item => {
            const parts = item.split('=');
            if (parts.length === 2) {
                cookieMap[parts[0].trim()] = parts[1].trim();
            }
        });
        clientPWTOKENCookie = cookieMap.PWTOKEN || cookieMap.PWTOKEN;
    }

    // So sánh Cookie khách gửi lên với mật khẩu được setting trên Vercel
    if (!clientPWTOKENCookie || clientPWTOKENCookie !== SECURE_PWTOKEN) {
        const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        writeLog(`[CẢNH BÁO BẢO MẬT] Chặn đứng truy cập không hợp lệ từ IP: ${clientIP}!`);
        
        // Trả về lỗi 401 Unauthorized ngay lập tức, KHÔNG XỬ LÝ GÌ THÊM
        return res.status(401).json({ 
            error: "Yêu cầu bị từ chối: Sai mật khẩu hoặc thiếu cookie xác thực PWTOKEN." 
        });
    }

    // =========================================================================
    // ĐÃ VỢT QUA XÁC THỰC -> BẤT ĐẦU XỬ LÝ GOOGLE SHEETS
    // =========================================================================

    const { method, query, body } = req;

    const p = { ...query, ...body };
    const spreadsheetId = p.spread || p.spreadsheetId;
    const sheetName     = p.sheet || p.sheetName;
    const action        = p.act || p.action || 'read';
	  
    const pos     = p.pos;
    const val     = p.val;
    const rawData = p.data;
	
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
