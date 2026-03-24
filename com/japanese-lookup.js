/**
 * Japanese Lookup & Highlight Manager - Version 2026.5
 * - Auto-highlight: Scan body & Ajax content
 * - Optimistic Delete: Hide immediately, then sync
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
            font-family: system-ui, sans-serif; width: 180px; display: none; font-size: 13px;
        }
        .ja-btn-close-tp { position: absolute; top: 2px; right: 6px; cursor: pointer; color: #94a3b8; }
        .ja-lookup-word { color: #1e40af; font-size: 1.1em; font-weight: bold; display: block; }
        .ja-lookup-meaning { color: #0f172a; border-top: 1px solid #eee; margin-top: 4px; padding-top: 4px; }
        .ja-stored-highlight { background-color: #fef08a !important; color: #b45309 !important; border-bottom: 1px dashed #b45309; cursor: help; border-radius: 2px; }
        .ja-history-btn { position: fixed; bottom: 80px; right: 20px; width: 45px; height: 45px; background: #2563eb; color: white; border-radius: 50%; border: none; cursor: pointer; z-index: 9999; font-size: 20px; display: flex; align-items: center; justify-content: center; }
        .ja-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000001; align-items: center; justify-content: center; }
        .ja-modal-content { background: white; width: 90%; max-width: 400px; height: 70vh; border-radius: 15px; display: flex; flex-direction: column; overflow: hidden; }
        #ja-word-list { flex: 1; overflow-y: auto; padding: 10px; }
        .ja-word-item { padding: 8px; border-bottom: 1px solid #f8fafc; display: flex; justify-content: space-between; align-items: center; }
        .ja-del-btn { color: #ef4444; background: none; border: none; cursor: pointer; font-size: 14px; }
    `;
    document.head.appendChild(style);

    let popup = null;
    let savedWordsSet = new Set();

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

    // Xóa từ: Ẩn UI ngay lập tức (Optimistic Update)
    async function deleteWord(word, element = null) {
        if (!confirm(`Xóa từ "${word}"?`)) return;
        
        if (element) element.style.display = 'none';
        if (popup) popup.style.display = 'none';
        savedWordsSet.delete(word);
        
        try {
            await fetch(CONFIG.gas_url, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "deleteWord", word: word })
            });
            Module.applyHighlight(); // Cập nhật lại highlight trên trang
        } catch (e) {
            if (element) element.style.display = 'flex';
            alert("Lỗi kết nối!");
        }
    }

    async function lookup(text, x, y) {
        if (!text) return;
        createUI();
        popup.style.display = 'block';
        popup.style.visibility = 'hidden';
        
        setTimeout(async () => {
            let posX = Math.max(5, Math.min(x, window.innerWidth - 190));
            let posY = (y + 120 > window.innerHeight) ? (y - 110) : (y + 10);
            popup.style.left = `${posX}px`; popup.style.top = `${posY}px`;
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
                    <i style="color:#64748b; font-size:0.8em;">${romaji}</i>
                    <div class="ja-lookup-meaning">${meaning}</div>
                    <div style="text-align:right; margin-top:5px;"><button class="ja-del-btn" id="btn-del-now">🗑 Xóa</button></div>
                `;
                document.getElementById('btn-del-now').onclick = () => deleteWord(text);

                // Lưu và cập nhật highlight
                if (!savedWordsSet.has(text)) {
                    savedWordsSet.add(text);
                    Module.applyHighlight();
                    fetch(CONFIG.gas_url, { 
                        method: "POST", mode: "no-cors", 
                        body: JSON.stringify({ action: "saveWord", word: text, romaji: romaji, meaning: meaning }) 
                    });
                }
            } catch (e) { popup.innerHTML = "Lỗi!"; }
        }, 20);
    }

    const Module = {
        init: async () => {
            createUI();
            // Tải danh sách từ đã lưu để highlight
            try {
                const res = await fetch(CONFIG.gas_url + "?type=words");
                const data = await res.json();
                savedWordsSet = new Set(data.map(w => w.word));
                Module.applyHighlight();
            } catch (e) { console.log("Chưa có data highlight"); }

            // Quan sát Ajax/DOM thay đổi
            const observer = new MutationObserver(() => Module.applyHighlight());
            observer.observe(document.body, { childList: true, subtree: true });

            document.addEventListener('mouseup', () => {
                const sel = window.getSelection();
                const text = sel.toString().trim();
                if (text && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
                    const rect = sel.getRangeAt(0).getBoundingClientRect();
                    lookup(text, rect.left, rect.bottom);
                }
            });
            document.addEventListener('mousedown', (e) => {
                if (popup && !popup.contains(e.target) && !e.target.classList.contains('ja-del-btn')) 
                    popup.style.display = 'none';
            });
        },

        applyHighlight: () => {
            if (savedWordsSet.size === 0) return;
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            const words = Array.from(savedWordsSet).sort((a, b) => b.length - a.length);
            const regex = new RegExp(`(${words.join('|')})`, 'g');

            while (node = walker.nextNode()) {
                if (node.parentElement.classList.contains('ja-stored-highlight') || 
                    ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(node.parentElement.tagName)) continue;
                
                if (regex.test(node.nodeValue)) {
                    const span = document.createElement('span');
                    span.innerHTML = node.nodeValue.replace(regex, '<span class="ja-stored-highlight">$1</span>');
                    node.parentNode.replaceChild(span, node);
                }
            }
        },

        openManager: async () => {
            let m = document.querySelector('.ja-modal');
            if (!m) {
                m = document.createElement('div'); m.className = 'ja-modal';
                m.innerHTML = `<div class="ja-modal-content"><div style="padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between"><h3>Lịch sử</h3><button onclick="this.closest('.ja-modal').style.display='none'">✕</button></div><div id="ja-word-list"></div></div>`;
                document.body.appendChild(m);
            }
            m.style.display = 'flex';
            const list = document.getElementById('ja-word-list');
            list.innerHTML = "Đang tải...";
            try {
                const res = await fetch(CONFIG.gas_url + "?type=words&_t=" + Date.now());
                const data = await res.json();
                list.innerHTML = data.reverse().map(w => `
                    <div class="ja-word-item">
                        <div><b>${w.word}</b><br><small>${w.meaning}</small></div>
                        <button class="ja-del-btn" onclick="JapaneseLookup.deleteFromList('${w.word}', this.parentElement)">🗑</button>
                    </div>
                `).join('');
            } catch (e) { list.innerHTML = "Lỗi!"; }
        },
        deleteFromList: (word, el) => deleteWord(word, el)
    };

    window.JapaneseLookup = Module;
    Module.init();
    return Module;
})();

export default JapaneseLookup;