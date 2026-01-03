self.onmessage = (event) => {
    console.log('SW nhận được lệnh:', event.data);
    if (event.data === 'trigger-notify') {
        const title = 'Hello World!';
        const options = {
            body: 'Thông báo từ Service Worker',
            requireInteraction: true // Thông báo sẽ không biến mất cho đến khi bạn click
        };
        
        // Dùng self.registration để hiển thị
        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    }
};