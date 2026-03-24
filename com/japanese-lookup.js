/**
 * Japanese Lookup & Highlight Manager - Version 2026.23
 * - Feature: Split Meanings (Top: MyMemory, Bottom: Google API)
 * - Feature: Auto-highlight check at 5s and 10s after load
 * - Feature: Full Logs for Debugging
 * - Constraint: Immutable Logic for Storage & Highlighting
 */

const JapaneseLookup = (() => {
    const CONFIG = {
        engine: 'dual',
        gas_url: "https://script.google.com/macros/s/AKfycbxRsR4M3R0rjz3i0u2kz6Pg-ME3IeDYs8-7GE0MrjRaakfxQBory3JMtjjgVw3lTbqI/exec",
        google_api: "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&dt=rm&q=",
        mymemory_api: "https://api.mymemory.translated.net/get?langpair=ja|vi&q="
    };

    const style = document.createElement('style');
    style.textContent = `
        .ja-lookup-popup {
            position: fixed; z-index: 2147483647; background: #fff; 
            border-top: 3px solid #2563eb;
            bottom: 0; left: 0; width: 100%; 
            padding: 15px 15px 25px 15px; 
            box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
            font-family: -apple-system, system-ui, sans-serif; 
            display: none; font-size: 15px;
            box-sizing: border-box;
            transition: transform 0.2s ease-out;
        }
        .ja-btn-close-tp { position: absolute; top: 8px; right: 15px; cursor: pointer; color: #94a3b8; font-size: 22px; font-weight: bold; }
        .ja-lookup-word { color: #1e40af; font-size: 1.25em; font-weight: bold; display: inline-block; margin-bottom: 5px; border-bottom: 1px solid #eee; }
        .ja-stored-highlight { 
            color: #2563eb !important; border-bottom: 1.5px dashed #2563eb !important; 
            background: none !important; display: inline !important;
            -webkit-tap-highlight-color: transparent;
        }
        .ja-history-btn { 
            position: fixed; bottom: 120px; right: 20px; width: 50px; height: 50px; 
            background: #2563eb; color: white; border-radius: 50%; border: none; 
            z-index: 1000002; font-size: 24px; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4); cursor: pointer;
        }
        .ja-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1000003; align-items: center; justify-content: center; }
        .ja-modal-content { background: white; width: 95%; max-width: 400px; height: 80vh; border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; }
        .ja-word-item { padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .ja-del-btn { color: #ef4444; background: #fee2e2; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer; }
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
            btn.onclick = (e) => { e.preventDefault(); Module.openManager(); };
            document.body.appendChild(btn);
        }
    };

    function showPopup(word, meaning, romaji, x, y, isStored = false, googleMeaning = "") {
        createUI();
        popup.style.display = 'block';
        popup.style.top = 'auto';
        popup.style.left = '0';
        popup.style.visibility = 'visible';

        const displayGoogle = googleMeaning || meaning;

        popup.innerHTML = `
            <span class="ja-btn-close-tp" onclick="this.parentElement.style.display='none'">✕</span>
            <div style="margin-bottom:8px;">
                <b class="ja-lookup-word">${word}</b>
                <span style="color:#64748b; font-size:0.95em; margin-left:10px;">${romaji || ''}</span>
            </div>
            <div style="max-height:80px; overflow-y:auto; margin-bottom:12px; line-height:1.5; color:#1e293b; font-size:14px;">
                <div style="font-size:11px; color:#94a3b8; font-weight:bold; text-transform:uppercase; margin-bottom:2px;">MyMemory</div>
                ${meaning}
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:8px; margin-bottom:12px;">
                <div style="font-size:11px; color:#2563eb; font-weight:bold; text-transform:uppercase; margin-bottom:4px;">Google Translate</div>
                <div style="color:#1e40af; font-weight:500;">${displayGoogle}</div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px; color:${isStored ? '#10b981' : '#94a3b8'}; font-weight:500;">
                    ${isStored ? '● TRONG BỘ NHỚ' : '○ TRA MỚI'}
                </span>
                <button class="ja-del-btn" id="btn-del-now">🗑 Xóa từ</button>
            </div>
        `;
        document.getElementById('btn-del-now').onclick = () => Module.deleteFromList(word);
    }

    async function lookupNew(text, x, y) {
        if (!text) return;
        createUI();
        showPopup(text, '<span style="color:#94a3b8; font-style:italic;">Đang dịch...</span>', '', x, y, false);

        try {
            console.log(`[Request] Fetching translations for: ${text}`);
            const [resM, resG] = await Promise.all([
                fetch(CONFIG.mymemory_api + encodeURIComponent(text)),
                fetch(CONFIG.google_api + encodeURIComponent(text))
            ]);
            const dataM = await resM.json();
            const dataG = await resG.json();
            
            const meaning = dataM.responseData.translatedText;
            const googleMeaning = dataG[0][0][0];
            const romaji = (dataG[0].find(i => i[3]))?.[3] || "";
            
            console.log(`[Success] MyMemory: ${meaning} | Google: ${googleMeaning}`);
            
            showPopup(text, meaning, romaji, x, y, false, googleMeaning);

            if (!savedWordsMap.has(text)) {
                savedWordsMap.set(text, { meaning, romaji, googleMeaning });
                Module.applyHighlight();
                fetch(CONFIG.gas_url, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "saveWord", word: text, romaji, meaning, googleMeaning }) });
            }
        } catch (e) { 
            console.error("[Error] Lookup failed", e);
            showPopup(text, '<span style="color:#ef4444;">Lỗi kết nối dịch thuật.</span>', '', x, y, false);
        }
    }

    const handleAction = (e) => {
        const sel = window.getSelection();
        const text = sel.toString().trim();
        if (text && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            lookupNew(text, rect.left, rect.bottom);
            return;
        }
        const target = e.target.closest('.ja-stored-highlight');
        if (target && !text) {
            const word = target.textContent;
            const data = savedWordsMap.get(word);
            if (data) {
                const rect = target.getBoundingClientRect();
                showPopup(word, data.meaning, data.romaji, rect.left, rect.bottom, true, data.googleMeaning);
            }
        }
        if (popup && !popup.contains(e.target) && !e.target.closest('.ja-stored-highlight')) {
            popup.style.display = 'none';
        }
    };

    const Module = {
        init: async () => {
            console.log("[System] Initializing JapaneseLookup v2026.23");
            createUI();
            try {
                const res = await fetch(CONFIG.gas_url + "?type=words&v=" + Date.now());
                const data = await res.json();
                data.forEach(w => savedWordsMap.set(w.word, { meaning: w.meaning, romaji: w.romaji, googleMeaning: w.googleMeaning || "" }));
                dataLoaded = true;
                
                // Initial highlight
                Module.applyHighlight();
                
                // Supplementary highlights at 5s and 10s
                console.log("[System] Scheduling supplementary highlights at 5s and 10s...");
                setTimeout(() => {
                    console.log("[System] 5s check: Triggering highlight...");
                    Module.applyHighlight();
                }, 5000);
                setTimeout(() => {
                    console.log("[System] 10s check: Triggering highlight...");
                    Module.applyHighlight();
                }, 10000);

            } catch (e) { 
                console.warn("[System] Initial load failed, offline mode active.");
                dataLoaded = true; 
            }

            const observer = new MutationObserver(() => { if (!isHighlighting && dataLoaded) Module.applyHighlight(); });
            observer.observe(document.body, { childList: true, subtree: true });
            document.addEventListener('touchend', (e) => handleAction(e));
            document.addEventListener('mouseup', (e) => handleAction(e));
        },

        applyHighlight: () => {
            if (savedWordsMap.size === 0 || isHighlighting) return;
            console.log(`[System] Running highlight for ${savedWordsMap.size} words.`);
            isHighlighting = true;
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            const words = Array.from(savedWordsMap.keys()).sort((a, b) => b.length - a.length);
            const regex = new RegExp(`(${words.join('|')})`, 'g');
            while (node = walker.nextNode()) {
                if (node.parentElement.closest('.ja-stored-highlight, .ja-lookup-popup, .ja-modal, .ja-history-btn, SCRIPT, STYLE, TEXTAREA, INPUT, BUTTON')) continue;
                if (regex.test(node.nodeValue)) {
                    const span = document.createElement('span');
                    span.innerHTML = node.nodeValue.replace(regex, '<span class="ja-stored-highlight">$1</span>');
                    node.parentNode.replaceChild(span, node);
                }
            }
            setTimeout(() => { isHighlighting = false; }, 300);
        },

        openManager: () => {
            let m = document.querySelector('.ja-modal');
            if (!m) {
                m = document.createElement('div'); m.className = 'ja-modal';
                m.innerHTML = `<div class="ja-modal-content"><div style="padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;"><h3>Sổ từ vựng (<span id="ja-total-count">0</span>)</h3><button onclick="this.closest('.ja-modal').style.display='none'" style="font-size:24px; border:none; background:none; cursor:pointer;">✕</button></div><div id="ja-word-list" style="overflow-y:auto; flex:1;"></div></div>`;
                document.body.appendChild(m);
            }
            m.style.display = 'flex';
            document.getElementById('ja-total-count').textContent = savedWordsMap.size;
            const list = document.getElementById('ja-word-list');
            list.innerHTML = Array.from(savedWordsMap.entries()).reverse().map(([word, data], index) => `
                <div class="ja-word-item">
                    <div style="margin-right:12px; color:#94a3b8; font-size:12px;">${savedWordsMap.size - index}.</div>
                    <div style="flex:1">
                        <b>${word}</b> <small style="color:#64748b; margin-left:5px;">${data.romaji || ''}</small>
                        <br><span style="color:#334155; font-size:13px;">${data.meaning}</span>
                        ${data.googleMeaning ? `<br><small style="color:#2563eb;">G: ${data.googleMeaning}</small>` : ''}
                    </div>
                    <button class="ja-del-btn" onclick="JapaneseLookup.deleteFromList('${word}', this.parentElement)">Xóa</button>
                </div>
            `).join('') || '<div style="padding:20px; text-align:center;">Trống.</div>';
        },

        deleteFromList: (word, el = null) => {
            if (!confirm(`Xóa từ "${word}" khỏi danh sách?`)) return;
            console.log(`[System] Deleting word: ${word}`);
            if (el) el.style.display = 'none';
            if (popup) popup.style.display = 'none';
            savedWordsMap.delete(word);
            const counter = document.getElementById('ja-total-count');
            if(counter) counter.textContent = savedWordsMap.size;
            isHighlighting = true;
            document.querySelectorAll('.ja-stored-highlight').forEach(s => {
                if (s.textContent === word) {
                    const p = s.parentNode;
                    p.replaceChild(document.createTextNode(s.textContent), s);
                    p.normalize();
                }
            });
            setTimeout(() => isHighlighting = false, 400);
            fetch(CONFIG.gas_url, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "deleteWord", word: word }) });
        }
    };

    window.JapaneseLookup = Module;
    if (document.readyState === 'complete') Module.init();
    else window.addEventListener('load', () => Module.init());
    return Module;
})();

export default JapaneseLookup;