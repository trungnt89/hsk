=================================================================================
# TIỆN ÍCH BÁO THỨC THÔNG MINH PRO (CHROME EXTENSION MANIFEST V3) - PHIÊN BẢN 2.0
=================================================================================

Báo Thức Thông Minh Pro là tiện ích mở rộng chạy ngầm trên trình duyệt, kết hợp hoàn hảo giữa tự động mở website, giọng đọc nhắc nhở TTS Nam & Nữ chuẩn tiếng Việt và báo thức bằng âm nhạc YouTube.

---------------------------------------------------------------------------------
DANH SÁCH TẤT CẢ CÁC TÍNH NĂNG CHI TIẾT
---------------------------------------------------------------------------------
1. 🌐 TỰ ĐỘNG MỞ WEBSITE THEO LỊCH TRÌNH:
   - Tự động mở tab mới theo giờ hẹn chính xác đến từng phút.
   - Hỗ trợ bất kỳ trang web nào: VnExpress, Dân Trí, Trello, Notion, Google Calendar, GitHub, Duolingo, v.v.
   - Kèm âm thanh chuông điện tử nhẹ nhàng (Web Chime) để báo hiệu khi trang web mở ra.
   - Có nút "Mở thử ngay" để kiểm tra đường link trước khi lưu.

2. 🗣️ GIỌNG ĐỌC NHẮC NHỞ TTS (AZURE TTS API & TRÌNH DUYỆT):
   - Hỗ trợ 3 tùy chọn phát âm:
     + 1. 👨 Nam của Azure (Mặc định): Giọng vi-VN-NamMinhNeural trầm ấm, dõng dạc, phát âm tiếng Việt cực chuẩn.
     + 2. 👩 Nữ của Azure: Giọng vi-VN-HoaiMyNeural truyền cảm, ngọt ngào, dịu dàng.
     + 3. 🌐 Mặc định trình duyệt: Dùng Web Speech API của thiết bị, chạy 100% offline.
   - Tích hợp chuẩn qua API: https://hsk-gilt.vercel.app/api/tts
     (Cấu trúc: text, lang=vi-VN, voice, rate, token)
   - Tùy chỉnh Tốc độ đọc (Rate/Speed) từ 0.7x đến 1.3x.
   - Nút "🔊 Thử Giọng Ngay" nghe trực tiếp lời thoại để tinh chỉnh trước khi lưu.
   - Cơ chế Fallback thông minh: Tự động chuyển sang giọng mặc định trình duyệt nếu mạng không sẵn sàng hoặc thiếu token.

3. 🎬 BÁO THỨC BẰNG NHẠC YOUTUBE (CHỐNG LỖI 153):
   - Nhận diện linh hoạt URL YouTube hoặc ID video 11 ký tự.
   - Tích hợp ruleset declarativeNetRequest sửa Referer chống lỗi chặn nhúng (Error 153).
   - Tích hợp sẵn 4 bản nhạc mẫu: Lofi Chill sáng, Chuông điện tử, Acoustic, Tiếng mưa rào.

4. ⏰ BỘ BIỂU TƯỢNG ĐỒNG HỒ BÁO THỨC MỚI:
   - Icon quả chuông đôi đỏ kim loại hiện đại, sắc nét ở mọi kích thước: 16x16, 48x48, 128x128, 512x512.

5. 🛠️ BỘ CÔNG CỤ QUẢN LÝ BÁO THỨC ĐẦY ĐỦ:
   - Đồng hồ thời gian thực (Live Digital Clock) cập nhật từng giây.
   - Thêm, sửa, xóa mốc báo thức dễ dàng với giao diện trực quan.
   - Nút "Reo Thử" mốc bất kỳ lúc nào để kiểm tra kịch bản reo.
   - Nút "Nhân Bản" (Clone) mốc hẹn chỉ với 1 cú click.
   - Công tắc Bật/Tắt (Toggle Switch) linh hoạt.
   - Lọc danh mục theo tab: Tất cả, Mở Web, TTS, YouTube kèm đếm số lượng mốc.
   - Màn hình Reo Chuông: Hiển thị giao diện tùy biến cho từng loại báo thức, kèm nút "⏰ Báo lại 5p" (Snooze) và "🔕 TẮT CHUÔNG".
   - Tùy chỉnh số lần lặp chuông: 1 lần, 3 lần, 5 lần, 10 lần hoặc lặp vô tận.

6. 📅 CÀI ĐẶT LỊCH LẶP THEO THỨ TRONG TUẦN (DAYS OF WEEK):
   - Tùy chọn kích hoạt theo ngày: Hàng ngày (7/7 ngày), Thứ 2 đến Thứ 6 (ngày làm việc), Cuối tuần (T7, CN) hoặc chọn linh hoạt từng ngày riêng lẻ (T2, T3, T4, T5, T6, T7, CN).
   - Tự động áp dụng mặc định cho tất cả các mốc cũ chưa có cài đặt thứ thành "Hàng ngày" (tất cả các ngày trong tuần) để đảm bảo an toàn tuyệt đối, không bỏ lỡ báo thức.
   - Background service worker tự động đối chiếu thứ hiện tại để kích hoạt chính xác.

