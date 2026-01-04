const DB_NAME = "TodoDBPro";
const STORE_NAME = "tasks_store";

// Hàm gửi log về UI (Mobile Console) để debug
async function sendLogToUI(msg, type = "info") {
    const allClients = await self.clients.matchAll();
    allClients.forEach(client => {
        client.postMessage({ action: 'log_from_sw', message: msg, logType: type });
    });
}

// Hàm chuẩn hóa ngày về định dạng YYYY-MM-DD theo múi giờ địa phương
function getLocalISODate(date) {
    const d = new Date(date);
    const offset = d.getTimezoneOffset() * 60000; // Lấy độ lệch múi giờ tính bằng ms
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

// --- LOGIC KIỂM TRA CHÍNH ---
async function checkAndNotify(isForced = false) {
    const now = new Date();
    const todayStr = getLocalISODate(now);
    await sendLogToUI(`--- Bắt đầu check ngày: ${todayStr} ---`);

    const db = await openDB();
    if (!db) {
        await sendLogToUI("Lỗi: Không thể mở IndexedDB", "error");
        return;
    }

    try {
        const tasks = await getData(db, "current_tasks_list");
        
        // 1. Kiểm tra sự tồn tại của task cho ngày hôm nay
        let hasTaskToday = false;
        if (tasks && Array.isArray(tasks.data)) {
            await sendLogToUI(`Dữ liệu DB: Tìm thấy ${tasks.data.length} tasks.`);
            hasTaskToday = tasks.data.some(t => {
                const taskDateStr = getLocalISODate(t.deadline);
                return taskDateStr === todayStr;
            });
        }

        await sendLogToUI(`Kết quả: ${hasTaskToday ? "✅ ĐÃ CÓ TASK" : "❌ CHƯA CÓ TASK"}`);

        // 2. NẾU ĐÃ CÓ TASK: Tuyệt đối không gửi thông báo
        if (hasTaskToday) {
            await deleteData(db, "notify_log");
            await sendLogToUI("Đã có task cho hôm nay. Dừng tiến trình gửi.");
            return; 
        }

        // 3. NẾU CHƯA CÓ TASK: Kiểm tra điều kiện thời gian
        const currentHour = now.getHours();
        if (currentHour >= 8 || isForced) {
            const lastNotify = await getData(db, "notify_log");
            const lastTime = lastNotify ? lastNotify.time : 0;
            const oneHourInMs = 3600000;
            const diff = now.getTime() - lastTime;

            if (diff >= oneHourInMs || isForced) {
                await sendLogToUI("Đủ điều kiện. Đang hiện thông báo...", "success");
                
                await self.registration.showNotification("Todo Manager Pro", {
                    body: isForced && !hasTaskToday ? "[TEST] Bạn chưa có việc nào hôm nay!" : "🚨 CẢNH BÁO: Bạn chưa thiết lập công việc nào cho hôm nay!",
                    icon: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png",
                    tag: "daily-reminder-unique", // Tránh trùng lặp thông báo
                    requireInteraction: true,
                    vibrate: [300, 100, 300]
                });

                await setData(db, { id: "notify_log", time: now.getTime() });
            } else {
                await sendLogToUI(`Chưa đủ 1 giờ kể từ lần gửi cuối (${Math.floor(diff/60000)}p đã trôi qua).`);
            }
        } else {
            await sendLogToUI(`Chưa đến 8h sáng (Hiện tại: ${currentHour}h).`);
        }
    } catch (error) {
        await sendLogToUI(`Lỗi hệ thống: ${error.message}`, "error");
    }
}

// --- INDEXEDDB HELPERS (Bất biến) ---
function openDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
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
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
    setInterval(checkAndNotify, 300000); // 5 phút check 1 lần
});

// Nhận message từ UI
self.onmessage = (event) => {
    if (event.data.action === 'test_notify_now' || event.data === 'trigger-notify') {
        // Xóa log cũ để "ép" gửi ngay nếu thỏa mãn điều kiện DB
        openDB().then(db => {
            deleteData(db, "notify_log").then(() => {
                checkAndNotify(true);
            });
        });
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