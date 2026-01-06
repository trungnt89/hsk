/**
 * Service Worker: Todo Manager Pro
 * Logic: Đọc từ Google Apps Script API & Hiển thị thông báo danh sách task.
 */

const URL_API = "https://script.google.com/macros/s/AKfycbxWu1xG6JIKV913b9a988K3YKUIGohJ9yXpumQWHMyygIWssn3w-Wb2nbCDg8bt-6ghgg/exec";

// --- TIỆN ÍCH ---

async function sendLogToUI(msg, type = "info") {
    const allClients = await self.clients.matchAll();
    allClients.forEach(client => {
        client.postMessage({ action: 'log_from_sw', message: msg, logType: type });
    });
}

// --- LOGIC CHÍNH ---

async function checkAndNotify(isForced = false) {
    const now = new Date();
    await sendLogToUI(`--- Kiểm tra: ${now.toLocaleTimeString()} ---`);

    try {
        // 1. Fetch dữ liệu từ GAS
        // Cấu hình redirect: "follow" cực kỳ quan trọng vì GAS luôn redirect URL
        const response = await fetch(`${URL_API}?t=${Date.now()}`, { 
            method: "GET",
            redirect: "follow", 
            cache: "no-store" 
        });

        if (!response.ok) throw new Error("Kết nối API thất bại");
        
        const result = await response.json(); 
        
        const hasTaskToday = result.has_tasks_today === true;
        const totalTasks = result.total_tasks_today || 0;
        const tasks = result.tasks_details || [];

        await sendLogToUI(`Kết quả: ${hasTaskToday ? "CÓ TASK" : "KHÔNG"} (${totalTasks} việc)`);

        // 2. Xử lý thông báo
        if (hasTaskToday || isForced) {
            const db = await openNotifyDB();
            const lastNotify = await getNotifyLog(db);
            const diff = now.getTime() - (lastNotify || 0);

            // Chống spam: 1 giờ/lần (3600000ms), trừ khi click tay (isForced)
            if (diff >= 3600000 || isForced) {
                
                // Gom danh sách tiêu đề
                const taskSummary = tasks.slice(0, 3).map(t => `• ${t.title}`).join('\n');
                const extraTasks = totalTasks > 3 ? `\n... và ${totalTasks - 3} việc khác.` : '';
                
                const notificationOptions = {
                    body: totalTasks > 0 
                        ? `Bạn có ${totalTasks} việc hôm nay:\n${taskSummary}${extraTasks}`
                        : "Bạn có công việc cần hoàn thành!",
                    icon: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png",
                    badge: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png",
                    tag: "daily-reminder-" + (isForced ? Date.now() : "fixed"), // Tag động nếu Force để ép hiện
                    renotify: true,           // Ép rung/chuông/pop-up kể cả khi trùng Tag
                    vibrate: [200, 100, 200],
                    requireInteraction: true,  // Không tự ẩn thông báo
                    data: { url: "/" } 
                };

                await self.registration.showNotification("Todo Manager Pro", notificationOptions);

                if (db) await setNotifyLog(db, now.getTime());
                await sendLogToUI("🔔 Thông báo đã được đẩy lên màn hình!", "success");
            } else {
                await sendLogToUI("Bỏ qua: Đã thông báo trong vòng 1h qua.");
            }
        }
    } catch (e) {
        await sendLogToUI("Lỗi SW: " + e.message, "error");
    }
}

// --- DATABASE CHỐNG SPAM (IndexedDB) ---

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

// --- VÒNG ĐỜI VÀ SỰ KIỆN ---

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
    checkAndNotify(); // Chạy ngay khi kích hoạt
    setInterval(checkAndNotify, 300000); // Lặp lại mỗi 5 phút
});

self.onmessage = (event) => {
    if (event.data.action === 'test_notify_now') {
        checkAndNotify(true);
    }
};

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if (client.url.includes('/') && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});