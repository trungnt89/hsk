/**
 * Service Worker: Todo Manager Pro (Full Version)
 * Hỗ trợ: Bật/Tắt thông báo từ UI và Gỡ bỏ hệ thống.
 */

const URL_API = "https://script.google.com/macros/s/AKfycbxWu1xG6JIKV913b9a988K3YKUIGohJ9yXpumQWHMyygIWssn3w-Wb2nbCDg8bt-6ghgg/exec";

// Biến toàn cục để kiểm soát trạng thái thông báo
let isNotifyEnabled = true;

// --- TIỆN ÍCH ---
async function sendLogToUI(msg, type = "info") {
    const allClients = await self.clients.matchAll();
    allClients.forEach(client => {
        client.postMessage({ action: 'log_from_sw', message: msg, logType: type });
    });
}

// --- LOGIC CHÍNH ---
async function checkAndNotify(isForced = false) {
    // Nếu người dùng TẮT thông báo và không phải lệnh TEST (isForced) thì dừng lại
    if (!isNotifyEnabled && !isForced) {
        await sendLogToUI("Hệ thống: Thông báo hiện đang ở trạng thái TẮT.", "warn");
        return;
    }

    const now = new Date();
    await sendLogToUI(`--- Kiểm tra: ${now.toLocaleTimeString()} ---`);

    try {
        const response = await fetch(`${URL_API}?t=${Date.now()}`, { 
            method: "GET",
            redirect: "follow", 
            cache: "no-store" 
        });

        if (!response.ok) throw new Error("Kết nối API thất bại");
        const result = await response.json(); 
        
        const totalTasks = result.total_tasks_today || 0;
        const tasks = result.tasks_details || [];

        // Logic kiểm tra khoảng thời gian thông báo
        const db = await openNotifyDB();
        const lastNotify = await getNotifyLog(db);
        const diff = now.getTime() - (lastNotify || 0);

        // Xác định thời gian chờ: Nếu không có task thì 5 phút (300.000ms), có task thì 1 giờ (3.600.000ms)
        const waitTime = totalTasks > 0 ? 3600000 : 300000;

        if (diff >= waitTime || isForced) {
            const taskSummary = tasks.slice(0, 3).map(t => `• ${t.title}`).join('\n');
            const extraTasks = totalTasks > 3 ? `\n... và ${totalTasks - 3} việc khác.` : '';
            
            await self.registration.showNotification("Todo Manager Pro", {
                body: totalTasks > 0 ? `Hôm nay bạn có ${totalTasks} việc:\n${taskSummary}${extraTasks}` : "Bạn chưa có công việc nào cho hôm nay. Hãy thêm ngay!",
                icon: "https://cdn-icons-png.flaticon.com/512/10691/10691830.png",
                tag: "daily-reminder-" + (isForced ? Date.now() : "fixed"),
                renotify: true,
                requireInteraction: true,
                data: { url: "/" } 
            });

            if (db) await setNotifyLog(db, now.getTime());
            await sendLogToUI("🔔 Thông báo đã được hiển thị!", "success");
        } else {
            const minutesLeft = Math.ceil((waitTime - diff) / 60000);
            await sendLogToUI(`Bỏ qua: Cần chờ thêm ${minutesLeft} phút nữa.`);
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

// --- XỬ LÝ SỰ KIỆN ---
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
    checkAndNotify();
    // Vòng lặp kiểm tra API mỗi 5 phút để khớp với yêu cầu thông báo nhanh nhất
    setInterval(checkAndNotify, 300000); 
});

// Lắng nghe lệnh từ file index.html
self.onmessage = (event) => {
    if (event.data.action === 'test_notify_now') {
        checkAndNotify(true);
    }
    if (event.data.action === 'set_notify_status') {
        isNotifyEnabled = event.data.value;
        const statusText = isNotifyEnabled ? "BẬT" : "TẮT";
        sendLogToUI(`Đã chuyển trạng thái hệ thống sang: ${statusText}`, "warn");
    }
};

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.matchAll({ type: 'window' }).then(cl => {
        if (cl.length > 0) return cl[0].focus();
        return clients.openWindow('/');
    }));
});