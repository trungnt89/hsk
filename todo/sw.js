const DB_NAME = "TodoDBPro";
const STORE_NAME = "tasks_store";

// Hàm kiểm tra và gửi thông báo
function checkAndNotify() {
    const now = new Date();
    if (now.getHours() < 8) return; // Chỉ chạy từ 8h sáng

    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) return;

        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get("current_tasks_list");

        req.onsuccess = () => {
            const tasks = (req.result && req.result.data) ? req.result.data : [];
            const todayStr = now.toDateString();
            const hasTaskToday = tasks.some(t => new Date(t.deadline).toDateString() === todayStr);

            if (!hasTaskToday) {
                // Kiểm tra logic 1 giờ/lần qua IndexedDB (vì SW không dùng được localStorage ổn định)
                // Ở đây dùng một object riêng trong DB để lưu cache thời gian notify
                checkFrequencyAndShow(db, now);
            }
        };
    };
}

function checkFrequencyAndShow(db, now) {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const logReq = store.get("notify_log");

    logReq.onsuccess = () => {
        const lastTime = logReq.result ? logReq.result.time : 0;
        const oneHour = 3600000;

        if (now.getTime() - lastTime >= oneHour) {
            self.registration.showNotification("Todo Manager Pro", {
                body: "🚨 CẢNH BÁO: Chưa có công việc nào được thiết lập cho hôm nay!",
                icon: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png",
                tag: "persistent-alarm",
                requireInteraction: true
            });
            store.put({ id: "notify_log", time: now.getTime() });
        }
    };
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
    // Kiểm tra mỗi 5 phút một lần để đảm bảo độ chính xác của mốc 1 giờ
    setInterval(checkAndNotify, 300000); 
    checkAndNotify(); // Chạy thử ngay khi kích hoạt
});