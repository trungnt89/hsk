/**
 * Japanese Lookup & Highlight Manager - Version 2026.28
 * - Logic: Check kanjimini.json -> If true, call Vercel Proxy with type: "kanji"
 * - Logic: If false/multi-char, call Vercel Proxy with type: "word"
 */

const JapaneseLookup = (() => {
    const CONFIG = {
        vercel_api: "/api/mazii", 
        gas_url: "https://script.google.com/macros/s/AKfycbxRsR4M3R0rjz3i0u2kz6Pg-ME3IeDYs8-7GE0MrjRaakfxQBory3JMtjjgVw3lTbqI/exec"
    };

    let popup = null, isHighlighting = false, dataLoaded = false, kanjiDict = null;
    let savedWordsMap = new Map();

    const loadKanjiDict = async () => {
        try {
            const res = await fetch("kanjimini.json");
            const data = await res.json();
            kanjiDict = data.reduce((acc, curr) => { acc[curr.w] = curr.h; return acc; }, {});
            console.log("[Log] Kanji Dictionary Loaded.");
        } catch (e) { console.warn("[Log] kanjimini.json load failed."); }
    };

    const getHanViet = (text) => {
        if (!kanjiDict || !text) return "";
        return text.split('').map(char => {
            const hv = kanjiDict[char];
            return hv ? hv.split(/[;,]/)[0].trim().toUpperCase() : "";
        }).filter(v => v).join(" ");
    };

    const showPopup = (word, shortMean, detailedMeans, phonetic, isStored = false) => {
        if (!popup) {
            popup = document.createElement('div');
            popup.className = 'ja-lookup-popup';
            document.body.appendChild(popup);
        }
        const hanViet = getHanViet(word);
        popup.style.display = 'block';
        popup.innerHTML = `
            <span class="ja-btn-close-tp" onclick="this.parentElement.style.display='none'">✕</span>
            <div style="margin-bottom:8px;">
                <b class="ja-lookup-word">${word}</b>
                ${hanViet ? `<span class="ja-hanviet-tag">${hanViet}</span>` : ''}
                <span style="color:#64748b; font-size:0.95em; margin-left:10px;">${phonetic || ''}</span>
            </div>
            <div style="background:#eff6ff; border-left:4px solid #2563eb; padding:8px 12px; margin-bottom:12px; border-radius:4px;">
                <div style="font-size:11px; color:#2563eb; font-weight:bold;">TÓM TẮT</div>
                <div style="color:#1e40af; font-weight:500;">${shortMean}</div>
            </div>
            <div style="max-height:100px; overflow-y:auto; margin-bottom:12px; font-size:14px;">
                <div style="font-size:11px; color:#94a3b8; font-weight:bold;">NGHĨA CHI TIẾT</div>
                <div style="padding-left:10px; border-left:1px solid #e2e8f0;">${detailedMeans}</div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px; color:#94a3b8;">${isStored ? '● TRONG BỘ NHỚ' : '○ TRA MỚI'}</span>
                <button class="ja-del-btn" id="btn-del-now">🗑 Xóa</button>
            </div>
        `;
        document.getElementById('btn-del-now').onclick = () => Module.deleteFromList(word);
    };

    async function lookupNew(text) {
        if (!text) return;
        const isKanji = kanjiDict && text.length === 1 && kanjiDict[text];
        
        showPopup(text, 'Đang tra cứu...', '...', '', false);

        try {
            const res = await fetch(CONFIG.vercel_api, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    query: text, 
                    type: isKanji ? "kanji" : "word" 
                })
            });
            const data = await res.json();

            if (isKanji) {
                // Xử lý dữ liệu trả về từ API Kanji
                if (data.results && data.results.length > 0) {
                    const k = data.results[0];
                    showPopup(text, `Hán Việt: ${getHanViet(text)}`, 
                        `On: ${k.on || 'N/A'}<br>Kun: ${k.kun || 'N/A'}<br>Nghĩa: ${k.mean}<br>Số nét: ${k.stroke_count}`, 
                        `[Kanji]`, false);
                }
            } else {
                // Xử lý dữ liệu trả về từ API Word
                if (data.data && data.data.words && data.data.words.length > 0) {
                    const item = data.data.words[0];
                    const detailed = item.means ? item.means.map(m => m.mean).join(", ") : "";
                    showPopup(text, item.short_mean || "N/A", detailed, item.phonetic || "", false);

                    if (!savedWordsMap.has(text)) {
                        savedWordsMap.set(text, { meaning: detailed, romaji: item.phonetic, googleMeaning: item.short_mean });
                        Module.applyHighlight();
                        fetch(CONFIG.gas_url, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "saveWord", word: text, romaji: item.phonetic, meaning: detailed, googleMeaning: item.short_mean }) });
                    }
                }
            }
        } catch (e) {
            console.error(e);
            showPopup(text, "Lỗi kết nối", "Không thể gọi API", "", false);
        }
    }

    const Module = {
        init: async () => {
            console.log("[Log] Init JapaneseLookup v2026.28");
            await loadKanjiDict();
            try {
                const res = await fetch(CONFIG.gas_url + "?type=words&v=" + Date.now());
                const data = await res.json();
                data.forEach(w => savedWordsMap.set(w.word, { meaning: w.meaning, romaji: w.romaji, googleMeaning: w.googleMeaning || "" }));
                dataLoaded = true;
                Module.applyHighlight();
            } catch (e) { dataLoaded = true; }

            document.addEventListener('mouseup', () => {
                const sel = window.getSelection().toString().trim();
                if (sel && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(sel)) lookupNew(sel);
            });
        },
        applyHighlight: () => { /* Giữ nguyên logic cũ */ },
        deleteFromList: (word) => { /* Giữ nguyên logic cũ */ }
    };

    window.JapaneseLookup = Module;
    if (document.readyState === 'complete') Module.init();
    else window.addEventListener('load', Module.init);
    return Module;
})();