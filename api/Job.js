// api/handler.js
import * as util from './com/sheet.js';
import * as tg from './com/telegram.js';

const SPREAD_ID = '1ezoFMSBVznSNcuufRRQRjxAmUmYyU9MjKDzl-v3wxl8';
const SHEET_1   = 'TASK';
const SHEET_2   = 'TASK_DETAIL';

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
    const allTasks = await GetTaskList();

    // 2. Sử dụng kết quả 1 để trả về các task thỏa mãn điều kiện gửi
    const rows = await GetTaskSend(allTasks);

    // 3. Sử dụng kết quả 2 để SendMessage và 4. Sử dụng kết quả 3 để UpdateSheet
    for (let i = 0; i < rows.length; i++) {
        const rowData = rows[i];
        const id = rowData[0];

        const newTimeJST = getJSTTime();
        rowData[6] = newTimeJST;
        let text = `【ID: ${rowData[0]}】\n${rowData[2]}`;

        let res;
        res = await tg.SendMessage(text);
        if (res) {
            await UpdateTask(SHEET_1, id, rowData);			
			if (text.includes("N1")) {
				await fetch("https://hsk-gilt.vercel.app/api/image");
			}
		}
    }

    return rows;
}

async function GetTaskList() {
    await util.ensureAuthenticated();
    let taskList   = await util.handleRead(SPREAD_ID, SHEET_1);
    let taskDetail = await util.handleRead(SPREAD_ID, SHEET_2);

	taskList = taskList.values;
	taskDetail = taskDetail.values;

    const headers1 = taskList[0];
    const idIdx1 = headers1.indexOf('ID');
    if (idIdx1 === -1) return taskList;

    const todayStr = getJSTDate();

    const doneIdsToday = new Set();
    for (let i = 0; i < taskDetail.length; i++) {
        const row = taskDetail[i];
        
        const id = (row[0] || '').toString().trim();
        const content = (row[1] || '').toString().trim();
        const rawDate = (row[2] || '').toString().trim();
        

        if ((content.toLowerCase().includes('done') || content.toLowerCase().includes('stop')) && rawDate.includes(todayStr)){
            doneIdsToday.add(id);
        }
    }

    const filteredTaskList = [headers1];
    for (let i = 1; i < taskList.length; i++) {
        const row = taskList[i];
        const id = (row[idIdx1] || '').toString().trim();
        if (!doneIdsToday.has(id)) {
            filteredTaskList.push(row);
        }
    }

    return filteredTaskList;
}

async function GetTaskSend(allTasks) {
    const currentTimeStr = nowJST.getHours().toString().padStart(2, '0') + ":" + nowJST.getMinutes().toString().padStart(2, '0');
    const tasksToSend = [];
	
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