/**
 * Japanese Lookup & Highlight Manager - Version 2026.12
 * - Feature: Triple-scan (0s, 5s, 10s) to ensure highlighting on slow sites
 * - Logic: Click = Local Data, Selection = API Data
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
            position: fixed; z-index: 2147483647; background: #fff; border: 1px solid #2563eb;
            border-radius: 8px; padding: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.25);
            font-family: system-ui, -apple-system, sans-serif; width: 200px; display: none; font-size: 13px;
        }
        .ja-btn-close-tp { position: absolute; top: 2px; right: 6px; cursor: pointer; color: #94a3b8; font-weight:bold; }
        .ja-lookup-word { color: #1e40af; font-size: 1.15em; font-weight: bold; display: block; border-bottom: 1px solid #f1f5f9; margin-bottom: 4px; padding-bottom: 2px;}
        .ja-stored-highlight { 
            color: #2563eb !important; border-bottom: 1px dashed #2563eb !important; 
            cursor: pointer !important; background: none !important; display: inline !important;
            transition: color 0.2s;
        }
        .ja-stored-highlight:hover { color: #dc2626 !important; }
        .ja-history-btn { 
            position: fixed; bottom: 80px; right: 20px; width: 45px; height: 45px; 
            background: #2563eb; color: white; border-radius: 50%; border: none; 
            z-index: 1000002; font-size: 20px; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3); cursor: pointer;
        }
        .ja-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000003; align-items: center; justify-content: center; }
        .ja-modal-content { background: white; width: 90%; max-width: 400px; height: 70vh; border-radius: 15px; display: flex; flex-direction: column; overflow: hidden; }
        .ja-word-item { padding: 12px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .ja-del-btn { color: #ef4444; background: none; border: none; cursor: pointer; font-size: 12px; padding: 4px; }
    `;
    document.head.appendChild(style);

    let popup = null, isHighlighting = false, dataLoaded = false;
    let savedWordsMap = new Map();

    const createUI = () => {
        if (!document.querySelector('.ja-lookup-popup')) {
            popup = document.createElement('div');
            popup.className = 'ja-lookup-popup';
            document.body.appendChild(popup);
        }
        if (!document.querySelector('.ja-history-btn')) {
            const btn = document.createElement('button');
            btn.className = 'ja-history-btn'; btn.innerHTML = '📚';
            btn.onclick = () => Module.openManager();
            document.body.appendChild(btn);
        }
    };

    function showPopup(word, meaning, romaji, x, y, isStored = false) {
        createUI();
        popup.style.display = 'block';
        let posX = Math.max(5, Math.min(x, window.innerWidth - 210));
        let posY = (y + 140 > window.innerHeight) ? (y - 130) : (y + 10);
        popup.style.left = `${posX}px`; popup.style.top = `${posY}px`;
        popup.style.visibility = 'visible';

        popup.innerHTML = `
            <span class="ja-btn-close-tp" onclick="this.parentElement.style.display='none'">✕</span>
            <b class="ja-lookup-word">${word}</b>
            <i style="color:#64748b; font-size:0.85em; display:block; margin-bottom:6px;">${romaji || ''}</i>
            <div style="line-height:1.4">${meaning}</div>
            <div style="text-align:right; margin-top:10px; border-top:1px solid #f8fafc; pt:4px;">
                ${isStored ? '<span style="font-size:10px; color:#10b981; float:left; margin-top:6px;">● Đã lưu</span>' : ''}
                <button class="ja-del-btn" id="btn-del-now">🗑 Xóa</button>
            </div>
        `;
        document.getElementById('btn-del-now').onclick = () => deleteWord(word);
    }

    async function deleteWord(word, element = null) {
        if (!confirm(`Xóa từ "${word}"?`)) return;
        if (element) element.style.display = 'none';
        if (popup) popup.style.display = 'none';
        savedWordsMap.delete(word);
        isHighlighting = true; 
        Module.removeHighlight(word);
        setTimeout(() => { isHighlighting = false; }, 400);
        try {
            await fetch(CONFIG.gas_url, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "deleteWord", word: word }) });
        } catch (e) { if (element) element.style.display = 'flex'; }
    }

    async function lookupNew(text, x, y) {
        if (!text) return;
        createUI();
        popup.style.display = 'block';
        popup.style.visibility = 'hidden';
        popup.innerHTML = '<div style="padding:10px; color:#666;">⏳ Đang dịch...</div>';

        try {
            const [resM, resG] = await Promise.all([
                fetch(CONFIG.mymemory_api + encodeURIComponent(text)),
                fetch(CONFIG.google_api + encodeURIComponent(text))
            ]);
            const dataM = await resM.json();
            const dataG = await resG.json();
            const meaning = dataM.responseData.translatedText;
            const romaji = (dataG[0].find(i => i[3]))?.[3] || "";

            showPopup(text, meaning, romaji, x, y, false);

            if (!savedWordsMap.has(text)) {
                savedWordsMap.set(text, { meaning, romaji });
                Module.applyHighlight();
                fetch(CONFIG.gas_url, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "saveWord", word: text, romaji, meaning }) });
            }
        } catch (e) { popup.innerHTML = "Lỗi dịch thuật!"; }
    }

    const Module = {
        init: async () => {
            createUI();
            // 1. Tải dữ liệu ban đầu
            try {
                const res = await fetch(CONFIG.gas_url + "?type=words&v=" + Date.now());
                const data = await res.json();
                data.forEach(w => savedWordsMap.set(w.word, { meaning: w.meaning, romaji: w.romaji }));
                dataLoaded = true;
                
                // --- CHIẾN THUẬT QUÉT ĐA TẦNG ---
                Module.applyHighlight(); // Lần 1: Ngay lập tức
                setTimeout(() => Module.applyHighlight(), 5000); // Lần 2: Sau 5s (đợi Ajax cơ bản)
                setTimeout(() => Module.applyHighlight(), 10000); // Lần 3: Sau 10s (chốt hạ)
                
            } catch (e) { dataLoaded = true; }

            // 2. Theo dõi Ajax liên tục
            const observer = new MutationObserver(() => { if (!isHighlighting && dataLoaded) Module.applyHighlight(); });
            observer.observe(document.body, { childList: true, subtree: true });

            // 3. Sự kiện MouseUp (Dùng chung cho cả Click & Bôi đen)
            document.addEventListener('mouseup', (e) => {
                const sel = window.getSelection();
                const text = sel.toString().trim();

                // Nếu có bôi đen văn bản tiếng Nhật -> Gọi API dịch mới
                if (text && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
                    const rect = sel.getRangeAt(0).getBoundingClientRect();
                    lookupNew(text, rect.left, rect.bottom);
                    return;
                }

                // Nếu chỉ click vào từ đã highlight -> Lấy data local
                const target = e.target.closest('.ja-stored-highlight');
                if (target && !text) {
                    const word = target.textContent;
                    const data = savedWordsMap.get(word);
                    if (data) {
                        const rect = target.getBoundingClientRect();
                        showPopup(word, data.meaning, data.romaji, rect.left, rect.bottom, true);
                    }
                }

                // Đóng popup nếu click ra ngoài
                if (popup && !popup.contains(e.target) && !e.target.closest('.ja-stored-highlight')) {
                    popup.style.display = 'none';
                }
            });
        },

        applyHighlight: () => {
            if (savedWordsMap.size === 0 || isHighlighting) return;
            isHighlighting = true;
            
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            const words = Array.from(savedWordsMap.keys()).sort((a, b) => b.length - a.length);
            if (words.length === 0) { isHighlighting = false; return; }

            const regex = new RegExp(`(${words.join('|')})`, 'g');

            while (node = walker.nextNode()) {
                // Không highlight trong các vùng nhạy cảm
                if (node.parentElement.closest('.ja-stored-highlight, .ja-lookup-popup, .ja-modal, .ja-history-btn, SCRIPT, STYLE, TEXTAREA, INPUT, BUTTON, [contenteditable="true"]')) continue;
                
                if (regex.test(node.nodeValue)) {
                    const span = document.createElement('span');
                    span.innerHTML = node.nodeValue.replace(regex, '<span class="ja-stored-highlight">$1</span>');
                    node.parentNode.replaceChild(span, node);
                }
            }
            setTimeout(() => { isHighlighting = false; }, 300);
        },

        removeHighlight: (word) => {
            document.querySelectorAll('.ja-stored-highlight').forEach(el => {
                if (el.textContent === word) {
                    const p = el.parentNode;
                    p.replaceChild(document.createTextNode(el.textContent), el);
                    p.normalize();
                }
            });
        },

        openManager: () => {
            let m = document.querySelector('.ja-modal');
            if (!m) {
                m = document.createElement('div'); m.className = 'ja-modal';
                m.innerHTML = `<div class="ja-modal-content"><div style="padding:12px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;"><h3>Từ điển cá nhân (${savedWordsMap.size})</h3><button onclick="this.closest('.ja-modal').style.display='none'">✕</button></div><div id="ja-word-list" style="overflow-y:auto; flex:1;"></div></div>`;
                document.body.appendChild(m);
            }
            m.style.display = 'flex';
            const list = document.getElementById('ja-word-list');
            list.innerHTML = Array.from(savedWordsMap.entries()).reverse().map(([word, data]) => `
                <div class="ja-word-item">
                    <div style="flex:1"><b>${word}</b><br><small style="color:#666">${data.meaning}</small></div>
                    <button class="ja-del-btn" onclick="JapaneseLookup.deleteFromList('${word}', this.parentElement)">🗑 Xóa</button>
                </div>
            `).join('') || '<div style="padding:20px; text-align:center;">Chưa có từ nào được lưu.</div>';
        },
        deleteFromList: (word, el) => deleteWord(word, el)
    };

    window.JapaneseLookup = Module;
    if (document.readyState === 'complete') Module.init();
    else window.addEventListener('load', () => Module.init());
    
    return Module;
})();

export default JapaneseLookup;