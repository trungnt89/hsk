const DB_NAME = "TodoDBPro";
const STORE_NAME = "tasks_store";

async function sendLogToUI(msg, type = "info") {
    const allClients = await self.clients.matchAll();
    allClients.forEach(client => {
        client.postMessage({ action: 'log_from_sw', message: msg, logType: type });
    });
}

/**
 * Hàm chuẩn hóa ngày cực kỳ quan trọng cho Mobile
 * Chuyển bất kỳ kiểu Date/String nào về chuỗi "YYYY-MM-DD" đúng múi giờ địa phương
 */
function toLocalYMD(input) {
    const d = new Date(input);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function checkAndNotify(isForced = false) {
    const now = new Date();
    const todayStr = toLocalYMD(now); // Lấy "2026-01-04" chuẩn Mobile
    await sendLogToUI(`--- Check Logic: ${todayStr} ---`);

    const db = await openDB();
    if (!db) return;

    try {
        // 1. Check Cấu hình Bật/Tắt
        const config = await getData(db, "notify_config");
        if (config && config.enabled === false && !isForced) {
            await sendLogToUI("Thông báo đang TẮT.");
            return;
        }

        // 2. Check Data Task
        const tasks = await getData(db, "current_tasks_list");
        let hasTaskToday = false;

        if (tasks && Array.isArray(tasks.data)) {
            await sendLogToUI(`DB có ${tasks.data.length} tasks. Đang so sánh...`);
            hasTaskToday = tasks.data.some(t => {
                const taskDate = toLocalYMD(t.deadline);
                // Log để bạn check trực tiếp trên Console Mobile
                if (taskDate === todayStr) {
                    sendLogToUI(`Tìm thấy task trùng: ${t.deadline} -> ${taskDate}`, "success");
                    return true;
                }
                return false;
            });
        }

        await sendLogToUI(`Kết quả cuối: ${hasTaskToday ? "ĐÃ CÓ TASK (Chặn)" : "CHƯA CÓ TASK (Gửi)"}`);

        // LOGIC CHẶN
        if (hasTaskToday) {
            await deleteData(db, "notify_log"); // Reset log để mai gửi lại
            return; 
        }

        // 3. Logic Gửi (Chỉ gửi khi hasTaskToday === false)
        const currentHour = now.getHours();
        if (currentHour >= 8 || isForced) {
            const lastNotify = await getData(db, "notify_log");
            const lastTime = lastNotify ? lastNotify.time : 0;
            const oneHourInMs = 3600000;
            const diff = now.getTime() - lastTime;

            if (diff >= oneHourInMs || isForced) {
                await self.registration.showNotification("Todo Manager Pro", {
                    body: "🚨 CẢNH BÁO: Bạn chưa thiết lập công việc nào cho hôm nay!",
                    icon: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png",
                    tag: "daily-reminder",
                    requireInteraction: true,
                    vibrate: [200, 100, 200]
                });
                await setData(db, { id: "notify_log", time: now.getTime() });
                await sendLogToUI("Đã hiện Notify!", "success");
            } else {
                await sendLogToUI(`Chưa đủ 1h chờ.`, "warn");
            }
        }
    } catch (e) { await sendLogToUI("Lỗi Logic: " + e.message, "error"); }
}

// --- DB HELPERS (Giữ nguyên) ---
function openDB() {
    return new Promise(res => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
    });
}
function getData(db, id) {
    return new Promise(res => {
        try {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).get(id);
            req.onsuccess = () => res(req.result);
            req.onerror = () => res(null);
        } catch { res(null); }
    });
}
function setData(db, data) {
    return new Promise(res => {
        try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put(data);
            tx.oncomplete = () => res(true);
        } catch { res(false); }
    });
}
function deleteData(db, id) {
    return new Promise(res => {
        try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).delete(id);
            tx.oncomplete = () => res(true);
        } catch { res(false); }
    });
}

// --- EVENTS ---
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
    setInterval(checkAndNotify, 300000); 
});

self.onmessage = (event) => {
    if (event.data.action === 'test_notify_now') {
        openDB().then(db => deleteData(db, "notify_log").then(() => checkAndNotify(true)));
    }
    if (event.data.action === 'set_notify_status') {
        openDB().then(db => setData(db, { id: "notify_config", enabled: event.data.value }));
    }
};

self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    e.waitUntil(clients.matchAll({ type: 'window' }).then(list => list.length > 0 ? list[0].focus() : clients.openWindow('/')));
});