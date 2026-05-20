// api/handler.js
import * as util from './com/sheet';
import * as tg from './com/telegram';


const SPREAD_ID = '1ezoFMSBVznSNcuufRRQRjxAmUmYyU9MjKDzl-v3wxl8';
const SHEET_1   = 'TASK';
const SHEET_2   = 'TASK_DETAIL';
const URL       = 'https://docs.google.com/spreadsheets/d/1bSEEle1sTKAEwIM5YYkKZ6nXijtdAcB3D65urXCzZiw/gviz/tq?tqx=out:csv&sheet=LIST';

// Biến toàn cục lưu trữ thời gian thực thi đồng bộ của Request
let nowJST;

export default async function handler(req, res) {
    try {
        // Khởi tạo thời gian JST dùng chung cho toàn bộ tiến trình của Request hiện tại
        nowJST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));

        if (req.method === 'POST') {
            const result = await tg.ReceiveMessage(req.body);
            // FIX: Kiểm tra nếu result là object chứa taskId (thay vì kiểm tra biến boolean như trước)
            if (result && result.taskId) {
                await util.ensureAuthenticated();
				const rowData = [result.taskId, result.replyText, getJSTTime()];
			    const upRes = await util.handleAdd(SPREAD_ID, SHEET_2,JSON.stringify(rowData));
                return res.status(200).json({ status: "Success", type: "Webhook", data: result });
            }
        }

        const sentIds = await ControlSendMessage();
        res.status(200).json({ status: "Success", timezone: "JST", sentIds });
    } catch (error) {
        writeLog("[ERROR]", error.message);
        res.status(500).json({ error: error.message });
    }
}

async function ControlSendMessage() {
    // 1. Trả về tất cả các task từ sheet
    const allTasks = await GetTaskAll();

    // 2. Sử dụng kết quả 1 để trả về các task thỏa mãn điều kiện gửi
    const rows = await GetTaskSend(allTasks);

    const sentIds = [];

    // 3. Sử dụng kết quả 2 để SendMessage và 4. Sử dụng kết quả 3 để UpdateSheet
    for (let i = 0; i < rows.length; i++) {
        const rowData = rows[i];
        const id = rowData[0];

        const newTimeJST = getJSTTime();
        rowData[6] = newTimeJST;
        let text = `【ID: ${rowData[0]}】\n${rowData[2]}`;

        // Thực hiện gửi tin nhắn
        let res = await tg.SendMessage(text);
        if (res) {
            // Thực hiện cập nhật sheet sau khi gửi thành công
            await UpdateTask(SHEET_1, id, rowData);
            sentIds.push(id);
        }
    }

    return sentIds;
}

async function GetTaskAll() {
	await util.ensureAuthenticated();
	const upRes = await util.handleRead(SPREAD_ID, SHEET_1);
	return upRes;
}

async function GetTaskSend(allTasks) {
    const currentTimeStr = nowJST.getHours().toString().padStart(2, '0') + ":" + nowJST.getMinutes().toString().padStart(2, '0');
    const tasksToSend = [];

    // Duyệt qua toàn bộ hàng (bỏ qua hàng tiêu đề index 0)
    for (let i = 1; i < allTasks.length; i++) {
        const rowData = [...allTasks[i]];

        const id = rowData[0];
        const status = rowData[3];
        const start = rowData[1] || "00:00";
        const freg = parseInt(rowData[5]) || 0;
        const lastTimeRaw = rowData[6] || "";
        let isExpired = false;

        if (status == "1" && currentTimeStr >= start) {
            if (!lastTimeRaw || lastTimeRaw.trim() === "") {
                writeLog(`[TRIGGER] Task ${id}: LAST_TIME trống.`);
                isExpired = true;
            } else {
                const lastTime = new Date(lastTimeRaw.replace('-', ''));
                const diffMinutes = (nowJST - lastTime) / (1000 * 60);
                if (diffMinutes > freg) {
                    isExpired = true;
                    writeLog(`[TRIGGER] Task ${id}: Quá hạn ${Math.floor(diffMinutes)} minutes.`);
                }
            }
        }

        if (isExpired) {
            tasksToSend.push(rowData);
        }
    }

    return tasksToSend;
}

function getJSTTime() {
    const y = nowJST.getFullYear();
    const mo = nowJST.getMonth() + 1;
    const d = nowJST.getDate();
    const h = nowJST.getHours().toString().padStart(2, '0');
    const mi = nowJST.getMinutes().toString().padStart(2, '0');
    const s = nowJST.getSeconds().toString().padStart(2, '0');
    return `${y}/${mo}/${d}- ${h}:${mi}:${s}`;
}

async function UpdateTask(sheet, id, rowData) {
    writeLog(`[UPDATE_START] Cập nhật thời gian mới cho Task ${id}`);
    await util.ensureAuthenticated();
    const upRes = await util.handleUpdateByPosVal(SPREAD_ID, sheet, 0, id, JSON.stringify(rowData));
    writeLog("[UPDATE_RESPONSE] " + JSON.stringify(upRes));
    if (upRes.success) {
        writeLog(`[SUCCESS] Task ${id} update thành công hàng ${upRes.updatedRow}. Giờ JST: ${rowData[6]}`);
    } else {
        writeLog(`[FAIL] Task ${id} update thất bại.`);
    }
}

function writeLog(message) {
    util.writeLog(message, "JOB");
}