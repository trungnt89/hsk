import fetch from 'node-fetch';
import FormData from 'form-data';

/**
 * CẤU HÌNH HỆ THỐNG (SỬ DỤNG BIẾN MÔI TRƯỜNG ĐỂ BẢO MẬT TOKEN)
 */
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8019068142:AAEyOi2cg-TBIr-XPfkHP4iqMw_rj9XLw1s";
const CHAT_ID = "8536107228";
const TARGET_URL = "https://m.lophoctiengnhat.com/free-moi-ngay-mot-bai-dokkai-n1.html";

export default async function handler(req, res) {
  // Cấu hình CORS để cho phép gọi từ giao diện web
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const startTime = new Date();
  const logs = [];
  
  // Hàm ghi log tùy biến để gom log trả về response client cùng lúc với console.log
  const log = (msg) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    log("--- BẮT ĐẦU QUÁ TRÌNH BÁO CÁO ---");
    
    // Lấy URL từ query parameters hoặc body, nếu không có thì dùng TARGET_URL mặc định
    let urlParam = "";
    if (req.query && req.query.url) {
      urlParam = req.query.url;
    } else if (req.body && req.body.url) {
      urlParam = req.body.url;
    }
    
    const URL = (urlParam !== "") ? urlParam : TARGET_URL;
    log("1. Mục tiêu: " + URL);
    
    // TỐI ƯU HÓA MICROLINK URL: Giảm waitForTimeout từ 15000 xuống 3000 để tránh lỗi HTTP 504 Gateway Timeout
    const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(URL)}` + 
                         `&screenshot=true` +
                         `&embed=screenshot.url` +
                         `&viewport.width=414` +
                         `&viewport.height=986` +
                         `&viewport.isMobile=true` +
                         `&screenshot.fullPage=true` + 
                         `&waitForNetworkIdle=true` +
                         `&waitForTimeout=3000&t=` + new Date().getTime();

    log("2. Đang gửi yêu cầu chụp ảnh tới Microlink (Đợi khoảng 5-10s)...");
    
    // 1. Tải file ảnh từ Microlink
    const response = await fetch(microlinkUrl);
    const responseCode = response.status;
    
    log("3. Phản hồi từ Microlink: HTTP " + responseCode);

    if (responseCode === 200) {
      const buffer = await response.buffer();
      const fileSize = (buffer.length / 1024).toFixed(2);
      log("   - Kích thước ảnh: " + fileSize + " KB");

      // 2. Gửi ảnh sang Telegram
      log("4. Đang đẩy ảnh lên Telegram...");
      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`;
      
      const form = new FormData();
      form.append('chat_id', CHAT_ID);
      form.append('photo', buffer, { filename: 'screenshot.png', contentType: 'image/png' });
      form.append('caption', `📅 Ngày: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);

      const teleResponse = await fetch(telegramUrl, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
      });
      
      const teleCode = teleResponse.status;
      const teleText = await teleResponse.text();
      
      if (teleCode === 200) {
        log("✅ THÀNH CÔNG: Đã gửi báo cáo iPhone tới Telegram.");
      } else {
        log("❌ LỖI TELEGRAM: Mã " + teleCode + " - " + teleText);
      }
      
    } else if (responseCode === 429) {
      log("❌ LỖI HẠN MỨC (429): Bạn đã hết lượt dùng Microlink miễn phí trong ngày.");
    } else {
      const errorText = await response.text();
      log("❌ LỖI MICROLINK: Mã " + responseCode + ". Nội dung: " + errorText);
    }

  } catch (e) {
    log("❌ LỖI HỆ THỐNG: " + e.toString());
  } finally {
    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    log("--- KẾT THÚC: Tổng thời gian thực hiện " + duration + " giây ---");
    
    // Trả kết quả HTTP về cho client gọi API
    return res.status(200).json({
      success: logs.some(l => l.includes("✅ THÀNH CÔNG")),
      duration: duration + "s",
      logs: logs
    });
  }
}