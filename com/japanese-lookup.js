/**
 * Japanese Lookup & Highlight Manager - Version 2026.29
 * - Feature: Show Summary only in popup
 * - Feature: Fixed Manager List & Delete Logic
 * - Feature: Auto-highlight every 3 seconds
 */

const JapaneseLookup = (() => {
    const CONFIG = {
        vercel_api: "/api/mazii", 
        gas_url: "https://script.google.com/macros/s/AKfycbxRsR4M3R0rjz3i0u2kz6Pg-ME3IeDYs8-7GE0MrjRaakfxQBory3JMtjjgVw3lTbqI/exec"
    };

    const style = document.createElement('style');
    style.textContent = `
        .ja-lookup-popup {
            position: fixed; z-index: 2147483647; background: #fff; 
            border-top: 3px solid #2563eb; bottom: 0; left: 0; width: 100%; 
            padding: 15px 15px 25px 15px; box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
            font-family: -apple-system, system-ui, sans-serif; display: none; font-size: 15px;
            box-sizing: border-box; transition: transform 0.2s ease-out;
        }
        .ja-btn-close-tp { position: absolute; top: 8px; right: 15px; cursor: pointer; color: #94a3b8; font-size: 22px; font-weight: bold; }
        .ja-lookup-word { color: #1e40af; font-size: 1.25em; font-weight: bold; display: inline-block; margin-bottom: 5px; border-bottom: 1px solid #eee; }
        .ja-hanviet-tag { color: #dc2626; font-size: 0.85em; font-weight: bold; margin-left: 8px; background: #fef2f2; padding: 2px 6px; border-radius: 4px; }
        .ja-stored-highlight { color: #2563eb !important; border-bottom: 1.5px dashed #2563eb !important; background: none !important; display: inline !important; cursor: pointer; }
        .ja-history-btn { position: fixed; bottom: 120px; right: 20px; width: 50px; height: 50px; background: #2563eb; color: white; border-radius: 50%; z-index: 1000002; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.4); cursor: pointer; border:none; }
        .ja-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1000003; align-items: center; justify-content: center; }
        .ja-modal-content { background: white; width: 95%; max-width: 400px; height: 80vh; border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; }
        .ja-word-item { padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .ja-del-btn { color: #ef4444; background: #fee2e2; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer; }
    `;
    document.head.appendChild(style);

    let popup = null, isHighlighting = false, dataLoaded = false, kanjiDict = null;
    let savedWordsMap = new Map();

    const loadKanjiDict = async () => {
        try {
            const res = await fetch("../com/kanjimini.json");
            const data = await res.json();
            kanjiDict = data.reduce((acc, curr) => { acc[curr.w] = curr.h; return acc; }, {});
            console.log("[Log] Kanji Dictionary Loaded.");
        } catch (e) { console.warn("[Log] kanjimini.json failed."); }
    };

    const getHanViet = (text) => {
        if (!kanjiDict || !text) return "";
        return text.split('').map(char => {
            const hv = kanjiDict[char];
            return hv ? hv.split(/[;,]/)[0].trim().toUpperCase() : "";
        }).filter(v => v).join(" ");
    };

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

    function showPopup(word, shortMean, detailedMeans, phonetic, isStored = false) {
        createUI();
        const hanViet = getHanViet(word);
        popup.style.display = 'block';
        popup.style.visibility = 'visible';
        popup.innerHTML = `
            <span class="ja-btn-close-tp" onclick="this.parentElement.style.display='none'">✕</span>
            <div style="margin-bottom:8px;">
                <b class="ja-lookup-word">${word}</b>
                ${hanViet ? `<span class="ja-hanviet-tag">${hanViet}</span>` : ''}
                <span style="color:#64748b; font-size:0.95em; margin-left:10px;">${phonetic || ''}</span>
            </div>
            <div style="background:#eff6ff; border-left:4px solid #2563eb; padding:12px; margin-bottom:12px; border-radius:4px;">
                <div style="font-size:11px; color:#2563eb; font-weight:bold; margin-bottom:4px;">NGHĨA TÓM TẮT</div>
                <div style="color:#1e40af; font-weight:500; line-height:1.4;">${shortMean || detailedMeans}</div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px; color:#94a3b8;">${isStored ? '● TRONG BỘ NHỚ' : '○ TRA MỚI'}</span>
                <button class="ja-del-btn" id="btn-del-now">🗑 Xóa</button>
            </div>
        `;
        document.getElementById('btn-del-now').onclick = () => Module.deleteFromList(word);
    }

    async function lookupNew(text) {
        if (!text) return;
        const isKanji = kanjiDict && text.length === 1 && kanjiDict[text];
        showPopup(text, 'Đang truy vấn...', '...', '', false);

        try {
            const res = await fetch(CONFIG.vercel_api, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: text, type: isKanji ? "kanji" : "word" })
            });
            const data = await res.json();

            if (isKanji) {
                if (data.results && data.results.length > 0) {
                    const k = data.results[0];
                    showPopup(text, k.mean, `On: ${k.on || 'N/A'}, Kun: ${k.kun || 'N/A'}`, `[Kanji]`, false);
                }
            } else {
                if (data.data && data.data.words && data.data.words.length > 0) {
                    const item = data.data.words[0];
                    const detailed = item.means ? item.means.map(m => m.mean).join(", ") : "N/A";
                    showPopup(text, item.short_mean || detailed, detailed, item.phonetic || "", false);
                    if (!savedWordsMap.has(text)) {
                        savedWordsMap.set(text, { meaning: detailed, romaji: item.phonetic, googleMeaning: item.short_mean });
                        Module.applyHighlight();
                        fetch(CONFIG.gas_url, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "saveWord", word: text, romaji: item.phonetic, meaning: detailed, googleMeaning: item.short_mean }) });
                    }
                }
            }
        } catch (e) { showPopup(text, "Lỗi kết nối", "", "", false); }
    }

    const Module = {
        init: async () => {
            console.log("[Log] Init JapaneseLookup v2026.29");
            createUI();
            await loadKanjiDict();
            try {
                const res = await fetch(CONFIG.gas_url + "?type=words&v=" + Date.now());
                const data = await res.json();
                data.forEach(w => savedWordsMap.set(w.word, { meaning: w.meaning, romaji: w.romaji, googleMeaning: w.googleMeaning || "" }));
                dataLoaded = true;
                Module.applyHighlight();
            } catch (e) { dataLoaded = true; }

            document.addEventListener('mouseup', (e) => {
                const sel = window.getSelection().toString().trim();
                if (sel && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(sel)) {
                    lookupNew(sel);
                } else if (e.target.closest('.ja-stored-highlight')) {
                    const word = e.target.textContent;
                    const d = savedWordsMap.get(word);
                    if (d) showPopup(word, d.googleMeaning, d.meaning, d.romaji, true);
                }
            });

            // Tự động tô màu mỗi 3s
            setInterval(() => { if(dataLoaded) Module.applyHighlight(); }, 3000);
        },

        applyHighlight: () => {
            if (savedWordsMap.size === 0 || isHighlighting) return;
            isHighlighting = true;
            const words = Array.from(savedWordsMap.keys()).sort((a, b) => b.length - a.length);
            const regex = new RegExp(`(${words.join('|')})`, 'g');
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
                if (node.parentElement.closest('.ja-stored-highlight, .ja-lookup-popup, .ja-modal, SCRIPT, STYLE')) continue;
                if (regex.test(node.nodeValue)) {
                    const span = document.createElement('span');
                    span.innerHTML = node.nodeValue.replace(regex, '<span class="ja-stored-highlight">$1</span>');
                    node.parentNode.replaceChild(span, node);
                }
            }
            isHighlighting = false;
        },

        openManager: () => {
            let m = document.querySelector('.ja-modal');
            if (!m) {
                m = document.createElement('div'); m.className = 'ja-modal';
                m.innerHTML = `<div class="ja-modal-content"><div style="padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;"><h3>Sổ từ vựng (<span id="ja-count">0</span>)</h3><button onclick="this.closest('.ja-modal').style.display='none'" style="border:none; background:none; font-size:24px; cursor:pointer;">✕</button></div><div id="ja-list" style="overflow-y:auto; flex:1;"></div></div>`;
                document.body.appendChild(m);
            }
            m.style.display = 'flex';
            document.getElementById('ja-count').textContent = savedWordsMap.size;
            document.getElementById('ja-list').innerHTML = Array.from(savedWordsMap.entries()).reverse().map(([word, data]) => `
                <div class="ja-word-item">
                    <div style="flex:1"><b>${word}</b> <small style="color:#666">[${getHanViet(word)}]</small><br><span style="font-size:13px; color:#334155;">${data.googleMeaning || data.meaning}</span></div>
                    <button class="ja-del-btn" onclick="JapaneseLookup.deleteFromList('${word}', this.parentElement)">Xóa</button>
                </div>
            `).join('') || '<div style="padding:20px; text-align:center;">Sổ từ trống.</div>';
        },

        deleteFromList: (word, el = null) => {
            if (!confirm(`Xóa "${word}"?`)) return;
            if (el) el.style.display = 'none';
            savedWordsMap.delete(word);
            document.querySelectorAll('.ja-stored-highlight').forEach(s => {
                if (s.textContent === word) {
                    const p = s.parentNode;
                    p.replaceChild(document.createTextNode(s.textContent), s);
                    p.normalize();
                }
            });
            fetch(CONFIG.gas_url, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "deleteWord", word: word }) });
        }
    };

    if (typeof window !== 'undefined') {
        window.JapaneseLookup = Module;
        if (document.readyState === 'complete') Module.init();
        else window.addEventListener('load', () => Module.init());
    }
    return Module;
})();

export { JapaneseLookup as default };