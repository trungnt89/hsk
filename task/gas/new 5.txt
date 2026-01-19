/**
 * ĐỌC SHEET CHUYỂN THÀNH JSON (HEADER ĐỘNG)
 */
function getSheetAsJson() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const rawHeaders = data[0];
  
  const json = data.slice(1).map((row) => {
    let obj = {};
    rawHeaders.forEach((h, i) => {
      let key = (h instanceof Date) ? Utilities.formatDate(h, CONFIG.TIMEZONE, "MM/DD") : String(h);
      obj[key] = row[i];
    });
    return obj;
  });
  return { json: json, rawHeaders: rawHeaders };
}

/**
 * LẤY DỮ LIỆU TỔNG HỢP CHO FRONTEND
 */
function getDashboardData() {
  const { json } = getSheetAsJson();
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const logSheet = ss.getSheetByName(CONFIG.LOG_SHEET_NAME);
  const logs = logSheet ? logSheet.getRange(1, 1, 100, 3).getValues() : [];
  return { tasks: json, logs: logs };
}

/**
 * THÊM / SỬA TASK (ĐÃ SỬA LỖI LƯU FREG)
 */
function saveTaskToSheet(taskData) {
  const { json, rawHeaders } = getSheetAsJson();
  let found = false;
  
  // Chuẩn hóa giá trị Tần suất gửi lên từ Frontend
  const finalFreq = taskData.Freq || taskData.Freg || 30;

  for (let i = 0; i < json.length; i++) {
    if (String(json[i].Key) === String(taskData.Key)) {
      Object.assign(json[i], taskData);
      // Đảm bảo gán lại vào đúng cột header đang tồn tại (Freq hoặc Freg)
      rawHeaders.forEach(h => { if (h === "Freq" || h === "Freg") json[i][h] = finalFreq; });
      found = true;
      writeLog("CRUD_UPDATE", `Cập nhật Task ID: ${taskData.Key} | Freq: ${finalFreq}`);
      break;
    }
  }

  if (!found) {
    taskData.Key = "T" + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "ssSSS");
    taskData.Status = CONFIG.DEFAULT_STATUS;
    taskData.UserID = CONFIG.DEFAULT_USER_ID;
    // Gán giá trị Tần suất cho Task mới
    rawHeaders.forEach(h => { if (h === "Freq" || h === "Freg") taskData[h] = finalFreq; });
    
    json.push(taskData);
    writeLog("CRUD_INSERT", `Thêm mới Task ID: ${taskData.Key} | Freq: ${finalFreq}`);
  }

  syncJsonToSheet(json, rawHeaders);
  return { success: true, key: taskData.Key };
}

/**
 * XÓA TASK
 */
function deleteTaskFromSheet(key) {
  const { json, rawHeaders } = getSheetAsJson();
  const newData = json.filter(t => String(t.Key) !== String(key));
  syncJsonToSheet(newData, rawHeaders);
  writeLog("CRUD_DELETE", `Đã xóa Task ID: ${key}`);
  return { success: true };
}

/**
 * CẬP NHẬT TRẠNG THÁI TỪ TELEGRAM REPLY
 */
function updateSheetByTaskId(taskId, content) {
  const { json, rawHeaders } = getSheetAsJson();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "MM/DD");
  const timeStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "HH:mm");

  if (json.length > 0 && !(todayStr in json[0])) {
    json.forEach(t => { if (!(todayStr in t)) t[todayStr] = ""; });
  }

  let found = false;
  json.forEach(task => {
    if (String(task["Key"]) === String(taskId)) {
      const entry = `[${timeStr}] ${content}`;
      task[todayStr] = task[todayStr] ? task[todayStr] + "\n" + entry : entry;
      found = true;
    }
  });

  if (found) syncJsonToSheet(json, rawHeaders);
}

/**
 * ĐỒNG BỘ JSON NGƯỢC LẠI SHEET (SẮP XẾP NGÀY)
 */
function syncJsonToSheet(json, rawHeaders) {
  const datePattern = /^\d{1,2}\/\d{1,2}$/;
  // Chuyển header gốc sang text để so sánh (bao gồm cả việc xử lý cột ngày tháng nếu có ở header)
  const attrHeaders = rawHeaders.map(h => {
    if (h instanceof Date) return Utilities.formatDate(h, CONFIG.TIMEZONE, "MM/DD");
    return String(h);
  }).filter(h => !datePattern.test(h));
  
  let dateHeaders = [];
  json.forEach(t => {
    Object.keys(t).forEach(k => {
      if (datePattern.test(k) && !dateHeaders.includes(k)) dateHeaders.push(k);
    });
  });

  dateHeaders.sort((a, b) => {
    const p = (s) => { 
      const parts = s.split('/');
      return new Date(2026, parseInt(parts[0]) - 1, parseInt(parts[1])).getTime(); 
    };
    return p(a) - p(b);
  });

  const finalHeaders = [...attrHeaders, ...dateHeaders];
  const outputData = [finalHeaders];
  json.forEach(t => outputData.push(finalHeaders.map(h => t[h] || "")));

  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  sheet.clearContents();
  sheet.getRange(1, 1, outputData.length, finalHeaders.length).setValues(outputData);
}