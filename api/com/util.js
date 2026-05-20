let nowJST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
function getJSTTime() {
    return `${getJSTDate()} - ${getJSTHour()}`;
}

function getJSTDate() {
    let y = nowJST.getFullYear();
    let mo = nowJST.getMonth() + 1;
    let d = nowJST.getDate();
	
	mo = mo.toString().padStart(2, '0');
	d  = d.toString().padStart(2, '0');
    return `${y}/${mo}/${d}`;
}


function getJSTHour() {
    let h = nowJST.getHours().toString().padStart(2, '0');
    let mi = nowJST.getMinutes().toString().padStart(2, '0');
    let s = nowJST.getSeconds().toString().padStart(2, '0');
    return `${h}:${mi}:${s}`;
}
/** 
 * Hàm ghi log tối ưu tốc độ (Realtime)
 * Sử dụng append thay vì read-then-write để giảm độ trễ API.
 */
export async function writeLog(content, type) {
	const SHEET_TASK = '1ezoFMSBVznSNcuufRRQRjxAmUmYyU9MjKDzl-v3wxl8';
    const SHEET_LOG = '1g2COnzVdo8SlqJVq5osT5hfNVfdTsXqzYp0bN1S8ZIc';
	const SHEET_NAME = 'Logs';
    
    // Kiểm tra nếu nội dung chứa chính ID của Spreadsheet thì bỏ qua
	if (typeof content === 'string' && content.includes(SHEET_TASK)) {
        return;
    }
	
    if (typeof content === 'string' && content.includes(SHEET_LOG)) {
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
            spreadsheetId: SHEET_LOG,
            range: `${SHEET_NAME}!A1`,
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
