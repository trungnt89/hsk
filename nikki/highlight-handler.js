// =============================================================================
// QUẢN LÝ TÔ MÀU & TỪ VỰNG TIẾNG NHẬT TỪ INDEXEDDB MAZII
// Hỗ trợ highlight tức thì các từ vựng đã lưu trong bài luận N3 / N2
// =============================================================================

var cachedHighlightWords = [];
var cachedHighlightRegex = null;

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateHighlightRegex(words) {
    if (!words || !words.length) return;
    const uniqueWords = Array.from(new Set(words.map(w => String(w).trim()).filter(Boolean)))
        .sort((a, b) => b.length - a.length);
    if (!uniqueWords.length) return;
    cachedHighlightWords = uniqueWords;
    const pattern = uniqueWords.map(escapeRegex).join('|');
    cachedHighlightRegex = new RegExp(`(${pattern})`, 'g');
}

function formatJapaneseHighlight(text) {
    if (!text) return '';
    // Nếu chưa có regex, kiểm tra xem window.JapaneseLookup đã nạp từ chưa
    if (!cachedHighlightRegex && window.JapaneseLookup && typeof window.JapaneseLookup.getSavedWords === 'function') {
        const words = window.JapaneseLookup.getSavedWords();
        if (words && words.length > 0) updateHighlightRegex(words);
    }
    if (!cachedHighlightRegex) return text;
    return text.replace(cachedHighlightRegex, '<span class="ja-stored-highlight">$1</span>');
}

function applyImmediateHighlight() {
    ['p-content', 'c-content'].forEach(id => {
        const el = document.getElementById(id);
        if (el && cachedHighlightRegex) {
            if (!el.querySelector('.ja-stored-highlight')) {
                const rawText = el.innerText || el.textContent || '';
                if (rawText && rawText !== '(Chưa có văn bản tiếng Nhật)') {
                    el.innerHTML = formatJapaneseHighlight(rawText);
                }
            }
        }
    });
    if (window.JapaneseLookup && typeof window.JapaneseLookup.applyHighlight === 'function') {
        const container = document.getElementById('aiMeaningContainer');
        window.JapaneseLookup.applyHighlight(container || document.body);
    }
}

async function initWordHighlightFromDB() {
    // 1. Lắng nghe event khi JapaneseLookup nạp xong từ vựng
    window.addEventListener('japaneseWordsLoaded', (e) => {
        if (e.detail && Array.isArray(e.detail)) {
            updateHighlightRegex(e.detail);
            if (typeof currentTopTab !== 'undefined' && currentTopTab === 1) {
                applyImmediateHighlight();
            }
        }
    });

    // 2. Nếu JapaneseLookup đã có danh sách từ
    if (window.JapaneseLookup && typeof window.JapaneseLookup.getSavedWords === 'function') {
        const words = window.JapaneseLookup.getSavedWords();
        if (words && words.length > 0) {
            updateHighlightRegex(words);
            return;
        }
    }

    // 3. Đọc trực tiếp từ IndexedDB MAZII -> WORDS -> word_list_data
    try {
        const req = indexedDB.open("MAZII", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("WORDS");
        req.onsuccess = () => {
            const db = req.result;
            try {
                const tx = db.transaction("WORDS", "readonly");
                const store = tx.objectStore("WORDS");
                const getReq = store.get("word_list_data");
                getReq.onsuccess = () => {
                    const data = getReq.result;
                    if (data && data.values && Array.isArray(data.values)) {
                        const words = data.values.map(row => row && row[1]).filter(Boolean);
                        updateHighlightRegex(words);
                        if (typeof currentTopTab !== 'undefined' && currentTopTab === 1) {
                            applyImmediateHighlight();
                        }
                    }
                };
            } catch (e) {
                console.warn("[Highlight DB] Error reading WORDS store:", e);
            }
        };
    } catch (e) {
        console.warn("[Highlight DB] Error opening MAZII:", e);
    }
}
