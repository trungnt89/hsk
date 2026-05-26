// CONFIG URLS
const VERCEL_URL = 'https://hsk-gilt.vercel.app/api/gSheet';

// --- KHỞI TẠO VÀ QUẢN LÝ INDEXEDDB ---
const DB_NAME = 'DiaryCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'diaries';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getCachedDiaries() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error("IndexedDB Get Error:", err);
        return [];
    }
}

async function saveDiariesToCache(diaries) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear(); // Làm sạch cache cũ trước khi ghi đè cache mới nhất
        diaries.forEach(item => store.put(item));
        return tx.complete;
    } catch (err) {
        console.error("IndexedDB Save Error:", err);
    }
}

async function clearDiaryCache() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        return tx.complete;
    } catch (err) {
        console.error("IndexedDB Clear Error:", err);
    }
}
// -------------------------------------

async function loadDiaries() {
    try {
        // Kiểm tra xem có dữ liệu trong IndexedDB không
        const cachedData = await getCachedDiaries();
        if (cachedData && cachedData.length > 0) {
            currentDiaries = cachedData;
            renderList(currentDiaries);
            if (selectedDiaryId) selectRecord(selectedDiaryId, true);
            return; // Lấy dữ liệu thành công từ IndexedDB, không gọi API nữa
        }

        const response = await fetch(VERCEL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sheet: 'DairyList', 
                act: 'read', 
                spread: '1UiAS_mUhl6j6wHyPkNiol9pclzkQJWD4qzPIZD2sx3k' 
            })
        });
        const data = await response.json();
        if (data.values) {
            currentDiaries = data.values.map(r => ({
                id: r[0], date: r[1], text: r[2], paragraph: r[3], conversation: r[4], pinned: String(r[5]).toLowerCase() === 'true', voiceCount: parseInt(r[6] || 0), paragraph_trans: r[7], conversation_trans: r[8]
            })).reverse();
            
            // Lưu dữ liệu vừa lấy từ API vào IndexedDB để dùng cho lần sau
            await saveDiariesToCache(currentDiaries);

            renderList(currentDiaries);
            if (selectedDiaryId) selectRecord(selectedDiaryId, true);
        }
    } catch (err) { console.warn("[Sync] Offline mode"); }
}

async function callAPI(paramsObj) {
    try {
        const response = await fetch(VERCEL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paramsObj)
        });
		
		// Xóa dữ liệu đã lưu trong IndexedDB trước khi gọi API
		await clearDiaryCache();
        return await response.json();
    } catch (e) {
        console.error("[Sync Error]:", e);
        return { status: 'error', message: "Lỗi kết nối server" };
    }
}

async function saveDiary() {
    const text = document.getElementById('diaryInput').value.trim();
    if (!text) return;
    const id = Date.now().toString(), date = new Date().toLocaleString('vi-VN');
    const newItem = { id, date, text, paragraph: "", conversation: "", pinned: false, voiceCount: 0, paragraph_trans: "", conversation_trans: "" };
    currentDiaries.unshift(newItem);
    renderList(currentDiaries);
    document.getElementById('diaryInput').value = '';
    const rowData = [id, date, text, "", "", "false", 0, "", ""];

    await callAPI({ act: 'add', sheet: 'DairyList', spread: '1UiAS_mUhl6j6wHyPkNiol9pclzkQJWD4qzPIZD2sx3k', data: JSON.stringify(rowData) });
    selectRecord(id, true);
}

async function updateDiary() {
    const text = document.getElementById('diaryInput').value.trim();
    const idx = currentDiaries.findIndex(i => i.id == editingId);
    if (idx === -1) return;
    const item = currentDiaries[idx];
    item.text = text;
    renderList(currentDiaries);
    const tid = editingId;
    clearEditMode();
    const rowData = [item.id, item.date, item.text, item.paragraph, item.conversation, String(item.pinned), item.voiceCount, item.paragraph_trans || "", item.conversation_trans || ""];
    await callAPI({ act: 'updateByPosVal', pos: 0, val: tid, sheet: 'DairyList', spread: '1UiAS_mUhl6j6wHyPkNiol9pclzkQJWD4qzPIZD2sx3k', data: JSON.stringify(rowData) });
}

async function deleteDiary(id) {
    if (confirm("Xóa nhật ký này?")) {
        currentDiaries = currentDiaries.filter(i => i.id != id);
        renderList(currentDiaries);
        await callAPI({ act: 'deleteByPosVal', pos: 0, val: id, sheet: 'DairyList', spread: '1UiAS_mUhl6j6wHyPkNiol9pclzkQJWD4qzPIZD2sx3k' });
    }
}

async function togglePin(id) {
    const idx = currentDiaries.findIndex(d => d.id == id);
    if (idx === -1) return;
    const item = currentDiaries[idx];
    item.pinned = !item.pinned;
    renderList(currentDiaries);
    const rowData = [item.id, item.date, item.text, item.paragraph, item.conversation, String(item.pinned), item.voiceCount, item.paragraph_trans || "", item.conversation_trans || ""];
    await callAPI({ act: 'updateByPosVal', pos: 0, val: id, sheet: 'DairyList', spread: '1UiAS_mUhl6j6wHyPkNiol9pclzkQJWD4qzPIZD2sx3k', data: JSON.stringify(rowData) });
}

async function askAI(id, content) {
    selectRecord(id); switchTab(1);
    const pContainer = document.getElementById('paragraphContainer'), cContainer = document.getElementById('conversationContainer');
    pContainer.innerHTML = cContainer.innerHTML = '<p class="loading-text">🤖 Đang biên soạn nội dung...</p>';
    try {
        const response = await fetch('https://hsk-gilt.vercel.app/api/aiGenerate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, lessionId: id })
        });
        const res = await response.json();
        if (res.status === 'success') {
            loadDiaries();
        } else {
            alert(res.message);
            switchTab(0);
        }
    } catch (e) {
        console.error(e);
        alert("Lỗi kết nối server AI");
        switchTab(0);
    }
}

async function getLessonTotalScore() {
    try {
        const res = await fetch(VERCEL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sheet: 'ScoreList', 
                act: 'read', 
                spread: '1_OuLRGiUEzXUpMf-QmPeNYCQee0L1ueGAZcUvNELp8A' 
            })
        });
        const result = await res.json();
        if (result.values && Array.isArray(result.values)) {
            document.querySelectorAll('.count-trigger').forEach(badge => {
                const match = badge.getAttribute('onclick').match(/'([^']+)'/);
                if (match && match[1]) {
                    const lessonID = match[1];
                    let count = 0, maxScore = 0;
                    result.values.forEach(row => {
                        if (row[0] === lessonID) {
                            count++;
                            let score = parseInt(row[3]);
                            if (!isNaN(score) && score > maxScore) maxScore = score;
                        }
                    });
                }
            });
        }
    } catch (e) { console.error(e); }
}
