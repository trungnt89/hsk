/**
 * Japanese Lookup & Vocabulary Manager - Version 2026.4
 * - Optimized UI: Compact Tooltip
 * - Features: Delete from Tooltip & Manager
 * - Module: ES6 Export Default
 */

const JapaneseLookup = (() => {
    const CONFIG = {
        engine: 'mymemory',
        gas_url: "https://script.google.com/macros/s/AKfycbxRsR4M3R0rjz3i0u2kz6Pg-ME3IeDYs8-7GE0MrjRaakfxQBory3JMtjjgVw3lTbqI/exec",
        google_api: "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&dt=rm&q=",
        mymemory_api: "https://api.mymemory.translated.net/get?langpair=ja|vi&q="
    };

    const style = document.createElement('style');
    style.textContent = `
        .ja-lookup-popup {
            position: fixed; z-index: 1000000; background: #fff; border: 1px solid #2563eb;
            border-radius: 8px; padding: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: system-ui, -apple-system, sans-serif; width: 180px; 
            display: none; pointer-events: auto; font-size: 13px;
        }
        .ja-btn-close-tp { position: absolute; top: 2px; right: 6px; cursor: pointer; color: #94a3b8; font-weight: bold; }
        .ja-btn-close-tp:hover { color: #ef4444; }
        .ja-lookup-word { color: #1e40af; font-size: 1.1em; font-weight: bold; display: block; padding-right: 15px; }
        .ja-lookup-romaji { color: #64748b; font-size: 0.85em; font-style: italic; display: block; }
        .ja-lookup-meaning { color: #0f172a; border-top: 1px solid #eee; margin-top: 4px; padding-top: 4px; line-height: 1.3; }
        
        .ja-history-btn {
            position: fixed; bottom: 80px; right: 20px; width: 45px; height: 45px;
            background: #2563eb; color: white; border-radius: 50%; border: none;
            cursor: pointer; z-index: 9999; font-size: 20px; display: flex; align-items: center; justify-content: center;
        }
        .ja-modal {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 1000001; align-items: center; justify-content: center;
        }
        .ja-modal-content {
            background: white; width: 90%; max-width: 400px; height: 70vh;
            border-radius: 15px; display: flex; flex-direction: column; overflow: hidden;
        }
        .ja-modal-header { padding: 12px 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        #ja-word-list { flex: 1; overflow-y: auto; padding: 10px; }
        .ja-word-item { 
            padding: 8px; border-bottom: 1px solid #f8fafc; 
            display: flex; justify-content: space-between; align-items: center; 
        }
        .ja-del-btn { color: #ef4444; background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px; }
        .ja-del-btn:hover { background: #fee2e2; border-radius: 4px; }
    `;
    document.head.appendChild(style);

    let popup = null;

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
            btn.onclick = () => Module.openManager();
            document.body.appendChild(btn);
        }
    };

    async function deleteWord(word, element = null) {
        if (!confirm(`Xóa từ "${word}"?`)) return;
        try {
            await fetch(CONFIG.gas_url, {
                method: "POST",
                mode: "no-cors",
                body: JSON.stringify({ action: "deleteWord", word: word })
            });
            if (element) element.remove();
            if (popup) popup.style.display = 'none';
            console.log(`[Log] Đã xóa: ${word}`);
        } catch (e) { alert("Lỗi khi xóa!"); }
    }

    async function lookup(text, x, y) {
        if (!text) return;
        createUI();
        popup.style.display = 'block';
        popup.style.visibility = 'hidden';
        popup.innerHTML = `<div style="font-size:11px">...</div>`;

        setTimeout(async () => {
            let posX = Math.max(5, Math.min(x, window.innerWidth - 190));
            let posY = (y + 120 > window.innerHeight) ? (y - 110) : (y + 10);
            popup.style.left = `${posX}px`;
            popup.style.top = `${posY}px`;
            popup.style.visibility = 'visible';

            try {
                const [resM, resG] = await Promise.all([
                    fetch(CONFIG.mymemory_api + encodeURIComponent(text)),
                    fetch(CONFIG.google_api + encodeURIComponent(text))
                ]);
                const dataM = await resM.json();
                const dataG = await resG.json();
                const meaning = dataM.responseData.translatedText;
                const romaji = (dataG[0].find(i => i[3]))?.[3] || "";

                popup.innerHTML = `
                    <span class="ja-btn-close-tp" onclick="this.parentElement.style.display='none'">✕</span>
                    <b class="ja-lookup-word">${text}</b>
                    <i class="ja-lookup-romaji">${romaji}</i>
                    <div class="ja-lookup-meaning">${meaning}</div>
                    <div style="text-align:right; margin-top:5px;">
                        <button class="ja-del-btn" style="font-size:11px;" id="btn-del-now">🗑 Xóa</button>
                    </div>
                `;
                
                document.getElementById('btn-del-now').onclick = () => deleteWord(text);

                fetch(CONFIG.gas_url, { 
                    method: "POST", mode: "no-cors", 
                    body: JSON.stringify({ action: "saveWord", word: text, romaji: romaji, meaning: meaning }) 
                });
            } catch (e) { popup.innerHTML = "Lỗi!"; }
        }, 20);
    }

    const Module = {
        init: () => {
            createUI();
            const handle = () => {
                const sel = window.getSelection();
                const text = sel.toString().trim();
                if (text && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
                    const rect = sel.getRangeAt(0).getBoundingClientRect();
                    lookup(text, rect.left, rect.bottom);
                }
            };
            document.addEventListener('mouseup', handle);
            document.addEventListener('touchend', handle);
            document.addEventListener('mousedown', (e) => {
                if (popup && !popup.contains(e.target) && e.target.className !== 'ja-del-btn') 
                    popup.style.display = 'none';
            });
        },
        openManager: async () => {
            let m = document.querySelector('.ja-modal');
            if (!m) {
                m = document.createElement('div');
                m.className = 'ja-modal';
                m.innerHTML = `<div class="ja-modal-content"><div class="ja-modal-header"><h3>Lịch sử</h3><button onclick="this.closest('.ja-modal').style.display='none'">✕</button></div><div id="ja-word-list"></div></div>`;
                document.body.appendChild(m);
            }
            m.style.display = 'flex';
            const list = document.getElementById('ja-word-list');
            list.innerHTML = "Đang tải...";
            try {
                const res = await fetch(CONFIG.gas_url + "?type=words&_t=" + Date.now());
                const words = await res.json();
                list.innerHTML = words.reverse().map(w => `
                    <div class="ja-word-item">
                        <div style="flex:1">
                            <strong>${w.word}</strong> <small style="color:#668">(${w.romaji||''})</small>
                            <div style="font-size:12px;">${w.meaning}</div>
                        </div>
                        <button class="ja-del-btn" onclick="JapaneseLookup.deleteFromList('${w.word}', this.parentElement)">🗑</button>
                    </div>
                `).join('');
            } catch (e) { list.innerHTML = "Lỗi!"; }
        },
        deleteFromList: (word, el) => deleteWord(word, el)
    };

    Module.init();
    window.JapaneseLookup = Module; // Gán vào window để các nút onclick hoạt động
    return Module;
})();

export default JapaneseLookup;