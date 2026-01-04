const DB_NAME = "TodoDBPro";
const STORE_NAME = "tasks_store";

// Hàm gửi log về UI (Mobile Console)
async function sendLogToUI(msg, type = "info") {
    const allClients = await self.clients.matchAll();
    allClients.forEach(client => {
        client.postMessage({ action: 'log_from_sw', message: msg, logType: type });
    });
}

// --- LOGIC KIỂM TRA TỰ ĐỘNG (Chạy ngầm mỗi 1h) ---
async function checkAndNotify(isForced = false) {
    const now = new Date();
    await sendLogToUI(`--- Bắt đầu check (${isForced ? 'Manual' : 'Auto'}) ---`);

    const db = await openDB();
    if (!db) {
        await sendLogToUI("Lỗi: Không thể mở IndexedDB", "error");
        return;
    }

    try {
        const tasks = await getData(db, "current_tasks_list");
        const todayStr = now.toDateString();
        const hasTaskToday = (tasks && tasks.data) ? tasks.data.some(t => new Date(t.deadline).toDateString() === todayStr) : false;

        await sendLogToUI(`Task hôm nay: ${hasTaskToday ? "✅ Đã có" : "❌ Chưa có"}`);

        if (hasTaskToday) {
            await deleteData(db, "notify_log");
            await sendLogToUI("Đã có task, hủy lịch gửi.");
            return;
        }

        const currentHour = now.getHours();
        if (currentHour >= 8 || isForced) {
            const lastNotify = await getData(db, "notify_log");
            const lastTime = lastNotify ? lastNotify.time : 0;
            const oneHourInMs = 3600000;
            const diff = now.getTime() - lastTime;

            if (diff >= oneHourInMs || isForced) {
                await sendLogToUI("Đủ điều kiện gửi thông báo...", "success");
                
                await self.registration.showNotification("Todo Manager Pro", {
                    body: isForced ? "Thông báo Test thành công!" : "🚨 CẢNH BÁO: Bạn chưa có công việc nào cho hôm nay!",
                    icon: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png",
                    tag: "daily-reminder", // Tag trùng nhau sẽ ghi đè thông báo cũ, tránh rác máy
                    requireInteraction: true,
                    vibrate: [200, 100, 200]
                });

                await setData(db, { id: "notify_log", time: now.getTime() });
            } else {
                await sendLogToUI(`Chờ thêm: ${Math.floor((oneHourInMs - diff)/60000)} phút.`);
            }
        } else {
            await sendLogToUI("Chưa đến 8h sáng.");
        }
    } catch (error) {
        await sendLogToUI("Lỗi logic: " + error.message, "error");
    }
}

// --- INDEXEDDB HELPERS ---
function openDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
    });
}

function getData(db, id) {
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        } catch(e) { resolve(null); }
    });
}

function setData(db, data) {
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            store.put(data);
            tx.oncomplete = () => resolve(true);
        } catch(e) { resolve(false); }
    });
}

function deleteData(db, id) {
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            store.delete(id);
            tx.oncomplete = () => resolve(true);
        } catch(e) { resolve(false); }
    });
}

// --- EVENTS ---

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        self.clients.claim().then(() => {
            return sendLogToUI("Service Worker đã kích hoạt!");
        })
    );
    // Chạy kiểm tra mỗi 5 phút để bắt đúng mốc giờ
    setInterval(checkAndNotify, 300000); 
});

// Sử dụng onmessage để tăng độ ổn định trên mobile
self.onmessage = (event) => {
    if (event.data.action === 'test_notify_now' || event.data === 'trigger-notify') {
        // 1. Gửi thông báo ngay lập tức để xác nhận quyền (Bypass mọi logic)
        self.registration.showNotification("Hệ thống", {
            body: "🚀 Lệnh Test đã nhận! Đang kiểm tra logic ngầm...",
            icon: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png"
        });

        // 2. Sau đó chạy logic kiểm tra để debug
        checkAndNotify(true);
    }
};

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((list) => {
            if (list.length > 0) return list[0].focus();
            return clients.openWindow('/');
        })
    );
});