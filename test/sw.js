const DB_NAME = "TodoDBPro";
const STORE_NAME = "tasks_store";

// --- LOGIC KIỂM TRA VÀ GỬI THÔNG BÁO ---
async function checkAndNotify() {
    const now = new Date();
    
    // Mở kết nối IndexedDB
    const db = await openDB();
    if (!db) return;

    // 1. Lấy danh sách tasks
    const tasks = await getData(db, "current_tasks_list");
    const todayStr = now.toDateString();
    const hasTaskToday = (tasks && tasks.data) ? tasks.data.some(t => new Date(t.deadline).toDateString() === todayStr) : false;

    // 2. Nếu ĐÃ CÓ task -> Reset log và dừng
    if (hasTaskToday) {
        await deleteData(db, "notify_log");
        return;
    }

    // 3. Nếu CHƯA CÓ task -> Kiểm tra mốc 8h sáng và chu kỳ 1h
    const currentHour = now.getHours();
    if (currentHour >= 8) {
        const lastNotify = await getData(db, "notify_log");
        const lastTime = lastNotify ? lastNotify.time : 0;
        const oneHourInMs = 3600000;

        if (now.getTime() - lastTime >= oneHourInMs) {
            // Thực hiện gửi thông báo
            self.registration.showNotification("Todo Manager Pro", {
                body: "🚨 CẢNH BÁO: Bạn chưa thiết lập công việc nào cho hôm nay!",
                icon: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png",
                tag: "daily-reminder-persistent",
                requireInteraction: true,
                badge: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png"
            });

            // Lưu lại thời điểm vừa gửi vào DB
            await setData(db, { id: "notify_log", time: now.getTime() });
        }
    }
}

// --- CÁC HÀM TRỢ GIÚP INDEXEDDB (Promise hóa để dùng Async/Await) ---
function openDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

function getData(db, id) {
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
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

// --- EVENT LISTENERS ---

// 1. Khi cài đặt và kích hoạt
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        self.clients.claim().then(() => {
            // Kiểm tra ngay khi kích hoạt
            checkAndNotify();
            // Thiết lập vòng lặp kiểm tra mỗi 5 phút (để đảm bảo chính xác mốc 1 giờ)
            setInterval(checkAndNotify, 300000);
        })
    );
});

// 2. Lắng nghe lệnh gửi ngay từ file Test HTML
self.addEventListener('message', (event) => {
    if (event.data.action === 'test_notify_now') {
        console.log("SW: Nhận lệnh gửi test ngay...");
        // Ép buộc xóa log cũ để gửi được ngay mà không cần đợi 1h
        openDB().then(db => {
            deleteData(db, "notify_log").then(() => {
                checkAndNotify();
            });
        });
    }
});

// 3. Khi người dùng click vào thông báo
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            if (clientList.length > 0) return clientList[0].focus();
            return clients.openWindow('/');
        })
    );
});