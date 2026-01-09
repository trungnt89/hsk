/**
 * DB SYNC MODULE - PREMIUM STABLE 2026
 * Tính năng: Key động [DB|Store], Confirm, Toast & Auto-Reload
 * Đảm bảo dữ liệu mới được áp dụng ngay lập tức sau khi khôi phục.
 */

const DBSyncModule = (function() {
    const config = {
        gasUrl: "https://script.google.com/macros/s/AKfycbz-CilJVS0UgOFRHtgF8fhaGA7IM8sNE4vOZYkvZugKp6XlyesS058QeFJbTZ4ZTA_q/exec",
        configDB: "GAS_Config"
    };

    const UI = {
        showToast: function(msg, type = 'success') {
            const existing = document.getElementById('sync-toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.id = 'sync-toast';
            const colors = {
                success: '#2ecc71',
                error: '#e74c3c',
                info: '#3498db'
            };
            
            toast.style = `
                position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
                background: ${colors[type]}; color: white; padding: 14px 28px; 
                border-radius: 50px; font-size: 14px; font-weight: 600; z-index: 20000;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2); transition: all 0.3s ease;
                display: flex; align-items: center; gap: 10px; animation: slideUp 0.4s ease forwards;
            `;
            
            const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
            toast.innerHTML = `<span>${icon}</span> ${msg}`;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(20px)';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    };

    const style = document.createElement('style');
    style.innerHTML = ` @keyframes slideUp { from { bottom: -50px; opacity: 0; } to { bottom: 30px; opacity: 1; } } `;
    document.head.appendChild(style);

    async function getDbStorePairs() {
        const pairs = [];
        try {
            const dbs = await indexedDB.databases();
            for (const dbInfo of dbs) {
                if (dbInfo.name === config.configDB) continue;
                await new Promise((resolve) => {
                    const req = indexedDB.open(dbInfo.name);
                    req.onsuccess = (e) => {
                        const db = e.target.result;
                        Array.from(db.objectStoreNames).forEach(storeName => {
                            pairs.push({
                                label: `${dbInfo.name} » ${storeName}`,
                                value: `${dbInfo.name}|${storeName}`
                            });
                        });
                        db.close();
                        resolve();
                    };
                    req.onerror = () => resolve();
                });
            }
        } catch (e) { console.error("Lỗi quét DB:", e); }
        return pairs.length ? pairs : [{label: "Default DB", value: "TodoDBPro|tasks"}];
    }

    async function initUI() {
        const containerId = 'module-sync-container';
        if (document.getElementById(containerId)) document.getElementById(containerId).remove();

        const pairs = await getDbStorePairs();
        let target = document.querySelector('.header') || document.querySelector('.container') || document.body;
        
        const container = document.createElement('div');
        container.id = containerId;
        container.style = `
            margin: 20px auto; padding: 25px; background: white;
            border-radius: 24px; border: 1px solid #f0f0f0; width: 95%; max-width: 480px;
            box-shadow: 0 15px 40px rgba(0,0,0,0.06); box-sizing: border-box;
            font-family: system-ui, -apple-system, sans-serif;
        `;

        container.innerHTML = `
            <div style="font-size: 11px; font-weight: 800; color: #6366f1; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;">Cloud Sync Engine</div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <select id="module-db-select" style="width: 100%; padding: 14px; border-radius: 14px; border: 2px solid #f3f4f6; font-size: 14px; outline: none; background: #fafafa; font-weight: 500;">
                    ${pairs.map(p => `<option value="${p.value}">${p.label}</option>`).join('')}
                </select>
                <div style="display: flex; gap: 10px;">
                    <button id="btn-module-up" style="flex: 1; background: #6366f1; color: white; border: none; padding: 14px; border-radius: 14px; cursor: pointer; font-weight: 700; font-size: 14px;">📤 Sao lưu</button>
                    <button id="btn-module-down" style="flex: 1; background: #10b981; color: white; border: none; padding: 14px; border-radius: 14px; cursor: pointer; font-weight: 700; font-size: 14px;">📥 Khôi phục</button>
                </div>
            </div>
        `;

        target.appendChild(container);

        document.getElementById('btn-module-up').onclick = () => handleSync('upload');
        document.getElementById('btn-module-down').onclick = () => handleSync('download');
    }

    async function handleSync(action) {
        const select = document.getElementById('module-db-select');
        const combinedValue = select.value;
        const [dbName, storeName] = combinedValue.split('|');
        const cloudKey = `${dbName}_${storeName}`;

        const confirmMsg = action === 'upload' 
            ? `Bạn có chắc muốn SAO LƯU bảng [${storeName}] lên Cloud?\nDữ liệu cũ trên Drive sẽ bị ghi đè.` 
            : `Xác nhận KHÔI PHỤC bảng [${storeName}]?\nTrang web sẽ tự động reload sau khi hoàn tất.`;
        
        if (!confirm(confirmMsg)) return;

        const btn = action === 'upload' ? document.getElementById('btn-module-up') : document.getElementById('btn-module-down');
        btn.disabled = true;
        const originalText = btn.innerText;
        btn.innerText = "⏳...";

        const request = indexedDB.open(dbName);
        request.onsuccess = async (e) => {
            const db = e.target.result;
            
            try {
                if (action === 'upload') {
                    const tx = db.transaction(storeName, "readonly");
                    const store = tx.objectStore(storeName);
                    const allData = {};
                    
                    store.openCursor().onsuccess = async (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            allData[cursor.key] = cursor.value;
                            cursor.continue();
                        } else {
                            await fetch(config.gasUrl, {
                                method: 'POST',
                                mode: 'no-cors',
                                body: JSON.stringify({ key: cloudKey, value: allData })
                            });
                            UI.showToast(`Sao lưu [${storeName}] thành công!`);
                            finish();
                        }
                    };
                } else {
                    const res = await fetch(`${config.gasUrl}?key=${encodeURIComponent(cloudKey)}`);
                    const data = await res.json();

                    if (!data || Object.keys(data).length === 0) {
                        UI.showToast("Dữ liệu Cloud trống!", "error");
                        return finish();
                    }

                    const tx = db.transaction(storeName, "readwrite");
                    const store = tx.objectStore(storeName);
                    
                    store.clear().onsuccess = () => {
                        Object.keys(data).forEach(k => {
                            if (store.keyPath) store.put(data[k]);
                            else store.put(data[k], k);
                        });
                    };
                    
                    tx.oncomplete = () => {
                        UI.showToast(`Khôi phục [${storeName}] thành công! Đang tải lại...`);
                        setTimeout(() => {
                            window.location.reload();
                        }, 1200); // Reload sau 1.2s để người dùng thấy thông báo thành công
                    };
                }
            } catch (err) {
                UI.showToast("Lỗi kết nối hoặc hệ thống", "error");
                finish();
            }

            function finish() {
                btn.disabled = false;
                btn.innerText = originalText;
                db.close();
            }
        };
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI);
    else initUI();

    return { refresh: initUI };
})();