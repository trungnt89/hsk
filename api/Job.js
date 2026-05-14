import * as util from './com/sheet';

export default async function handler(req, res) {
    writeLog("[LOG] --- Tiến trình update JST & Kiểm tra LAST_TIME ---");
    const API_URL = 'https://hsk-gilt.vercel.app/api/gSheet';
    const SPREAD_ID = '1ezoFMSBVznSNcuufRRQRjxAmUmYyU9MjKDzl-v3wxl8';
    const SHEET = 'TASK';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "sheet": SHEET, "act": "read", "spread": SPREAD_ID })
        });

        const data = await response.json();
        const rows = data.values;

        // Cố định múi giờ Nhật Bản (JST)
        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));

        for (let i = 1; i < rows.length; i++) {
            const rowData = [...rows[i]];
            if (rowData.length < 7) continue;

            const id = rowData[0];
            const freg = parseInt(rowData[5]) || 0;
            const lastTimeRaw = rowData[6];
            let isExpired = false;

            // Kiểm tra nếu LAST_TIME không có giá trị
            if (!lastTimeRaw || lastTimeRaw.trim() === "") {
                writeLog(`[TRIGGER] Task ${id}: LAST_TIME trống. Gửi thông báo ngay.`);
                isExpired = true;
            } else {
                const lastTime = new Date(lastTimeRaw.replace('-', ''));
                const diffMinutes = (now - lastTime) / (1000 * 60);
                if (diffMinutes > freg) {
                    isExpired = true;
                    writeLog(`[TRIGGER] Task ${id}: Quá hạn ${Math.floor(diffMinutes)} phút.`);
                }
            }

            if (isExpired) {
                // Format giờ Nhật mới: YYYY/M/D- HH:mm:ss
                const y = now.getFullYear();
                const mo = now.getMonth() + 1;
                const d = now.getDate();
                const h = now.getHours().toString().padStart(2, '0');
                const mi = now.getMinutes().toString().padStart(2, '0');
                const s = now.getSeconds().toString().padStart(2, '0');
                const newTimeJST = `${y}/${mo}/${d}- ${h}:${mi}:${s}`;

                rowData[6] = newTimeJST;

                const upRes = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
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
                if (dataUp.success) {
                    writeLog(`[SUCCESS] Task ${id} update thành công hàng ${dataUp.updatedRow}. Giờ JST: ${newTimeJST}`);
                } else {
                    writeLog(`[FAIL] Task ${id} update thất bại.`);
                }
            }
        }

        res.status(200).json({ status: "Success", timezone: "JST" });
    } catch (error) {
        writeLog("[ERROR]", error);
        res.status(500).json({ error: error.message });
    }
}


function writeLog(message) {
    util.writeLog(message, "SHEET");
}