7. ☁️ ĐỒNG BỘ GOOGLE SHEETS QUA API (CLOUD SYNC):
   - Đồng bộ 2 chiều (Đẩy lên Sheet & Tải về từ Sheet).
   - Token Authorization KHÔNG bị cố định (hardcoded) trong mã nguồn, được cài đặt trực tiếp trong phần Cài đặt và lưu vào trình duyệt (localStorage / chrome.storage.local) để sử dụng cho toàn hệ thống.
   - Khi chỉnh sửa, thêm mới, bật/tắt hoặc xóa mốc báo thức, hệ thống sẽ tự động cập nhật lên Google Sheets tương ứng nếu đã lưu Token.

8. 💾 LƯU TRỮ 100% OFFLINE & SAO LƯU DỮ LIỆU:
   - Lưu trữ an toàn cục bộ trong IndexedDB và chrome.storage.local.
   - Nạp nhanh 5 mốc mẫu chuẩn cho công việc và sinh hoạt hàng ngày.
   - Xuất dữ liệu ra file JSON (Export) để sao lưu hoặc chuyển đổi thiết bị.
   - Nhập dữ liệu từ file JSON (Import) an toàn.

---------------------------------------------------------------------------------
CẤU TRÚC TỆP TIN TRONG GÓI CÀI ĐẶT:
---------------------------------------------------------------------------------
├── manifest.json              # Khai báo cấu hình Extension Manifest V3
├── rules.json                 # Cấu hình declarativeNetRequest chống lỗi YouTube 153
├── background.js              # Service Worker chạy nền: Xử lý chrome.alarms, mở tab, tạo thông báo
├── popup.html / .css / .js    # Giao diện Popup nhanh khi bấm vào icon trên thanh công cụ
├── options.html / .css / .js  # Trang quản trị đầy đủ Dashboard của tiện ích (kèm cài đặt Token & đồng bộ Sheet)
├── ring.html / .js            # Màn hình chuông reo kích hoạt khi đến giờ hẹn
├── audio.js                   # Thư viện âm thanh Web Audio API & TTS Nam/Nữ
├── db.js                      # Quản lý cơ sở dữ liệu IndexedDB 100% offline
├── sheet.js                   # Module gọi API Google Sheets với Token lấy từ trình duyệt
├── utils.js                   # Tiện ích xử lý URL, video ID, thời gian
├── icons/                     # Bộ icon đồng hồ báo thức (icon16, icon48, icon128, icon512)
└── README.txt                 # Tài liệu này

---------------------------------------------------------------------------------
HƯỚNG DẪN CÀI ĐẶT VÀO CHROME / EDGE / CỐC CỐC (15 GIÂY):
---------------------------------------------------------------------------------
1. Giải nén file .zip này vào một thư mục trên máy tính.
2. Mở trình duyệt Chrome, Cốc Cốc hoặc Edge.
3. Truy cập trang quản lý tiện ích:
   - Chrome / Cốc Cốc / Brave: chrome://extensions
   - Microsoft Edge: edge://extensions
4. Bật công tắc "Chế độ dành cho nhà phát triển" (Developer mode) ở góc trên bên phải.
5. Nhấn "Tải tiện ích đã giải nén" (Load unpacked).
6. Chọn thư mục vừa giải nén (thư mục chứa tệp manifest.json).
7. Biểu tượng đồng hồ báo thức ⏰ màu đỏ sẽ xuất hiện trên thanh công cụ!

---------------------------------------------------------------------------------
8. CÁCH BẬT CHẾ ĐỘ BẤM "X" TẮT HẾT TRÌNH DUYỆT VẪN REO (GIẢI PHÁP 4):
---------------------------------------------------------------------------------
Extension đã tích hợp sẵn quyền "background" trong Manifest V3 để duy trì tiến trình chạy ngầm trong khay hệ thống (System Tray).
Để kích hoạt hoàn toàn tính năng này:
1. Mở Cài đặt của Chrome: chrome://settings/system (hoặc Cài đặt -> Hệ thống)
2. Bật tùy chọn: "Tiếp tục chạy các ứng dụng nền khi Google Chrome đã đóng" (Continue running background apps when Google Chrome is closed).
3. Kết quả: Khi bạn bấm nút "X" tắt toàn bộ cửa sổ Chrome, Extension vẫn âm thầm chạy ngầm. Đến đúng giờ hẹn, nó sẽ tự động phát chuông, đọc lời nhắc TTS hoặc tự động bật cửa sổ trình duyệt và mở website bạn đã cài đặt!
=================================================================================
