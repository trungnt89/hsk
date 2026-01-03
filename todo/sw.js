// sw.js

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Lắng nghe lệnh hiển thị thông báo
self.onmessage = (event) => {
    if (event.data === 'trigger-notify') {
        self.registration.showNotification('Thành công!', {
            body: 'Nhấn vào đây để xem trang notify.html',
            icon: 'https://cdn-icons-png.flaticon.com/512/252/252035.png',
            data: { url: 'notify.html' } // Lưu đường dẫn vào dữ liệu thông báo
        });
    }
};

// Xử lý sự kiện CLICK vào thông báo
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // Đóng thông báo ngay khi click

    // Lấy URL từ dữ liệu đã lưu hoặc mặc định là notify.html
    const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Kiểm tra xem trang notify.html đã mở sẵn chưa
            for (let client of windowClients) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // Nếu chưa mở, thực hiện mở tab mới
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});