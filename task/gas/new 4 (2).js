/**
 * QUY TRÌNH QUÉT VÀ GỬI THÔNG BÁO TỰ ĐỘNG
 * (Cài đặt Trigger chạy hàm này mỗi 5-10 phút)
 */
function sendTaskNotifications() {
  writeLog("NOTIFY_START", "--- Bắt đầu quét Notify ---");
  const { json, rawHeaders } = getSheetAsJson();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "MM/DD");
  const currentTimeNum = now.getHours() * 60 + now.getMinutes();
  let hasChange = false;

  json.forEach((task) => {
    const taskId = task["Key"];
    const status = String(task["Status"]);
    const userId = String(task["UserID"]).trim();
    const startStr = String(task["Start"]);
    const freq = Number(task["Freg"] || task["Freq"] || 30);
    const todayResult = String(task[todayStr] || "").toLowerCase();

    // LOG CHI TIẾT NGUYÊN NHÂN BỎ QUA (SKIP)
    if (status !== "1") {
      writeLog("NOTIFY_SKIP", `ID ${taskId}: Task đang tắt (Status=${status})`);
      return;
    }
    if (userId === "") {
      writeLog("NOTIFY_SKIP", `ID ${taskId}: Trống UserID Telegram`);
      return;
    }
    if (todayResult.includes("done")) {
      writeLog("NOTIFY_SKIP", `ID ${taskId}: Đã xong (KQ có chữ 'done')`);
      return;
    }
    if (todayResult.includes("stop")) {
      writeLog("NOTIFY_SKIP", `ID ${taskId}: Đã dừng (KQ có chữ 'stop')`);
      return;
    }

    try {
      let h, m;
      if (startStr instanceof Date || (typeof startStr === "string" && startStr.includes("GMT"))) {
        let d = new Date(startStr);
        h = d.getHours(); m = d.getMinutes();
      } else {
        let parts = String(startStr).split(":");
        h = parseInt(parts[0], 10);
        m = parseInt(parts[1] || "0", 10);
      }
      
      const startMinutes = h * 60 + m;
      
      // LOG: Kiểm tra thời gian bắt đầu
      if (currentTimeNum < startMinutes) {
        writeLog("NOTIFY_WAIT", `ID ${taskId}: Chưa tới giờ (Bắt đầu lúc ${h}:${m})`);
      } else {
        let lastNotified = task["LastNotified"];
        let shouldNotify = false;

        if (!lastNotified || lastNotified === "" || lastNotified === "null") {
          writeLog("NOTIFY_REASON", `ID ${taskId}: Gửi thông báo đầu tiên`);
          shouldNotify = true;
        } else {
          let lastDate = new Date(lastNotified);
          
          // Kiểm tra nếu là ngày mới
          if (Utilities.formatDate(lastDate, CONFIG.TIMEZONE, "MM/DD") !== todayStr) {
            writeLog("NOTIFY_REASON", `ID ${taskId}: Reset AlertCount cho ngày mới`);
            task["AlertCount"] = 0;
            shouldNotify = true;
          } else {
            // Kiểm tra tần suất (Frequency)
            let diffMin = Math.floor((now - lastDate) / (1000 * 60));
            if (diffMin >= freq) {
              writeLog("NOTIFY_REASON", `ID ${taskId}: Đã đủ thời gian (${diffMin} >= ${freq} phút)`);
              shouldNotify = true;
            } else {
              writeLog("NOTIFY_WAIT", `ID ${taskId}: Chờ thêm (Mới qua ${diffMin}/${freq} phút)`);
            }
          }
        }

        if (shouldNotify) {
          const currentAlert = (Number(task["AlertCount"]) || 0) + 1;
          const msg = `📝 ID:${taskId} | ⏱${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} | ⏳${freq} | 🔔${currentAlert}\n${task["TaskContent"]}`;
          
          sendTelegram(userId, msg);
          task["LastNotified"] = now;
          task["AlertCount"] = currentAlert;
          hasChange = true;
          writeLog("NOTIFY_SENT", `Gửi thành công ID ${taskId} (Lần ${currentAlert})`);
        }
      }
    } catch (e) { writeLog("NOTIFY_ERR", `ID ${taskId} Error: ${e.message}`); }
  });

  if (hasChange) syncJsonToSheet(json, rawHeaders);
  writeLog("NOTIFY_END", "--- Kết thúc quét ---");
}

/**
 * XỬ LÝ TIN NHẮN ĐẾN TỪ WEBHOOK
 */
function handleTelegramWebhook(e) {
  try {
    const update = JSON.parse(e.postData.contents);
    if (!update.message || !update.message.reply_to_message) return;

    const replyText = update.message.text;
    const originalText = update.message.reply_to_message.text;
    const idMatch = originalText.match(/ID:?\s*([^|\s\n]+)/i);
    
    if (idMatch) {
      const taskId = idMatch[1].trim(); 
      updateSheetByTaskId(taskId, replyText);
      
      const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/sendMessage`;
      UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ 
          chat_id: String(update.message.chat.id), 
          text: `✅ Đã ghi nhận ID ${taskId}.`,
          reply_markup: { inline_keyboard: [[{ text: "📊 Mở Dashboard", url: CONFIG.DASHBOARD_URL + "?id=" + taskId }]] }
        })
      });
      writeLog("TG_RECEIVE", `Đã nhận reply ID ${taskId}: ${replyText}`);
    }
  } catch (err) { writeLog("TG_ERROR", err.toString()); }
}

function sendTelegram(chatId, text) {
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/sendMessage`;
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: String(chatId).trim(), text: text.replace(/[*_`\[\]]/g, '') }),
    muteHttpExceptions: true
  });
}