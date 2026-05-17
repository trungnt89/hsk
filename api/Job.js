import * as util from './com/sheet';


const URL = 'https://docs.google.com/spreadsheets/d/1bSEEle1sTKAEwIM5YYkKZ6nXijtdAcB3D65urXCzZiw/gviz/tq?tqx=out:csv&sheet=LIST';
const API_URL = 'https://hsk-gilt.vercel.app/api/gSheet';
const SPREAD_ID = '1ezoFMSBVznSNcuufRRQRjxAmUmYyU9MjKDzl-v3wxl8';
const SHEET = 'TASK';

export default async function handler(req, res) {
    try {
        const rows = await fetchTasks();
        //writeLog("DATA : " + JSON.stringify(rows));

        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));

        const sentIds = await checkAndProcessTasks(rows, now);

        res.status(200).json({ status: "Success", timezone: "JST", sentIds });
    } catch (error) {
        writeLog("[ERROR]", error);
        res.status(500).json({ error: error.message });
    }
}

async function fetchTasks() {
    const response = await fetch(URL);
    const csvText = await response.text();
    
    // Phân tách chuỗi CSV thành mảng dữ liệu 2 chiều dạng hàng/cột tương đương data.values
    const lines = csvText.split(/\r?\n/);
    const values = lines.map(line => {
        // Tách theo dấu phẩy nhưng bỏ qua dấu phẩy nằm trong cặp dấu ngoặc kép của dữ liệu ô tính
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
        return matches.map(val => val.replace(/^"|"$/g, '').trim());
    });
    return values;
}

async function checkAndProcessTasks(rows, now) {
    const currentTimeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    
    const sentIds = [];
    for (let i = 1; i < rows.length; i++) {
        const rowData = [...rows[i]];

        const id = rowData[0];
        const status = rowData[3];
        const start = rowData[1] || "00:00";
        const freg = parseInt(rowData[5]) || 0;
        const lastTimeRaw = rowData[6] || "";
        let isExpired = false;

		//writeLog(`id=${id},status=${status}, now=${currentTimeStr}, start=${start}`);
        if (status == "1" && currentTimeStr >= start) {
            if (!lastTimeRaw || lastTimeRaw.trim() === "") {
                writeLog(`[TRIGGER] Task ${id}: LAST_TIME trống.`);
                isExpired = true;
            } else {
                const lastTime = new Date(lastTimeRaw.replace('-', ''));
                const diffMinutes = (now - lastTime) / (1000 * 60);
                if (diffMinutes > freg) {
                    isExpired = true;
                    writeLog(`[TRIGGER] Task ${id}: Quá hạn ${Math.floor(diffMinutes)} phút.`);
                }
            }
        }
    
        if (isExpired) {
            const newTimeJST = getJSTTime(now);
            rowData[6] = newTimeJST;
            await UpdateTask(id, rowData);
			//SendNotification(id, rowData);
            sentIds.push(id);
        }
    }
    return sentIds;
}

function getJSTTime(date) {
    const y = date.getFullYear();
    const mo = date.getMonth() + 1;
    const d = date.getDate();
    const h = date.getHours().toString().padStart(2, '0');
    const mi = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${y}/${mo}/${d}- ${h}:${mi}:${s}`;
}

async function UpdateTask(id, rowData) {
    const upRes = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            "act": "updateByPosVal",
            "pos": 0,
            "val": id,
            "sheet": SHEET,
            "spread": SPREAD_ID,
            "data": JSON.stringify(rowData)
        })
    });

    const dataUp = await upRes.json();
    writeLog(JSON.stringify(dataUp));
    if (dataUp.success) {
        writeLog(`[SUCCESS] Task ${id} update thành công hàng ${dataUp.updatedRow}. Giờ JST: ${rowData[6]}`);
    } else {
        writeLog(`[FAIL] Task ${id} update thất bại.`);
    }
}

async function SendNotification(id, rowData) {
	const chatId = "8536107228";
    const text = rowData[2] || "Trống nội dung task";
    writeLog(`[TG_SEND_START] Bắt đầu tiến trình gửi Telegram tới ChatID: ${chatId}`);
    
    try {
        // Sử dụng biến môi trường của Node.js (Vercel) thay cho CONFIG của GAS
        const token = process.env.TELEGRAM_TOKEN;
        if (!token) {
            writeLog(`[TG_SEND_ERR] Không tìm thấy biến môi trường TELEGRAM_TOKEN trên hệ thống.`);
            return;
        }

        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const cleanText = text.replace(/[*_`\[\]]/g, '');

        // Chuyển đổi UrlFetchApp.fetch (GAS) sang fetch chuẩn Node.js
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                chat_id: String(chatId).trim(), 
                text: cleanText 
            })
        });

        const resContent = await response.text();
        if (response.status === 200) {
            writeLog(`[TG_SEND_SUCCESS] Gửi Telegram thành công tới ChatID: ${chatId}`);
        } else {
            writeLog(`[TG_SEND_FAIL] Lỗi kết nối Telegram tới ${chatId} - HTTP Code: ${response.status} - Response: ${resContent}`);
        }
    } catch (error) {
        writeLog(`[TG_SEND_ERR] Ngoại lệ khi call API Telegram gửi tới ${chatId}: ${error.message}`);
    }
}




function writeLog(message) {
    util.writeLog(message, "JOB");
}