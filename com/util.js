const DB_NAME = 'TodoAppDB';

function openDB(storeName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getFromDB(storeName,key) {
    try {
        const db = await openDB(storeName);
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => {
                if (request.result) {
                    try {
                        resolve(JSON.parse(request.result));
                    } catch (pErr) {
                        resolve([]);
                    }
                } else {
                    resolve([]);
                }
            };
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error("IndexedDB Get Error:", err);
        return [];
    }
}

async function saveToDB(storeName,key, data) {
    try {
        const db = await openDB(storeName);
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        
        const dataString = JSON.stringify(data);
        store.put(dataString, key); 
        return tx.complete;
    } catch (err) {
        console.error("IndexedDB Save Error:", err);
    }
}

async function deleteFromDB(storeName,key) {
    try {
        const db = await openDB(storeName);
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.delete(key);
        return tx.complete;
    } catch (err) {
        console.error("IndexedDB Delete Error:", err);
    }
}

async function callAjax(url, body) {
    try {

        const response = await fetch(url, {
            method: 'POST',
			headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        return await response.json();
    } catch (e) {
        console.error("[Ajax Error]:", e);
        return { status: 'error', message: "Lỗi kết nối server" };
    }
}

const originalFetch = window.fetch;
window.fetch = async function (...args) {
  // 1. Lấy hoặc khởi tạo đối tượng options (args[1])
  let url = args[0];
  let options = args[1] || {};

  // 2. Khởi tạo đối tượng headers nếu chưa có
  options.headers = options.headers || {};

  // 3. Lấy token từ localStorage (hoặc nơi bạn lưu trữ)
  const token = localStorage.getItem('token');

  // 4. Nếu có token, tự động thêm vào Header (Ví dụ: Bearer Token)
  if (token) {
    // Nếu options.headers là một đối tượng Headers thuần của Fetch API
    if (options.headers instanceof Headers) {
      options.headers.set('Authorization', `Bearer ${token}`);
    } else {
      // Nếu options.headers là một Object thường {}
      options.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Cập nhật lại args[1] trước khi gọi fetch gốc
  args[1] = options;

  try {
    // Gọi fetch gốc với args đã được thêm Header
    const response = await originalFetch(...args);

    // Bắt lỗi 401 tại đây
    if (response.status === 401) {
      console.warn("Token không hợp lệ hoặc hết hạn! Đang chuyển hướng...");
      
      // Xóa token cũ nếu cần
      localStorage.removeItem('token'); 
      
      // Chuyển hướng về trang login
      window.location.href = 'https://hsk-gilt.vercel.app/index.html';
    }
    return response;
  } catch (error) {
    return Promise.reject(error);
  }
};
