import * as util from './com/sheet';

const API_URL = 'https://hsk-gilt.vercel.app/api/gSheet';
const SPREAD_ID = '1ezoFMSBVznSNcuufRRQRjxAmUmYyU9MjKDzl-v3wxl8';
const SHEET = 'TASK';

export default async function handler(req, res) {
    await util.ensureAuthenticated();
    writeLog("[LOG] --- Tiến trình update JST & Kiểm tra LAST_TIME ---");

    try {
        const rows = await fetchTasks();
        writeLog("DATA : " + JSON.stringify(rows));

        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));

        await checkAndProcessTasks(rows, now);

        res.status(200).json({ status: "Success", timezone: "JST" });
    } catch (error) {
        writeLog("[ERROR]", error);
        res.status(500).json({ error: error.message });
    }
}

async function fetchTasks() {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "sheet": SHEET, "act": "read", "spread": SPREAD_ID })
    });
    const data = await response.json();
    return data.values;
}

async function checkAndProcessTasks(rows, now) {
    const currentTimeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    
    for (let i = 1; i < rows.length; i++) {
        const rowData = [...rows[i]];

        const id = rowData[0];
        const status = rowData[3];
        const start = rowData[1] || "00:00";
        const freg = parseInt(rowData[5]) || 0;
        const lastTimeRaw = rowData[6] || "";
        let isExpired = false;

		writeLog(`id=${id},status=${status}, now=${currentTimeStr}, start=${start}`);
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
            await SendNotification(id, rowData);
        }
    }
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

async function SendNotification(id, rowData) {
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

function writeLog(message) {
    util.writeLog(message, "JOB");
}