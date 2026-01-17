
/**
 * CỔNG KẾT NỐI API (Dành cho Vercel & Telegram Webhook)
 */
function doGet(e) {
  const data = getDashboardData();
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  // 1. Phân loại request từ Telegram Webhook (không có parameter action)
  if (!e.parameter.action) {
    return handleTelegramWebhook(e);
  }

  const action = e.parameter.action;
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch(err) { payload = {}; }

  // 2. Xử lý CRUD từ Dashboard
  if (action === 'saveTaskToSheet') {
    const result = saveTaskToSheet(payload);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'deleteTaskFromSheet') {
    const result = deleteTaskFromSheet(e.parameter.key);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * HÀM GHI LOG HỆ THỐNG (Giới hạn 100 dòng)
 */
function writeLog(type, content) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    let logSheet = ss.getSheetByName(CONFIG.LOG_SHEET_NAME) || ss.insertSheet(CONFIG.LOG_SHEET_NAME);
    let logData = logSheet.getDataRange().getValues();
    
    if (logData.length === 1 && logData[0][0] === "") {
      logData = [["Time", "Type", "Content"]];
    }

    const header = logData[0];
    const newEntry = [new Date(), type, content];
    const oldEntries = logData.slice(1).filter(row => row[0] !== "" && row[0] !== null);
    const finalData = [header, newEntry, ...oldEntries].slice(0, 100);

    logSheet.clear(); 
    logSheet.getRange(1, 1, finalData.length, 3).setValues(finalData);
    logSheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#f3f3f3");
  } catch (e) {
    console.error("Lỗi writeLog: " + e.message);
  }
}