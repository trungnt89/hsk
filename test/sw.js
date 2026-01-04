// URL chứa dữ liệu Task của bạn (Ví dụ: https://domain.com/data.json)
const URL_API = "https://your-domain.com/api/tasks.json"; 

async function sendLogToUI(msg, type = "info") {
    const allClients = await self.clients.matchAll();
    allClients.forEach(client => {
        client.postMessage({ action: 'log_from_sw', message: msg, logType: type });
    });
}

function toLocalYMD(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function checkAndNotify(isForced = false) {
    const now = new Date();
    const todayStr = toLocalYMD(now);
    await sendLogToUI(`--- Check Server: ${todayStr} ---`);

    try {
        // 1. Lấy dữ liệu từ Server (Thêm timestamp để tránh cache trình duyệt)
        const response = await fetch(`${URL_API}?t=${Date.now()}`);
        if (!response.ok) throw new Error("Không thể kết nối Server");
        
        const result = await response.json(); 
        // Giả sử cấu trúc JSON là: { "tasks": [{ "deadline": "2026-01-04" }, ...] }
        const tasks = result.tasks || [];

        // 2. Kiểm tra Task cho ngày hôm nay
        const hasTaskToday = tasks.some(t => toLocalYMD(t.deadline) === todayStr);
        await sendLogToUI(`Server trả về ${tasks.length} tasks. Trùng hôm nay: ${hasTaskToday}`);

        if (hasTaskToday) {
            await sendLogToUI("Đã có task trên Server. Hủy thông báo.");
            return;
        }

        // 3. Logic giờ giấc (8h sáng)
        const currentHour = now.getHours();
        if (currentHour >= 8 || isForced) {
            // Vẫn dùng IndexedDB chỉ để lưu mốc thời gian đã gửi (tránh spam 1h/lần)
            const db = await openNotifyDB();
            const lastNotify = await getNotifyLog(db);
            const diff = now.getTime() - (lastNotify || 0);

            if (diff >= 3600000 || isForced) {
                await self.registration.showNotification("Todo Manager Pro", {
                    body: "🚨 Server báo: Bạn chưa có công việc nào cho hôm nay!",
                    icon: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png",
                    tag: "daily-reminder",
                    requireInteraction: true
                });
                if (db) await setNotifyLog(db, now.getTime());
                await sendLogToUI("Đã gửi Notify thành công!", "success");
            } else {
                await sendLogToUI("Chưa đủ 1h từ lần gửi cuối.");
            }
        }
    } catch (e) {
        await sendLogToUI("Lỗi Fetch Server: " + e.message, "error");
    }
}

// --- DB MINI (Chỉ để lưu log thời gian gửi, tránh spam) ---
function openNotifyDB() {
    return new Promise(res => {
        const req = indexedDB.open("NotifyLogDB", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("logs");
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
    });
}
function getNotifyLog(db) {
    return new Promise(res => {
        if (!db) return res(null);
        const req = db.transaction("logs").objectStore("logs").get("last_sent");
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
    });
}
function setNotifyLog(db, time) {
    return new Promise(res => {
        if (!db) return res(null);
        const tx = db.transaction("logs", "readwrite");
        tx.objectStore("logs").put(time, "last_sent");
        tx.oncomplete = () => res(true);
    });
}

// --- EVENTS ---
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
    setInterval(checkAndNotify, 300000); 
});

self.onmessage = (event) => {
    if (event.data.action === 'test_notify_now') checkAndNotify(true);
};