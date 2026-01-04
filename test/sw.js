const DB_NAME = "TodoDBPro";
const STORE_NAME = "tasks_store";

// Gửi log về giao diện để xem trên điện thoại
async function sendLogToUI(msg, type = "info") {
    const allClients = await self.clients.matchAll();
    allClients.forEach(client => {
        client.postMessage({ action: 'log_from_sw', message: msg, logType: type });
    });
}

function getLocalISODate(date) {
    const d = new Date(date);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

// --- LOGIC KIỂM TRA CHÍNH ---
async function checkAndNotify(isForced = false) {
    const now = new Date();
    const todayStr = getLocalISODate(now);

    const db = await openDB();
    if (!db) return;

    try {
        // 1. Kiểm tra cấu hình Tắt/Bật
        const config = await getData(db, "notify_config");
        if (config && config.enabled === false && !isForced) {
            await sendLogToUI("Thông báo đang ở trạng thái: TẮT.");
            return;
        }

        // 2. Kiểm tra Task trong DB
        const tasks = await getData(db, "current_tasks_list");
        let hasTaskToday = false;
        if (tasks && Array.isArray(tasks.data)) {
            hasTaskToday = tasks.data.some(t => getLocalISODate(t.deadline) === todayStr);
        }

        if (hasTaskToday) {
            await deleteData(db, "notify_log");
            await sendLogToUI(`Đã có task cho ngày ${todayStr}. Không gửi.`);
            return;
        }

        // 3. Kiểm tra mốc thời gian (8h sáng và chu kỳ 1h)
        const currentHour = now.getHours();
        if (currentHour >= 8 || isForced) {
            const lastNotify = await getData(db, "notify_log");
            const lastTime = lastNotify ? lastNotify.time : 0;
            const oneHourInMs = 3600000;
            const diff = now.getTime() - lastTime;

            if (diff >= oneHourInMs || isForced) {
                await self.registration.showNotification("Todo Manager Pro", {
                    body: isForced ? "Test: Hệ thống đang hoạt động!" : "🚨 Bạn chưa có công việc nào cho hôm nay!",
                    icon: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png",
                    tag: "daily-reminder",
                    requireInteraction: true
                });
                await setData(db, { id: "notify_log", time: now.getTime() });
                await sendLogToUI("Đã gửi thông báo thành công!", "success");
            } else {
                await sendLogToUI(`Chưa đủ 1h (còn ${Math.floor((oneHourInMs-diff)/60000)}p).`);
            }
        }
    } catch (e) { await sendLogToUI("Lỗi: " + e.message, "error"); }
}

// --- HELPERS DB ---
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
    const action = event.data.action;
    if (action === 'test_notify_now') {
        openDB().then(db => deleteData(db, "notify_log").then(() => checkAndNotify(true)));
    }
    if (action === 'set_notify_status') {
        openDB().then(db => {
            setData(db, { id: "notify_config", enabled: event.data.value });
            sendLogToUI(`Đã ${event.data.value ? 'BẬT' : 'TẮT'} thông báo hệ thống.`, "warn");
        });
    }
};