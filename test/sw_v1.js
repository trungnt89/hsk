// sw.js
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Ép SW mới hoạt động ngay
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim()); // Kiểm soát tất cả các tab ngay lập tức
});

self.onmessage = (event) => {
    console.log('SW nhận được lệnh:', event.data);
    if (event.data === 'trigger-notify') {
        self.registration.showNotification('Hello World!', {
            body: 'Thông báo đã được kích hoạt thành công!',
            icon: 'https://cdn-icons-png.flaticon.com/512/252/252035.png'
        });
    }
};