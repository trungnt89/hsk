/**
 * DB SYNC MODULE - PREMIUM STABLE 2026
 * Tác giả: Gemini Thought Partner
 * Tính năng: Tự động hóa hoàn toàn, Key động theo Database, UI Glassmorphism
 */

const DBSyncModule = (function() {
    const config = {
        gasUrl: "https://script.google.com/macros/s/AKfycbz-CilJVS0UgOFRHtgF8fhaGA7IM8sNE4vOZYkvZugKp6XlyesS058QeFJbTZ4ZTA_q/exec",
        configDB: "GAS_Config"
    };

    // --- 1. HỆ THỐNG TOAST THÔNG BÁO ---
    const UI = {
        showStatus: function(msg, type = 'success') {
            const toast = document.createElement('div');
            const bg = type === 'success' 
                ? 'linear-gradient(135deg, #27ae60, #2ecc71)' 
                : 'linear-gradient(135deg, #e74c3c, #ff7675)';
            
            toast.style = `
                position: fixed; top: 25px; left: 50%; transform: translateX(-50%) translateY(-120px);
                background: ${bg}; color: white; padding: 14px 28px; border-radius: 18px;
                font-size: 14px; font-weight: 700; box-shadow: 0 12px 35px rgba(0,0,0,0.2);
                z-index: 10005; transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                display: flex; align-items: center; gap: 10px; border: 1px solid rgba(255,255,255,0.2);
            `;
            
            toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> ${msg}`;
            document.body.appendChild(toast);
            setTimeout(() => toast.style.transform = 'translateX(-50%) translateY(0)', 100);
            
            setTimeout(() => {
                toast.style.transform = 'translateX(-50%) translateY(-120px)';
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 500);
            }, 3500);
        }
    };

    // --- 2. KHỞI TẠO GIAO DIỆN ---
    async function initUI() {
        if (document.getElementById('module-sync-container')) return;

        let target = document.querySelector('.header') || document.querySelector('.container') || document.body;
        const dbNames = await getAllDatabases();
        
        const container = document.createElement('div');
        container.id = "module-sync-container";
        container.style = `
            margin: 20px auto; padding: 22px; background: rgba(255, 255, 255, 0.95);
            border-radius: 30px; border: 1px solid #edf2f7;
            box-shadow: 0 15px 35px rgba(0,0,0,0.05); width: 95%; max-width: 450px;
            display: flex; flex-direction: column; gap: 15px; box-sizing: border-box;
        `;

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 5px;">
                <span style="font-size: 11px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 1.5px;">Cloud Sync Engine</span>
                <div id="module-indicator" style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px #10b981;"></div>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <select id="module-db-select" style="flex: 1.2; padding: 14px; border-radius: 18px; border: 2px solid #f1f5f9; font-weight: 600; font-size: 13px; outline: none; background: #f8fafc; color: #1e293b; cursor: pointer;">
                    ${dbNames.map(name => `<option value="${name}">${name}</option>`).join('')}
                </select>
                
                <button id="btn-module-upload" style="flex: 1; background: #6366f1; color: white; border: none; padding: 14px; border-radius: 18px; font-weight: 700; font-size: 13px; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">Sao lưu</button>
                
                <button id="btn-module-download" style="flex: 1; background: #10b981; color: white; border: none; padding: 14px; border-radius: 18px; font-weight: 700; font-size: 13px; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">Khôi phục</button>
            </div>
            <div id="module-status-text" style="font-size: 11px; color: #94a3b8; text-align: center; font-weight: 600;">Sẵn sàng đồng bộ đa Database</div>
        `;

        target.appendChild(container);

        // Hiệu ứng Hover/Active
        const style = document.createElement('style');
        style.innerHTML = `.sync-btn-active:active { transform: scale(0.95); opacity: 0.9; }`;
        document.head.appendChild(style);
        
        document.getElementById('btn-module-upload').classList.add('sync-btn-active');
        document.getElementById('btn-module-download').classList.add('sync-btn-active');

        document.getElementById('btn-module-upload').onclick = handleUpload;
        document.getElementById('btn-module-download').onclick = handleDownload;
    }

    // --- 3. LOGIC SAO LƯU (SỬ DỤNG KEY LÀ TÊN DB) ---
    async function handleUpload() {
        const dbName = document.getElementById('module-db-select').value;
        const btn = document.getElementById('btn-module-upload');
        const statusText = document.getElementById('module-status-text');
        
        btn.disabled = true;
        btn.innerText = "⏳ Lưu...";

        const request = indexedDB.open(dbName);
        request.onsuccess = (e) => {
            const db = e.target.result;
            const storeName = db.objectStoreNames[0]; // Tự động lấy store đầu tiên
            if (!storeName) {
                UI.showStatus("Database này rỗng!", "error");
                btn.disabled = false;
                btn.innerText = "Sao lưu";
                return;
            }

            const tx = db.transaction(storeName, "readonly");
            const allData = {};
            
            tx.objectStore(storeName).openCursor().onsuccess = async (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    allData[cursor.key] = cursor.value;
                    cursor.continue();
                } else {
                    try {
                        // Gửi key là dbName để tách biệt dữ liệu trên Cloud
                        await fetch(config.gasUrl, {
                            method: 'POST',
                            mode: 'no-cors',
                            body: JSON.stringify({ key: dbName, value: allData })
                        });
                        UI.showStatus(`Đã sao lưu [${dbName}] thành công!`);
                        statusText.innerText = `Lần cuối: ${new Date().toLocaleTimeString()}`;
                    } catch (err) {
                        UI.showStatus("Lỗi kết nối Server", "error");
                    }
                    btn.disabled = false;
                    btn.innerText = "Sao lưu";
                    db.close();
                }
            };
        };
    }

    // --- 4. LOGIC KHÔI PHỤC (FIX DATAERROR + KEY ĐỘNG) ---
    async function handleDownload() {
        const dbName = document.getElementById('module-db-select').value;
        const btn = document.getElementById('btn-module-download');
        
        if (!confirm(`Tải dữ liệu Cloud của [${dbName}] và ghi đè máy này?`)) return;

        btn.disabled = true;
        btn.innerText = "⏳ Tải...";

        try {
            // Lấy dữ liệu theo Key là tên Database
            const res = await fetch(`${config.gasUrl}?key=${encodeURIComponent(dbName)}`);
            const data = await res.json();

            if (!data || Object.keys(data).length === 0) throw new Error("Empty");

            const request = indexedDB.open(dbName);
            request.onsuccess = (e) => {
                const db = e.target.result;
                const storeName = db.objectStoreNames[0];
                const tx = db.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);
                
                store.clear().onsuccess = () => {
                    Object.keys(data).forEach(k => {
                        const record = data[k];
                        // FIXED: Auto-detect in-line vs out-of-line keys
                        if (store.keyPath) {
                            store.put(record); // Key đã nằm trong object
                        } else {
                            store.put(record, k); // Key nằm ngoài object
                        }
                    });
                };
                
                tx.oncomplete = () => {
                    UI.showStatus(`Đã khôi phục [${dbName}] từ Cloud!`);
                    // Gọi callback load lại dữ liệu nếu có
                    if (typeof loadTasksFromDB === 'function') loadTasksFromDB();
                    if (typeof renderTasks === 'function') renderTasks();
                    btn.disabled = false;
                    btn.innerText = "Khôi phục";
                    db.close();
                };
            };
        } catch (err) {
            UI.showStatus(`Cloud chưa có dữ liệu cho [${dbName}]`, "error");
            btn.disabled = false;
            btn.innerText = "Khôi phục";
        }
    }

    async function getAllDatabases() {
        try {
            const dbs = await indexedDB.databases();
            const names = dbs.map(db => db.name).filter(n => n !== config.configDB);
            return names.length ? names : ["TodoDBPro"];
        } catch (e) { return ["TodoDBPro"]; }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI);
    else initUI();

    return { refreshDB: initUI };
})();