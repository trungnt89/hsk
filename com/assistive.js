(function() {
    // --- PART 1: DB SYNC MODULE (CORE LOGIC) ---
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
                const colors = { success: '#2ecc71', error: '#e74c3c', info: '#3498db' };
                toast.style = `position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: ${colors[type]}; color: white; padding: 14px 28px; border-radius: 50px; font-size: 14px; font-weight: 600; z-index: 20000; box-shadow: 0 10px 25px rgba(0,0,0,0.2); transition: all 0.3s ease; display: flex; align-items: center; gap: 10px; animation: slideUp 0.4s ease forwards;`;
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
                            Array.from(db.objectStoreNames).forEach(name => {
                                pairs.push({ label: `${dbInfo.name} » ${name}`, value: `${dbInfo.name}|${name}` });
                            });
                            db.close(); resolve();
                        };
                        req.onerror = () => resolve();
                    });
                }
            } catch (e) { console.error(e); }
            return pairs.length ? pairs : [{label: "Default DB", value: "TodoDBPro|tasks"}];
        }

        async function toggleSyncUI() {
            const containerId = 'module-sync-container';
            const existing = document.getElementById(containerId);
            if (existing) {
                existing.remove();
                return;
            }

            const pairs = await getDbStorePairs();
            const container = document.createElement('div');
            container.id = containerId;
            container.style = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10005; margin: 0; padding: 25px; background: white; border-radius: 24px; border: 1px solid #f0f0f0; width: 90%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); font-family: system-ui, sans-serif;`;

            container.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <span style="font-size: 11px; font-weight: 800; color: #6366f1; text-transform: uppercase;">Cloud Sync Engine</span>
                    <button onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; cursor:pointer; font-size:18px;">✕</button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <select id="module-db-select" style="width: 100%; padding: 12px; border-radius: 12px; border: 2px solid #f3f4f6; outline: none;">
                        ${pairs.map(p => `<option value="${p.value}">${p.label}</option>`).join('')}
                    </select>
                    <div style="display: flex; gap: 10px;">
                        <button id="btn-module-up" style="flex: 1; background: #6366f1; color: white; border: none; padding: 12px; border-radius: 12px; cursor: pointer; font-weight: 700;">📤 Sao lưu</button>
                        <button id="btn-module-down" style="flex: 1; background: #10b981; color: white; border: none; padding: 12px; border-radius: 12px; cursor: pointer; font-weight: 700;">📥 Khôi phục</button>
                    </div>
                </div>`;

            document.body.appendChild(container);
            document.getElementById('btn-module-up').onclick = () => handleSync('upload');
            document.getElementById('btn-module-down').onclick = () => handleSync('download');
        }

        async function handleSync(action) {
            const val = document.getElementById('module-db-select').value;
            const [dbName, storeName] = val.split('|');
            const cloudKey = storeName;

            if (!confirm(action === 'upload' ? `Sao lưu [${storeName}] lên Cloud?` : `Khôi phục [${storeName}] từ Cloud? Trang sẽ reload.`)) return;

            const btn = document.getElementById(action === 'upload' ? 'btn-module-up' : 'btn-module-down');
            btn.disabled = true; btn.innerText = "⏳...";

            const request = indexedDB.open(dbName);
            request.onsuccess = async (e) => {
                const db = e.target.result;
                try {
                    if (action === 'upload') {
                        const tx = db.transaction(storeName, "readonly");
                        const allData = {};
                        tx.objectStore(storeName).openCursor().onsuccess = async (event) => {
                            const cursor = event.target.result;
                            if (cursor) { allData[cursor.key] = cursor.value; cursor.continue(); }
                            else {
                                await fetch(config.gasUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ key: cloudKey, value: allData }) });
                                UI.showToast(`Đã sao lưu ${storeName}`);
                                btn.disabled = false; btn.innerText = "📤 Sao lưu"; db.close();
                            }
                        };
                    } else {
                        const res = await fetch(`${config.gasUrl}?key=${encodeURIComponent(cloudKey)}`);
                        const data = await res.json();
                        if (!data || Object.keys(data).length === 0) throw new Error();
                        const tx = db.transaction(storeName, "readwrite");
                        const store = tx.objectStore(storeName);
                        store.clear().onsuccess = () => {
                            Object.keys(data).forEach(k => store.keyPath ? store.put(data[k]) : store.put(data[k], k));
                        };
                        tx.oncomplete = () => {
                            UI.showToast("Thành công! Đang tải lại...");
                            setTimeout(() => window.location.reload(), 1200);
                        };
                    }
                } catch (err) { UI.showToast("Lỗi xử lý!", "error"); btn.disabled = false; btn.innerText = action === 'upload' ? "📤 Sao lưu" : "📥 Khôi phục"; db.close(); }
            };
        }

        return { toggle: toggleSyncUI };
    })();

    // --- PART 2: ASSISTIVE TOUCH UI ---
    function initAssistiveTouch() {
        if (!document.body) return;

        const styleSheet = document.createElement("style");
        styleSheet.innerText = `
            #assistive-touch { position: fixed; top: 150px; right: 20px; width: 50px; height: 50px; background: rgba(0, 0, 0, 0.6); border: 4px solid rgba(255, 255, 255, 0.3); border-radius: 12px; z-index: 10000; cursor: move; touch-action: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(0,0,0,0.3); }
            #assistive-touch::after { content: ""; width: 28px; height: 28px; background: rgba(255, 255, 255, 0.8); border-radius: 50%; }
            #assistive-menu { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: none; z-index: 10001; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
            .menu-grid { display: grid; grid-template-columns: repeat(3, 80px); gap: 20px; background: rgba(30, 30, 30, 0.9); padding: 25px; border-radius: 20px; }
            .menu-item { display: flex; flex-direction: column; align-items: center; color: white; cursor: pointer; font-size: 11px; font-family: sans-serif; gap: 8px; }
            .item-icon { width: 45px; height: 45px; background: #444; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
            @keyframes slideUp { from { bottom: -50px; opacity: 0; } to { bottom: 30px; opacity: 1; } }
        `;
        document.head.appendChild(styleSheet);

        const button = document.createElement('div');
        button.id = 'assistive-touch';
        const menu = document.createElement('div');
        menu.id = 'assistive-menu';
        menu.innerHTML = `
            <div class="menu-grid">
                <div class="menu-item" onclick="window.history.back()"><div class="item-icon">⬅️</div><span>Back</span></div>
                <div class="menu-item" onclick="location.reload()"><div class="item-icon">🔄</div><span>Reload</span></div>
                <div class="menu-item" onclick="window.scrollTo({top: 0, behavior: 'smooth'})"><div class="item-icon">⬆️</div><span>Top</span></div>
                <div class="menu-item" onclick="location.href='index.html'"><div class="item-icon">🏠</div><span>Home</span></div>
                <div class="menu-item" id="sync-trigger"><div class="item-icon">☁️</div><span>Sync</span></div>
                <div class="menu-item" id="close-menu"><div class="item-icon">❌</div><span>Close</span></div>
            </div>`;

        document.body.appendChild(button);
        document.body.appendChild(menu);

        // Logic Drag & Drop
        let isDragging = false, startPos = { x: 0, y: 0 }, offset = { x: 0, y: 0 };
        const onStart = (e) => {
            const cX = e.touches ? e.touches[0].clientX : e.clientX;
            const cY = e.touches ? e.touches[0].clientY : e.clientY;
            isDragging = false; startPos.x = cX; startPos.y = cY;
            offset.x = cX - button.offsetLeft; offset.y = cY - button.offsetTop;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('touchmove', onMove, { passive: false });
        };
        const onMove = (e) => {
            const cX = e.touches ? e.touches[0].clientX : e.clientX;
            const cY = e.touches ? e.touches[0].clientY : e.clientY;
            if (Math.abs(cX - startPos.x) > 5 || Math.abs(cY - startPos.y) > 5) isDragging = true;
            if (isDragging) {
                e.preventDefault();
                let x = Math.max(0, Math.min(cX - offset.x, window.innerWidth - 50));
                let y = Math.max(0, Math.min(cY - offset.y, window.innerHeight - 50));
                button.style.left = x + 'px'; button.style.top = y + 'px'; button.style.right = 'auto';
            }
        };
        button.addEventListener('mousedown', onStart);
        button.addEventListener('touchstart', onStart);
        window.addEventListener('mouseup', () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('touchmove', onMove); });

        // Logic Click
        button.addEventListener('click', () => { if (!isDragging) menu.style.display = 'flex'; });
        menu.addEventListener('click', (e) => {
            if (e.target === menu || e.target.closest('#close-menu')) menu.style.display = 'none';
            if (e.target.closest('#sync-trigger')) {
                menu.style.display = 'none';
                DBSyncModule.toggle();
            }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAssistiveTouch);
    else initAssistiveTouch();
})();