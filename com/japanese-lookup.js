/**
 * Japanese Lookup & Vocabulary Manager - Version 2026
 * - Engine: MyMemory (Default) with Google Fallback
 * - UI: Anti-collision Popup & History Manager
 * - Module: ES6 Export Default
 */

const JapaneseLookup = (() => {
    // 1. CONFIGURATION
    const CONFIG = {
        engine: 'mymemory',
        gas_url: "https://script.google.com/macros/s/AKfycbxRsR4M3R0rjz3i0u2kz6Pg-ME3IeDYs8-7GE0MrjRaakfxQBory3JMtjjgVw3lTbqI/exec",
        google_api: "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&dt=rm&q=",
        mymemory_api: "https://api.mymemory.translated.net/get?langpair=ja|vi&q="
    };

    // 2. STYLES
    const style = document.createElement('style');
    style.textContent = `
        .ja-lookup-popup {
            position: fixed; z-index: 1000000; background: #fff; border: 1px solid #2563eb;
            border-radius: 12px; padding: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            font-family: system-ui, -apple-system, sans-serif; width: 240px; 
            display: none; pointer-events: auto; max-height: 250px; overflow-y: auto;
        }
        .ja-lookup-word { color: #1e40af; font-size: 1.2em; font-weight: bold; display: block; }
        .ja-lookup-meaning { color: #0f172a; font-size: 1em; border-top: 1px solid #eee; padding-top: 5px; margin-top: 5px; line-height: 1.4; }
        .ja-engine-tag { font-size: 9px; color: #94a3b8; float: right; background: #f1f5f9; padding: 2px 5px; border-radius: 4px; text-transform: uppercase; }
        .ja-history-btn {
            position: fixed; bottom: 80px; right: 20px; width: 50px; height: 50px;
            background: #2563eb; color: white; border-radius: 50%; border: none;
            cursor: pointer; z-index: 9999; font-size: 24px; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
            display: flex; align-items: center; justify-content: center;
        }
        .ja-modal {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); z-index: 1000001; align-items: center; justify-content: center;
        }
        .ja-modal-content {
            background: white; width: 95%; max-width: 500px; height: 85vh;
            border-radius: 20px; display: flex; flex-direction: column; overflow: hidden;
        }
        .ja-modal-header { padding: 15px 20px; border-bottom: 2px solid #2563eb; display: flex; justify-content: space-between; align-items: center; }
        #ja-word-list { flex: 1; overflow-y: auto; padding: 20px; }
        .ja-word-item { padding: 12px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .ja-highlight { color: #dc2626 !important; font-weight: bold; border-bottom: 1px dashed #dc2626; cursor: help; }
        .ja-btn-sm { padding: 6px 10px; border-radius: 6px; border: 1px solid #ddd; background: #fff; cursor: pointer; }
    `;
    document.head.appendChild(style);

    let popup = null, modal = null, globalSavedWords = [];

    // 3. UI GENERATION
    const createUI = () => {
        if (!document.querySelector('.ja-lookup-popup')) {
            popup = document.createElement('div');
            popup.className = 'ja-lookup-popup';
            document.body.appendChild(popup);
        }
        if (!document.querySelector('.ja-history-btn')) {
            const btn = document.createElement('button');
            btn.className = 'ja-history-btn';
            btn.innerHTML = '📚';
            btn.onclick = () => JapaneseLookup.openManager();
            document.body.appendChild(btn);
        }
        if (!document.querySelector('.ja-modal')) {
            modal = document.createElement('div');
            modal.className = 'ja-modal';
            modal.innerHTML = `
                <div class="ja-modal-content">
                    <div class="ja-modal-header">
                        <h3 style="margin:0;">Từ vựng đã lưu</h3>
                        <button onclick="this.closest('.ja-modal').style.display='none'" style="border:none; background:none; font-size:24px; cursor:pointer;">✕</button>
                    </div>
                    <div id="ja-word-list">Đang tải dữ liệu...</div>
                </div>`;
            document.body.appendChild(modal);
        }
    };

    // 4. CORE LOGIC
    async function lookup(text, x, y) {
        if (!text) return;
        createUI();
        console.log(`[Log] Đang tra từ: ${text} bằng ${CONFIG.engine}`);

        popup.style.display = 'block';
        popup.style.visibility = 'hidden';
        popup.innerHTML = `<span class="ja-engine-tag">${CONFIG.engine}</span><div>Đang dịch...</div>`;

        // Timeout nhỏ để trình duyệt render lấy offsetHeight chính xác
        setTimeout(async () => {
            const pWidth = 240;
            const pHeight = popup.offsetHeight;
            
            // Chống tràn lề (X, Y)
            let posX = Math.max(10, Math.min(x, window.innerWidth - pWidth - 20));
            let posY = y + 15;
            if (posY + pHeight > window.innerHeight) {
                posY = y - pHeight - 15;
            }

            popup.style.left = `${posX}px`;
            popup.style.top = `${posY}px`;
            popup.style.visibility = 'visible';

            try {
                let meaning = "";
                // Gọi MyMemory theo cấu hình yêu cầu
                const res = await fetch(CONFIG.mymemory_api + encodeURIComponent(text), {
                    headers: { "accept": "*/*", "accept-language": "en-US,en;q=0.9,ja;q=0.8" },
                    method: "GET", mode: "cors"
                });
                const data = await res.json();
                meaning = data.responseData.translatedText;

                popup.innerHTML = `
                    <span class="ja-engine-tag">${CONFIG.engine}</span>
                    <b class="ja-lookup-word">${text}</b>
                    <div class="ja-lookup-meaning">${meaning}</div>
                `;

                // Sync với Google Sheets
                fetch(CONFIG.gas_url, { 
                    method: "POST", mode: "no-cors", 
                    body: JSON.stringify({ action: "saveWord", word: text, meaning: meaning, engine: CONFIG.engine }) 
                });

            } catch (e) {
                console.error("[Log] Lỗi MyMemory, thử Fallback Google...");
                const gRes = await fetch(CONFIG.google_api + encodeURIComponent(text));
                const gData = await gRes.json();
                popup.innerHTML = `<div>${gData[0][0][0]} <small>(Google)</small></div>`;
            }
        }, 30);
    }

    // 5. EXPORTED OBJECT
    const Module = {
        init: async () => {
            createUI();
            const handleSelection = () => {
                const sel = window.getSelection();
                const text = sel.toString().trim();
                if (text && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
                    const rect = sel.getRangeAt(0).getBoundingClientRect();
                    lookup(text, rect.left, rect.bottom);
                }
            };

            document.addEventListener('mouseup', handleSelection);
            document.addEventListener('touchend', handleSelection);
            document.addEventListener('mousedown', (e) => {
                if (popup && !popup.contains(e.target)) popup.style.display = 'none';
            });
            console.log("[Log] JapaneseLookup Module Initialized.");
        },

        openManager: async () => {
            const m = document.querySelector('.ja-modal');
            m.style.display = 'flex';
            const list = document.getElementById('ja-word-list');
            list.innerHTML = "Đang đồng bộ...";
            try {
                const res = await fetch(CONFIG.gas_url + "?type=words&_t=" + Date.now());
                const words = await res.json();
                list.innerHTML = words.reverse().map(w => `
                    <div class="ja-word-item">
                        <div style="flex:1">
                            <strong style="color:#1e40af;">${w.word}</strong>
                            <div style="font-size:0.9em;">${w.meaning}</div>
                        </div>
                    </div>
                `).join('') || "Danh sách trống.";
            } catch (e) { list.innerHTML = "Lỗi tải dữ liệu từ server."; }
        }
    };

    // Tự động chạy init khi module được load
    Module.init();

    return Module;
})();

// FIX LỖI: Cung cấp Export Default cho ES6 Import
export default JapaneseLookup;