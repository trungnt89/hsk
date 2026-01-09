/**
 * DB SYNC MODULE - PREMIUM & STABLE VERSION 2026
 * Tính năng: Quét DB, Đồng bộ GAS, UI Modern, Auto-Fix DataError
 */

const DBSyncModule = (function() {
    const config = {
        gasUrl: "https://script.google.com/macros/s/AKfycbz-CilJVS0UgOFRHtgF8fhaGA7IM8sNE4vOZYkvZugKp6XlyesS058QeFJbTZ4ZTA_q/exec",
        configDB: "GAS_Config"
    };

    // --- 1. HỆ THỐNG THÔNG BÁO TOAST CHUYÊN NGHIỆP ---
    const UI = {
        showStatus: function(msg, type = 'success') {
            const toast = document.createElement('div');
            const bg = type === 'success' 
                ? 'linear-gradient(135deg, #27ae60, #2ecc71)' 
                : 'linear-gradient(135deg, #e74c3c, #ff7675)';
            
            toast.style = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-100px);
                background: ${bg}; color: white; padding: 12px 25px; border-radius: 16px;
                font-size: 14px; font-weight: 700; box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                z-index: 10005; transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                display: flex; align-items: center; gap: 10px; pointer-events: none; border: 1px solid rgba(255,255,255,0.2);
            `;
            
            toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> ${msg}`;
            document.body.appendChild(toast);

            setTimeout(() => { toast.style.transform = 'translateX(-50%) translateY(0)'; }, 100);
            
            setTimeout(() => {
                toast.style.transform = 'translateX(-50%) translateY(-100px)';
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 500);
            }, 3000);
        }
    };

    // --- 2. GIAO DIỆN ĐIỀU KHIỂN (MODERN DESIGN) ---
    async function initUI() {
        if (document.getElementById('module-sync-container')) return;

        let target = document.querySelector('.header') || document.querySelector('.container') || document.body;
        if (!target) return;

        const dbNames = await getAllDatabases();
        const container = document.createElement('div');
        container.id = "module-sync-container";
        
        container.style = `
            margin: 15px 0; padding: 20px; background: #ffffff;
            border-radius: 28px; border: 1px solid #f1f2f6;
            box-shadow: 0 10px 25px rgba(0,0,0,0.03);
            display: flex; flex-direction: column; gap: 12px;
        `;

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 5px;">
                <span style="font-size: 11px; font-weight: 800; color: #6c5ce7; text-transform: uppercase; letter-spacing: 1.2px;">Google Drive Sync</span>
                <div id="module-indicator" style="width: 8px; height: 8px; background: #55efc4; border-radius: 50%;"></div>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <select id="module-db-select" style="flex: 1.2; padding: 12px; border-radius: 16px; border: 2px solid #f1f2f6; font-weight: 600; font-size: 13px; outline: none; background: #f8f9fa; appearance: none;">
                    ${dbNames.map(name => `<option value="${name}">${name}</option>`).join('')}
                </select>
                
                <button id="btn-module-upload" style="flex: 1; background: #6c5ce7; color: white; border: none; padding: 12px; border-radius: 16px; font-weight: 700; font-size: 13px; cursor: pointer; transition: 0.3s;">
                    Sao lưu
                </button>
                
                <button id="btn-module-download" style="flex: 1; background: #00b894; color: white; border: none; padding: 12px; border-radius: 16px; font-weight: 700; font-size: 13px; cursor: pointer; transition: 0.3s;">
                    Khôi phục
                </button>
            </div>
            <div id="module-status-text" style="font-size: 10px; color: #b2bec3; text-align: center; font-weight: 600;">Sẵn sàng đồng bộ dữ liệu</div>
        `;

        target.appendChild(container);

        // Hiệu ứng bấm nút
        [document.getElementById('btn-module-upload'), document.getElementById('btn-module-download')].forEach(btn => {
            btn.onmousedown = () => btn.style.transform = 'scale(0.96)';
            btn.onmouseup = () => btn.style.transform = 'scale(1)';
        });

        document.getElementById('btn-module-upload').onclick = handleUpload;
        document.getElementById('btn-module-download').onclick = handleDownload;
    }

    // --- 3. LOGIC SAO LƯU (UPLOAD) ---
    async function handleUpload() {
        const dbName = document.getElementById('module-db-select').value;
        const btn = document.getElementById('btn-module-upload');
        const statusText = document.getElementById('module-status-text');
        
        btn.disabled = true;
        btn.innerText = "⏳ Đang lưu...";

        const request = indexedDB.open(dbName);
        request.onsuccess = (e) => {
            const db = e.target.result;
            const storeName = db.objectStoreNames[0] || "tasks_store";
            const tx = db.transaction(storeName, "readonly");
            const allData = {};
            
            tx.objectStore(storeName).openCursor().onsuccess = async (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    allData[cursor.key] = cursor.value;
                    cursor.continue();
                } else {
                    try {
                        await fetch(config.gasUrl, {
                            method: 'POST',
                            mode: 'no-cors',
                            body: JSON.stringify({ key: storeName, value: allData })
                        });
                        UI.showStatus(`Đã sao lưu ${dbName} thành công!`);
                        statusText.innerText = `Cập nhật lúc: ${new Date().toLocaleTimeString()}`;
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

    // --- 4. LOGIC KHÔI PHỤC (DOWNLOAD) - FIXED DATAERROR ---
    async function handleDownload() {
        const dbName = document.getElementById('module-db-select').value;
        const btn = document.getElementById('btn-module-download');
        
        if (!confirm(`Tải dữ liệu Cloud sẽ ghi đè vào [${dbName}]. Tiếp tục?`)) return;

        btn.disabled = true;
        btn.innerText = "⏳ Tải...";

        try {
            const storeName = "tasks_store";
            const res = await fetch(`${config.gasUrl}?key=${storeName}`);
            const data = await res.json();

            if (!data) throw new Error();

            const request = indexedDB.open(dbName);
            request.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);
                
                // Xóa dữ liệu cũ trước khi khôi phục để đảm bảo sạch sẽ
                store.clear().onsuccess = () => {
                    Object.keys(data).forEach(k => {
                        const record = data[k];
                        // AUTO-DETECT: Nếu store có keyPath, không truyền tham số key k vào put()
                        if (store.keyPath) {
                            store.put(record);
                        } else {
                            store.put(record, k);
                        }
                    });
                };
                
                tx.oncomplete = () => {
                    UI.showStatus("Đã khôi phục dữ liệu Cloud!");
                    if (typeof loadTasksFromDB === 'function') loadTasksFromDB();
                    btn.disabled = false;
                    btn.innerText = "Khôi phục";
                    db.close();
                };
            };
        } catch (err) {
            UI.showStatus("Không có dữ liệu trên Cloud!", "error");
            btn.disabled = false;
            btn.innerText = "Khôi phục";
        }
    }

    // --- 5. TIỆN ÍCH QUÉT DATABASE ---
    async function getAllDatabases() {
        try {
            const dbs = await indexedDB.databases();
            const names = dbs.map(db => db.name).filter(n => n !== config.configDB);
            return names.length ? names : ["TodoDBPro"];
        } catch (e) { return ["TodoDBPro"]; }
    }

    // Khởi chạy an toàn
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI);
    else initUI();

    return { refresh: initUI };
})();