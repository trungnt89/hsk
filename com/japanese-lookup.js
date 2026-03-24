/**
 * Japanese Lookup & Highlight Manager - Version 2026.8
 * - Feature: Click highlighted word to show lookup
 * - Fix: Mutation Lock for stable highlighting
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
        .ja-stored-highlight { 
            color: #2563eb !important; border-bottom: 1px dashed #2563eb; 
            cursor: pointer; background: none !important; text-decoration: none;
        }
        .ja-stored-highlight:hover { color: #dc2626 !important; border-bottom-color: #dc2626; }
        .ja-history-btn { 
            position: fixed; bottom: 80px; right: 20px; width: 45px; height: 45px; 
            background: #2563eb; color: white; border-radius: 50%; border: none; 
            cursor: pointer; z-index: 1000002; font-size: 20px; 
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }
        .ja-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000003; align-items: center; justify-content: center; }
        .ja-modal-content { background: white; width: 90%; max-width: 400px; height: 70vh; border-radius: 15px; display: flex; flex-direction: column; overflow: hidden; }
        .ja-word-item { padding: 10px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .ja-del-btn { color: #ef4444; background: none; border: none; cursor: pointer; font-size: 14px; }
    `;
    document.head.appendChild(style);

    let popup = null, isHighlighting = false;
    let savedWordsSet = new Set();

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
            btn.onclick = (e) => { e.preventDefault(); Module.openManager(); };
            document.body.appendChild(btn);
        }
    };

    async function deleteWord(word, element = null) {
        if (!confirm(`Xóa từ "${word}"?`)) return;
        if (element) element.style.display = 'none';
        if (popup) popup.style.display = 'none';
        
        savedWordsSet.delete(word);
        isHighlighting = true; 
        Module.removeHighlight(word);
        setTimeout(() => { isHighlighting = false; }, 500);

        try {
            await fetch(CONFIG.gas_url, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "deleteWord", word: word })
            });
        } catch (e) { if (element) element.style.display = 'flex'; }
    }

    async function lookup(text, x, y) {
        if (!text) return;
        createUI();
        popup.style.display = 'block';
        popup.style.visibility = 'hidden';

        try {
            const [resM, resG] = await Promise.all([
                fetch(CONFIG.mymemory_api + encodeURIComponent(text)),
                fetch(CONFIG.google_api + encodeURIComponent(text))
            ]);
            const dataM = await resM.json();
            const dataG = await resG.json();
            const meaning = dataM.responseData.translatedText;
            const romaji = (dataG[0].find(i => i[3]))?.[3] || "";

            let posX = Math.max(5, Math.min(x, window.innerWidth - 190));
            let posY = (y + 130 > window.innerHeight) ? (y - 120) : (y + 10);
            popup.style.left = `${posX}px`; popup.style.top = `${posY}px`;
            popup.style.visibility = 'visible';

            popup.innerHTML = `
                <span class="ja-btn-close-tp" onclick="this.parentElement.style.display='none'">✕</span>
                <b class="ja-lookup-word">${text}</b>
                <i style="color:#64748b; font-size:0.8em;">${romaji}</i>
                <div style="margin-top:4px;">${meaning}</div>
                <div style="text-align:right; margin-top:5px;"><button class="ja-del-btn" id="btn-del-now">🗑 Xóa</button></div>
            `;
            document.getElementById('btn-del-now').onclick = () => deleteWord(text);

            if (!savedWordsSet.has(text)) {
                savedWordsSet.add(text);
                Module.applyHighlight();
                fetch(CONFIG.gas_url, { 
                    method: "POST", mode: "no-cors", 
                    body: JSON.stringify({ action: "saveWord", word: text, romaji: romaji, meaning: meaning }) 
                });
            }
        } catch (e) { popup.innerHTML = "Lỗi!"; }
    }

    const Module = {
        init: async () => {
            createUI();
            try {
                const res = await fetch(CONFIG.gas_url + "?type=words");
                const data = await res.json();
                savedWordsSet = new Set(data.map(w => w.word));
                Module.applyHighlight();
            } catch (e) { console.log("Empty data"); }

            // Quan sát thay đổi DOM
            const observer = new MutationObserver(() => {
                if (!isHighlighting) Module.applyHighlight();
            });
            observer.observe(document.body, { childList: true, subtree: true });

            // Sự kiện MouseUp để tra từ mới (bôi đen)
            document.addEventListener('mouseup', (e) => {
                // Nếu click vào từ đã highlight thì bỏ qua MouseUp để tránh xung đột
                if (e.target.classList.contains('ja-stored-highlight')) return;

                const sel = window.getSelection();
                const text = sel.toString().trim();
                if (text && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
                    const rect = sel.getRangeAt(0).getBoundingClientRect();
                    lookup(text, rect.left, rect.bottom);
                }
            });

            // Sự kiện Click vào từ đã Highlight
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('ja-stored-highlight')) {
                    const rect = e.target.getBoundingClientRect();
                    lookup(e.target.textContent, rect.left, rect.bottom);
                }
                if (popup && !popup.contains(e.target) && !e.target.classList.contains('ja-del-btn') && !e.target.classList.contains('ja-stored-highlight')) {
                    popup.style.display = 'none';
                }
            });
        },

        applyHighlight: () => {
            if (savedWordsSet.size === 0 || isHighlighting) return;
            isHighlighting = true;
            
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            const words = Array.from(savedWordsSet).sort((a, b) => b.length - a.length);
            const regex = new RegExp(`(${words.join('|')})`, 'g');

            while (node = walker.nextNode()) {
                if (node.parentElement.closest('.ja-stored-highlight, .ja-lookup-popup, .ja-modal, .ja-history-btn, SCRIPT, STYLE, TEXTAREA, INPUT, BUTTON')) continue;
                
                if (regex.test(node.nodeValue)) {
                    const span = document.createElement('span');
                    span.innerHTML = node.nodeValue.replace(regex, '<span class="ja-stored-highlight">$1</span>');
                    node.parentNode.replaceChild(span, node);
                }
            }
            setTimeout(() => { isHighlighting = false; }, 100);
        },

        removeHighlight: (word) => {
            const highlights = document.querySelectorAll('.ja-stored-highlight');
            highlights.forEach(el => {
                if (el.textContent === word) {
                    const parent = el.parentNode;
                    parent.replaceChild(document.createTextNode(el.textContent), el);
                    parent.normalize(); 
                }
            });
        },

        openManager: async () => {
            let m = document.querySelector('.ja-modal');
            if (!m) {
                m = document.createElement('div'); m.className = 'ja-modal';
                m.innerHTML = `<div class="ja-modal-content"><div style="padding:12px; border-bottom:1px solid #eee; display:flex; justify-content:space-between"><h3>Từ vựng</h3><button onclick="this.closest('.ja-modal').style.display='none'">✕</button></div><div id="ja-word-list" style="overflow-y:auto"></div></div>`;
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
                        <div style="flex:1"><b>${w.word}</b><br><small>${w.meaning}</small></div>
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