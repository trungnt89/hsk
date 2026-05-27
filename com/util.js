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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await response.json();
    } catch (e) {
        console.error("[Ajax Error]:", e);
        return { status: 'error', message: "Lỗi kết nối server" };
    }
}