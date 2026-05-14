import * as util from './com/sheet';

export default async function handler(req, res) {
    writeLog("[LOG] --- Khởi chạy tiến trình update qua updateByPosVal ---");
    const API_URL	= 'https://hsk-gilt.vercel.app/api/gSheet';
    const SPREAD_ID = '1ezoFMSBVznSNcuufRRQRjxAmUmYyU9MjKDzl-v3wxl8';
	const SHEET 	= 'TASK';

    try {
        // 1. Lấy dữ liệu hiện tại
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                "sheet": SHEET, 
                "act": "read", 
                "spread": SPREAD_ID 
            })
        });

        const data = await response.json();
        const rows = data.values;
        const now = new Date();

        // 2. Duyệt dữ liệu
        for (let i = 1; i < rows.length; i++) {
            const rowData = [...rows[i]]; // Tạo bản sao hàng dữ liệu
            if (rowData.length < 7) continue;

            const id = rowData[0];
            const freg = parseInt(rowData[5]);
            const lastTimeStr = rowData[6].replace('-', '');
            const lastTime = new Date(lastTimeStr);

            const diffMinutes = (now - lastTime) / (1000 * 60);

            // 3. Kiểm tra điều kiện quá hạn
            if (diffMinutes > freg) {
                writeLog(`[PROCESS] Task ${id} quá hạn (${Math.floor(diffMinutes)}m > ${freg}m)`);

                // Tạo chuỗi thời gian mới
                const y = now.getFullYear();
                const mo = now.getMonth() + 1;
                const d = now.getDate();
                const h = now.getHours().toString().padStart(2, '0');
                const mi = now.getMinutes().toString().padStart(2, '0');
                const s = now.getSeconds().toString().padStart(2, '0');
                const newTimeFormatted = `${y}/${mo}/${d}- ${h}:${mi}:${s}`;

                // Cập nhật giá trị LAST_TIME trong mảng hàng
                rowData[6] = newTimeFormatted;

                // 4. Thực hiện Update thông qua updateByPosVal
                const updateResponse = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        "act": "updateByPosVal",
                        "pos": 0,
                        "val": id,
                        "sheet": "TASK",
                        "spread": SPREAD_ID,
                        "data": JSON.stringify(rowData) // Gửi toàn bộ row dưới dạng JSON String
                    })
                });

                if (updateResponse.ok) {
                    writeLog(`[SUCCESS] Đã đồng bộ Task ${id}. LAST_TIME mới: ${newTimeFormatted}`);
                } else {
                    console.error(`[FAIL] Lỗi khi gọi updateByPosVal cho ID: ${id}`);
                }
            }
        }

        res.status(200).json({ message: "Tiến trình hoàn tất" });

    } catch (error) {
        console.error("[CRITICAL ERROR]", error);
        res.status(500).json({ error: error.message });
    }
}

function writeLog(message) {
    util.writeLog(message, "CronJob");
}