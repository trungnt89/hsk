const DB_NAME = "TodoDBPro";
const STORE_NAME = "tasks_store";

// --- LOGIC KIỂM TRA VÀ GỬI THÔNG BÁO ---
async function checkAndNotify() {
    const now = new Date();
    console.log("%c SW Debug: --- Bắt đầu Check --- ", "background: #222; color: #bada55");
    
    // Kiểm tra quyền ngay trong SW
    if (Notification.permission !== 'granted') {
        console.warn("SW Debug: Quyền thông báo hiện tại là:", Notification.permission);
        return;
    }

    const db = await openDB();
    if (!db) {
        console.error("SW Debug: Lỗi kết nối IndexedDB");
        return;
    }

    try {
        const tasks = await getData(db, "current_tasks_list");
        const todayStr = now.toDateString();
        const hasTaskToday = (tasks && tasks.data) ? tasks.data.some(t => new Date(t.deadline).toDateString() === todayStr) : false;

        console.log("SW Debug: Task hôm nay:", hasTaskToday ? "✅ Đã có" : "❌ Chưa có");

        if (hasTaskToday) {
            await deleteData(db, "notify_log");
            console.log("SW Debug: Đã có task, hủy gửi notify.");
            return;
        }

        const currentHour = now.getHours();
        if (currentHour >= 8) {
            const lastNotify = await getData(db, "notify_log");
            const lastTime = lastNotify ? lastNotify.time : 0;
            const oneHourInMs = 3600000;
            const diff = now.getTime() - lastTime;

            console.log("SW Debug: Lần cuối notify cách đây (phút):", Math.floor(diff/60000));

            if (diff >= oneHourInMs) {
                console.log("SW Debug: Đủ điều kiện gửi. Đang gọi Notification...");
                
                const options = {
                    body: "🚨 CẢNH BÁO: Bạn chưa thiết lập công việc nào cho hôm nay!",
                    icon: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png",
                    tag: "daily-reminder-persistent",
                    requireInteraction: true,
                    vibrate: [200, 100, 200]
                };

                await self.registration.showNotification("Todo Manager Pro", options);
                await setData(db, { id: "notify_log", time: now.getTime() });
                console.log("SW Debug: Gửi thành công!");
            } else {
                console.log("SW Debug: Chưa đủ 1 giờ kể từ lần gửi cuối.");
            }
        } else {
            console.log("SW Debug: Chưa đến 8h sáng, không gửi.");
        }
    } catch (error) {
        console.error("SW Debug: Lỗi logic chính:", error);
    }
}

// --- HELPERS (Giữ nguyên logic bất biến) ---
function openDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => { console.error("DB Error:", e); resolve(null); };
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
self.addEventListener('install', (e) => {
    console.log("SW Debug: Đang cài đặt (Install)...");
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log("SW Debug: Đã kích hoạt (Activate).");
    event.waitUntil(self.clients.claim());
    setInterval(checkAndNotify, 300000); 
    checkAndNotify();
});

self.addEventListener('message', (event) => {
    if (event.data.action === 'test_notify_now') {
        console.log("SW Debug: Nhận lệnh Force Test từ UI.");
        openDB().then(db => {
            deleteData(db, "notify_log").then(() => {
                checkAndNotify();
            });
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