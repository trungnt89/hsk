const DB_NAME = "TodoDBPro";
const STORE_NAME = "tasks_store";

// Hàm hỗ trợ gửi log về UI để xem trên mobile
async function sendLogToUI(msg, type = "info") {
    const allClients = await self.clients.matchAll();
    allClients.forEach(client => {
        client.postMessage({
            action: 'log_from_sw',
            message: msg,
            logType: type
        });
    });
    console.log(`SW Log: ${msg}`);
}

// --- LOGIC KIỂM TRA VÀ GỬI THÔNG BÁO ---
async function checkAndNotify() {
    const now = new Date();
    await sendLogToUI("--- Bắt đầu Check ---");
    
    // Kiểm tra quyền ngay trong SW
    if (Notification.permission !== 'granted') {
        await sendLogToUI(`Quyền thông báo hiện tại là: ${Notification.permission}`, "warn");
        return;
    }

    const db = await openDB();
    if (!db) {
        await sendLogToUI("Lỗi kết nối IndexedDB", "error");
        return;
    }

    try {
        const tasks = await getData(db, "current_tasks_list");
        const todayStr = now.toDateString();
        const hasTaskToday = (tasks && tasks.data) ? tasks.data.some(t => new Date(t.deadline).toDateString() === todayStr) : false;

        await sendLogToUI(`Task hôm nay: ${hasTaskToday ? "✅ Đã có" : "❌ Chưa có"}`);

        if (hasTaskToday) {
            await deleteData(db, "notify_log");
            await sendLogToUI("Đã có task, dừng gửi notify.");
            return;
        }

        const currentHour = now.getHours();
        await sendLogToUI(`Giờ hiện tại: ${currentHour}h`);

        if (currentHour >= 8) {
            const lastNotify = await getData(db, "notify_log");
            const lastTime = lastNotify ? lastNotify.time : 0;
            const oneHourInMs = 3600000;
            const diff = now.getTime() - lastTime;

            await sendLogToUI(`Lần cuối gửi cách đây: ${Math.floor(diff/60000)} phút`);

            if (diff >= oneHourInMs) {
                await sendLogToUI("Đủ điều kiện. Đang gọi showNotification...");
                
                const options = {
                    body: "🚨 CẢNH BÁO: Bạn chưa thiết lập công việc nào cho hôm nay!",
                    icon: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png",
                    tag: "daily-reminder-persistent",
                    requireInteraction: true,
                    vibrate: [200, 100, 200],
                    badge: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png"
                };

                await self.registration.showNotification("Todo Manager Pro", options);
                await setData(db, { id: "notify_log", time: now.getTime() });
                await sendLogToUI("Gửi thông báo thành công!", "success");
            } else {
                await sendLogToUI("Chưa đủ 1 giờ kể từ lần cuối.");
            }
        } else {
            await sendLogToUI("Chưa đến 8h sáng.");
        }
    } catch (error) {
        await sendLogToUI(`Lỗi hệ thống: ${error.message}`, "error");
    }
}

// --- HELPERS (Bất biến) ---
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
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(data);
        tx.oncomplete = () => resolve(true);
    });
}

function deleteData(db, id) {
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
    });
}

// --- EVENTS ---
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim().then(() => sendLogToUI("Service Worker đã kích hoạt!")));
    setInterval(checkAndNotify, 300000); 
});

self.addEventListener('message', (event) => {
    if (event.data.action === 'test_notify_now') {
        sendLogToUI("Nhận lệnh Force Test từ giao diện...");
        openDB().then(db => {
            deleteData(db, "notify_log").then(() => checkAndNotify());
        });
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((list) => {
            if (list.length > 0) return list[0].focus();
            return clients.openWindow('/');
        })
    );
});