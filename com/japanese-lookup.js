/**
 * Japanese Lookup & Highlight Manager - Version 2026.36.1
 * - Feature: Optimized for Safari iOS (iPhone)
 * - Logic: Only look up 1-character strings if they are Kanji
 * - Strict Limit: No lookup for selections > 6 words or > 50 characters
 * - Integrity: Preserving all Kanji Details and GAS Logic
 */

const JapaneseLookup = (() => {
    const CONFIG = {
        vercel_api: "/api/mazii", 
        API_URL: "https://hsk-gilt.vercel.app/api/gSheet",
        sheet: "WordList",
        spread: "1PYwmqxUS_AbkFGapkwMTsEJE5Vx9p6R7pO4YFfiniXI"
    };

    const style = document.createElement('style');
    style.textContent = `
        .ja-lookup-popup {
            position: sticky; z-index: 2147483647; background: #fff; 
            border-top: 3px solid #2563eb; bottom: 0; width: 100%; 
            padding: 10px 15px 15px 15px; box-shadow: 0 -10px 30px rgba(0,0,0,0.1);
            font-family: -apple-system, system-ui, sans-serif; display: none; font-size: 15px;
            box-sizing: border-box; transition: transform 0.2s ease-out;
        }
        .ja-btn-close-tp { position: absolute; top: 5px; right: 15px; cursor: pointer; color: #94a3b8; font-size: 20px; font-weight: bold; }
        .ja-lookup-word { color: #1e40af; font-size: 1.2em; font-weight: bold; display: inline-block; margin-bottom: 2px; }
        .ja-hanviet-tag { color: #dc2626; font-size: 0.8em; font-weight: bold; margin-left: 5px; background: #fef2f2; padding: 1px 5px; border-radius: 4px; }
        .ja-stored-highlight { color: #2563eb !important; border-bottom: 1.5px dashed #2563eb !important; background: none !important; display: inline !important; cursor: pointer; }
        .ja-history-btn { position: fixed; top: 5px; right: 5px; width: 30px; height: 30px; background: #2563eb; color: white; border-radius: 50%; z-index: 1000002; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: pointer; border:none; font-size: 18px; }
        .ja-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1000003; align-items: center; justify-content: center; }
        .ja-modal-content { background: white; width: 95%; max-width: 400px; height: 80vh; border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; }
        .ja-word-item { padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .ja-del-btn { color: #ef4444; background: #fee2e2; border: none; border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; }
    `;
    document.head.appendChild(style);

    let popup = null, isHighlighting = false, dataLoaded = false, kanjiDict = null;
    let savedWordsMap = new Map();

    const initDB = () => new Promise((res, rej) => {
        const req = indexedDB.open("JA_Lookup_DB", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("cache");
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });

    const getDBData = (db, key) => new Promise(res => {
        const tx = db.transaction("cache", "readonly");
        const req = tx.objectStore("cache").get(key);
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
    });

    const saveDBData = (db, key, val) => {
        const tx = db.transaction("cache", "readwrite");
        tx.objectStore("cache").put(val, key);
    };

    const loadKanjiDict = async () => {
        try {
            const db = await initDB();
            let data = await getDBData(db, "kanji_json");
            if (!data) {
                console.log("[Log] Fetching kanjimini.json from server...");
                const res = await fetch("../com/kanjimini.json");
                data = await res.json();
                saveDBData(db, "kanji_json", data);
            } else {
                console.log("[Log] Kanji loaded from IndexedDB.");
            }
            kanjiDict = data.reduce((acc, curr) => { acc[curr.w] = curr.h; return acc; }, {});
        } catch (e) { console.warn("[Log] Kanji Load Error:", e); }
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
            <div style="margin-bottom:5px;">
                <b class="ja-lookup-word">${word}</b>
                ${hanViet ? `<span class="ja-hanviet-tag">${hanViet}</span>` : ''}
                <span style="color:#94a3b8; font-size:0.85em; margin-left:8px;">${phonetic || ''}</span>
            </div>
            <div style="background:#eff6ff; border-left:3px solid #2563eb; padding:8px 12px; margin-bottom:8px; border-radius:4px; font-size:14px; color:#1e40af; line-height:1.4;">
                ${shortMean}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                <span style="font-size:11px; color:#cbd5e1;">${isStored ? '● TRONG BỘ NHỚ' : '○ TRA MỚI'}</span>
                <button class="ja-del-btn" id="btn-del-now">🗑 Xóa</button>
            </div>
        `;
        document.getElementById('btn-del-now').onclick = () => {
            Module.deleteFromList(word);
            popup.style.display = 'none';
        };
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }

    async function lookupNew(text) {
        if (!text) return;
        const isKanji = kanjiDict && text.length === 1 && kanjiDict[text];
        showPopup(text, '...', '', '', false);

        // Xóa data danh sách từ vựng đã lưu trong IndexedDB khi bắt đầu tra từ mới
        try {
            const db = await initDB();
            const tx = db.transaction("cache", "readwrite");
            tx.objectStore("cache").delete("word_list_data");
        } catch (e) {
            console.warn("[Log] IndexedDB Clear Cache Error:", e);
        }

        try {
            const res = await fetch(CONFIG.vercel_api, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: text, type: isKanji ? "kanji" : "word" })
            });
            const data = await res.json();

            if (isKanji && data.results && data.results.length > 0) {
                const k = data.results[0];
                const kanjiDetail = `<div style="margin-top:5px; padding-top:5px; border-top:1px dashed #bfdbfe; font-size:12px; color:#475569;"><b>Kun:</b> ${k.kun}<br><b>Giải thích:</b> ${k.detail.replace(/##/g, '<br>• ')}</div>`;
                showPopup(text, k.mean + kanjiDetail, '', `[Kanji]`, false);
            } else if (data.data && data.data.words && data.data.words.length > 0) {
                const item = data.data.words[0];
                const detailed = item.means ? item.means.map(m => m.mean).join(", ") : "N/A";
                showPopup(text, item.short_mean || detailed, detailed, item.phonetic || "", false);
                if (!savedWordsMap.has(text)) {
                    savedWordsMap.set(text, { meaning: detailed, romaji: item.phonetic, googleMeaning: item.short_mean });
                    Module.applyHighlight();
                    const ts = new Date().toLocaleString('ja-JP');
                    console.log("[Log] Sending update request for: " + text);
                    fetch(CONFIG.API_URL, { 
                        method: "POST",
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            sheet: CONFIG.sheet, 
                            spread: CONFIG.spread, 
                            act: "updateByPosVal", 
                            pos: 1, 
                            val: text, 
                            data: [ts, text, item.phonetic, item.short_mean || detailed] 
                        }) 
                    });
                }
            }
        } catch (e) { 
            console.error("[Log] Lookup error:", e);
            showPopup(text, "Lỗi kết nối", "", "", false); 
        }
    }

    const Module = {
        init: async () => {
            createUI();
            await loadKanjiDict();
            try {
                const db = await initDB();
                // 1. Kiểm tra nếu có data danh sách từ vựng trong IndexedDB thì lấy luôn
                let cachedData = await getDBData(db, "word_list_data");
                
                if (cachedData && cachedData.values) {
                    console.log("[Log] Data initialized from IndexedDB cache.");
                    cachedData.values.forEach(w => savedWordsMap.set(w[1], { meaning: w[3], romaji: w[2], googleMeaning: w[3] || "" }));
                    dataLoaded = true;
                    Module.applyHighlight();
                } else {
                    // Nếu chưa có cache thì mới gọi API từ Vercel
                    console.log("[Log] Fetching data from API...");
                    const res = await fetch(CONFIG.API_URL, {
                        method: "POST",
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sheet: CONFIG.sheet, spread: CONFIG.spread, act: "read", v: Date.now() })
                    });
                    const data = await res.json();
                    
                    // Lưu dữ liệu lấy từ API vào IndexedDB
                    if (data && data.values) {
                        saveDBData(db, "word_list_data", data);
                        data.values.forEach(w => savedWordsMap.set(w[1], { meaning: w[3], romaji: w[2], googleMeaning: w[3] || "" }));
                    }
                    
                    dataLoaded = true;
                    Module.applyHighlight();
                    console.log("[Log] Data initialized from Vercel API và lưu vào cache.");
                }
            } catch (e) { 
                console.warn("[Log] API or DB load failed.");
                dataLoaded = true; 
            }

            document.addEventListener('mousedown', (e) => {
                if (e.target.closest('.ja-stored-highlight')) {
                    const word = e.target.textContent;
                    const d = savedWordsMap.get(word);
                    if (d) showPopup(word, d.googleMeaning || d.meaning, d.meaning, d.romaji, true);
                } else if (!e.target.closest('.ja-lookup-popup') && !e.target.closest('.ja-modal') && !e.target.closest('.ja-history-btn')) {
                    if (popup) popup.style.display = 'none';
                }
            });

            const handleSelection = () => {
                const selection = window.getSelection();
                const selText = selection.toString().trim();
                if (!selText) return;
                
                const wordCount = selText.length;
                console.log("[Log] Selection detected: " + selText + " (Length: " + wordCount + ")");

                if (wordCount > 6 || selText.length > 50) {
                    console.log("[Log] Selection exceeds limits.");
                    return;
                }

                if (wordCount === 1 && !/[\u4e00-\u9fff]/.test(selText)) {
                    console.log("[Log] Single character is Hiragana/Katakana/Romaji. Skipping.");
                    return;
                }

                if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(selText)) {
                    lookupNew(selText);
                }
            };

            document.addEventListener('mouseup', handleSelection);
            document.addEventListener('selectionchange', () => {
                if (window._selTimeout) clearTimeout(window._selTimeout);
                window._selTimeout = setTimeout(handleSelection, 500);
            });

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
                m.innerHTML = `<div class="ja-modal-content"><div style="padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;"><h3>Từ vựng (<span id="ja-count">0</span>)</h3><button onclick="this.closest('.ja-modal').style.display='none'" style="border:none; background:none; font-size:24px; cursor:pointer;">✕</button></div><div id="ja-list" style="overflow-y:auto; flex:1;"></div></div>`;
                document.body.appendChild(m);
            }
            m.style.display = 'flex';
            document.getElementById('ja-count').textContent = savedWordsMap.size;
            document.getElementById('ja-list').innerHTML = Array.from(savedWordsMap.entries()).reverse().map(([word, data]) => `
                <div class="ja-word-item">
                    <div style="flex:1"><b>${word}</b> <small style="color:#dc2626; font-weight:bold;">${getHanViet(word)}</small> <small style="color:#64748b;">(${data.romaji || ''})</small><br><span style="font-size:13px; color:#475569;">${data.googleMeaning || data.meaning}</span></div>
                    <button class="ja-del-btn" onclick="JapaneseLookup.deleteFromList('${word}', this.parentElement)">Xóa</button>
                </div>
            `).join('') || '<div style="padding:20px; text-align:center;">Trống.</div>';
        },

        deleteFromList: async (word, el = null) => {
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

            // Xóa data danh sách từ vựng đã lưu trong IndexedDB khi xóa một từ khỏi danh sách
            try {
                const db = await initDB();
                const tx = db.transaction("cache", "readwrite");
                tx.objectStore("cache").delete("word_list_data");
            } catch (e) {
                console.warn("[Log] IndexedDB Delete Cache Error:", e);
            }

            console.log("[Log] Deleting word: " + word);
            fetch(CONFIG.API_URL, { 
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sheet: CONFIG.sheet, spread: CONFIG.spread, act: "deleteByPosVal", pos: 1, val: word })
            });
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
