/**
 * Service Worker: Todo Manager Pro
 * Logic: Đọc dữ liệu từ Google Script, hiển thị thông báo danh sách task hôm nay.
 */

// URL của Google Apps Script (Hãy thay bằng link Web App của bạn)
const URL_API = "https://script.google.com/macros/s/AKfycbzxgeuILa7zgN06IoNqBMzG1aGJXQPRbUdiCbeJIUWzJerhO4l4p26SjyVi7lp1XZSBkA/exec";

// --- HELPERS ---

async function sendLogToUI(msg, type = "info") {
    const allClients = await self.clients.matchAll();
    allClients.forEach(client => {
        client.postMessage({ action: 'log_from_sw', message: msg, logType: type });
    });
}

// --- CORE LOGIC ---

async function checkAndNotify(isForced = false) {
    const now = new Date();
    await sendLogToUI(`--- Check Server: ${now.toLocaleTimeString()} ---`);

    try {
        // 1. Fetch dữ liệu từ Google Script (thêm timestamp để tránh cache)
        const response = await fetch(`${URL_API}?t=${Date.now()}`);
        if (!response.ok) throw new Error("Không thể kết nối Server");
        
        const result = await response.json(); 
        
        // 2. Phân tích dữ liệu từ format JSON mới
        const hasTaskToday = result.has_tasks_today === true;
        const totalTasks = result.total_tasks_today || 0;
        const tasks = result.tasks_details || [];

        await sendLogToUI(`Server: ${hasTaskToday ? "CÓ TASK" : "KHÔNG"} (${totalTasks} việc)`);

        // 3. Nếu có task hôm nay
        if (hasTaskToday || isForced) {
            const db = await openNotifyDB();
            const lastNotify = await getNotifyLog(db);
            const diff = now.getTime() - (lastNotify || 0);

            // Kiểm tra chống spam: 1 giờ (3600000ms) hoặc khi bấm Test (isForced)
            if (diff >= 3600000 || isForced) {
                
                // Tạo nội dung hiển thị (tối đa 3 tiêu đề đầu tiên)
                const taskSummary = tasks.slice(0, 3).map(t => `• ${t.title}`).join('\n');
                const extraTasks = totalTasks > 3 ? `\n... và ${totalTasks - 3} việc khác.` : '';
                const bodyContent = totalTasks > 0 
                    ? `Bạn có ${totalTasks} việc cần làm:\n${taskSummary}${extraTasks}`
                    : "Bạn có công việc cần hoàn thành trong hôm nay!";

                await self.registration.showNotification("Todo Manager Pro", {
                    body: bodyContent,
                    icon: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png",
                    badge: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png",
                    tag: "daily-reminder",
                    requireInteraction: true,
                    data: { tasks: tasks, timestamp: now.getTime() }
                });

                if (db) await setNotifyLog(db, now.getTime());
                await sendLogToUI("Đã gửi Notify thành công!", "success");
            } else {
                await sendLogToUI("Bỏ qua: Chưa đủ 1h từ lần gửi cuối.");
            }
        } else {
            await sendLogToUI("Hôm nay không có task nào.");
        }

    } catch (e) {
        await sendLogToUI("Lỗi SW: " + e.message, "error");
    }
}

// --- DATABASE (Chống spam) ---

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
        try {
            const req = db.transaction("logs").objectStore("logs").get("last_sent");
            req.onsuccess = () => res(req.result);
            req.onerror = () => res(null);
        } catch(e) { res(null); }
    });
}

function setNotifyLog(db, time) {
    return new Promise(res => {
        if (!db) return res(null);
        try {
            const tx = db.transaction("logs", "readwrite");
            tx.objectStore("logs").put(time, "last_sent");
            tx.oncomplete = () => res(true);
        } catch(e) { res(null); }
    });
}

// --- LIFE CYCLE & EVENTS ---

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
    // Kiểm tra ngay khi kích hoạt và sau đó mỗi 5 phút
    checkAndNotify();
    setInterval(checkAndNotify, 300000); 
});

// Lắng nghe lệnh từ UI (nút Test hoặc Sync)
self.onmessage = (event) => {
    if (event.data.action === 'test_notify_now') {
        checkAndNotify(true);
    }
};

// Xử lý khi người dùng click vào thông báo
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return clients.openWindow('/');
        })
    );
});