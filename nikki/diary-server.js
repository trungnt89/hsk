import { getFromDB, saveToDB, callAjax } from '../com/util.js';

const URL_VERCEL_API  = 'https://hsk-gilt.vercel.app/api/gSheet';
const URL_AI_GENERATE = 'https://hsk-gilt.vercel.app/api/aiGenerate';

const SPREAD_DIARY    = '1UiAS_mUhl6j6wHyPkNiol9pclzkQJWD4qzPIZD2sx3k';
const SHEET_DIARY     = 'DairyList';

const SPREAD_SCORE    = '1_OuLRGiUEzXUpMf-QmPeNYCQee0L1ueGAZcUvNELp8A';
const SHEET_SCORE     = 'ScoreList';

const STORE_NAME      = 'NIKKI';

async function loadDiaries() {
    try {
        // Kiểm tra xem có dữ liệu trong IndexedDB không
        const cachedData = await getFromDB(STORE_NAME, SHEET_DIARY);
        if (cachedData && cachedData.length > 0) {
            currentDiaries = cachedData;
            renderList(currentDiaries);
            if (selectedDiaryId) selectRecord(selectedDiaryId, true);
            return; // Lấy dữ liệu thành công từ IndexedDB, không gọi API nữa
        }

        const data = await callAjax(URL_VERCEL_API, { 
            sheet: SHEET_DIARY, 
            act: 'read', 
            spread: SPREAD_DIARY 
        });
        if (data.values) {
            currentDiaries = data.values.map(r => ({
                id: r[0], date: r[1], text: r[2], paragraph: r[3], conversation: r[4], pinned: String(r[5]).toLowerCase() === 'true', voiceCount: parseInt(r[6] || 0), paragraph_trans: r[7], conversation_trans: r[8]
            })).reverse();
            
            // Lưu dữ liệu vừa lấy từ API vào IndexedDB để dùng cho lần sau
            await saveToDB(STORE_NAME, SHEET_DIARY,currentDiaries);

            renderList(currentDiaries);
            if (selectedDiaryId) selectRecord(selectedDiaryId, true);
        }
    } catch (err) { console.warn("[Sync] Offline mode"); }
}

async function callAPI(paramsObj,URL='') {
    await deleteFromDB(STORE_NAME, SHEET_DIARY);
    URL = (URL=='') ? URL_VERCEL_API : URL;
    return await callAjax(URL_VERCEL_API, paramsObj);
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

    await callAPI({ act: 'add', sheet: SHEET_DIARY, spread: SPREAD_DIARY, data: JSON.stringify(rowData) });
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
    await callAPI({ act: 'updateByPosVal', pos: 0, val: tid, sheet: SHEET_DIARY, spread: SPREAD_DIARY, data: JSON.stringify(rowData) });
}

async function deleteDiary(id) {
    if (confirm("Xóa nhật ký này?")) {
        currentDiaries = currentDiaries.filter(i => i.id != id);
        renderList(currentDiaries);
        await callAPI({ act: 'deleteByPosVal', pos: 0, val: id, sheet: SHEET_DIARY, spread: SPREAD_DIARY });
    }
}

async function togglePin(id) {
    const idx = currentDiaries.findIndex(d => d.id == id);
    if (idx === -1) return;
    const item = currentDiaries[idx];
    item.pinned = !item.pinned;
    renderList(currentDiaries);
    const rowData = [item.id, item.date, item.text, item.paragraph, item.conversation, String(item.pinned), item.voiceCount, item.paragraph_trans || "", item.conversation_trans || ""];
    await callAPI({ act: 'updateByPosVal', pos: 0, val: id, sheet: SHEET_DIARY, spread: SPREAD_DIARY, data: JSON.stringify(rowData) });
}

async function askAI(id, content) {
    selectRecord(id); switchTab(1);
    const pContainer = document.getElementById('paragraphContainer'), cContainer = document.getElementById('conversationContainer');
    pContainer.innerHTML = cContainer.innerHTML = '<p class="loading-text">🤖 Đang biên soạn nội dung...</p>';
    try {
        const res = await callAPI({ content, lessionId: id },URL_AI_GENERATE);
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
        let result;
        const cachedScores = await getFromDB(STORE_NAME, SHEET_SCORE);
        if (cachedScores && cachedScores.values && cachedScores.values.length > 0) {
            result = cachedScores;
        } else {
            result = await callAjax(URL_VERCEL_API, { 
                sheet: SHEET_SCORE, 
                act: 'read', 
                spread: SPREAD_SCORE 
            });
            if (result && result.values && result.values.length > 0) {
                await saveToDB(STORE_NAME, SHEET_SCORE,result);
            }
        }
        if (result && result.values && Array.isArray(result.values)) {
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
                    badge.innerHTML = `🎙️ ${count} ${maxScore ? ' 🏆 ' + maxScore : ''}`;
                    badge.style.backgroundColor = count > 0 ? 'orange' : 'gray';
                }
            });
        }
    } catch (e) { console.error(e); }
}