const DB_NAME = "TodoDBPro";
const STORE_NAME = "tasks_store";

async function checkAndNotify() {
    // CHỈ CHẠY NẾU ĐÃ CÓ QUYỀN
	console.log(1)
	console.log(Notification.permission)
    if (Notification.permission === 'granted') {
		console.log(2)
        const request = indexedDB.open(DB_NAME, 1);
        request.onsuccess = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) return;
            
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const getReq = store.get("current_tasks_list");

            getReq.onsuccess = () => {
                const tasks = getReq.result?.data || [];
                const today = new Date().toDateString();
                const hasTaskToday = tasks.some(t => new Date(t.deadline).toDateString() === today);

                if (!hasTaskToday) {
                    self.registration.showNotification("📋 Nhắc nhở Todo", {
                        body: "Hôm nay bạn chưa có công việc nào. Hãy tạo việc mới ngay!",
                        icon: "https://cdn-icons-png.flaticon.com/512/906/906334.png",
                        tag: "remind-test",
                        requireInteraction: true
                    });
                }
            };
        };
    }
	console.log(3)
}
setInterval(checkAndNotify, 1000);