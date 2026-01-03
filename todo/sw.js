// sw.js
self.addEventListener('push', function(event) {
    const options = {
        body: 'Đây là tin nhắn từ Service Worker!',
        icon: 'https://cdn-icons-png.flaticon.com/512/252/252035.png'
    };

    event.waitUntil(
        self.registration.showNotification('Hello World!', options)
    );
});

// Hàm tự kích hoạt thông báo để test ngay khi cài đặt xong
self.onmessage = (event) => {
    if (event.data === 'trigger-notify') {
        self.registration.showNotification('Hello World!', {
            body: 'Thông báo đã được kích hoạt thành công!',
        });
    }
};