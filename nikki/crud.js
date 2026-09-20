// =============================================================================
// NIKKI - CRUD & DATA HANDLER (XỬ LÝ DỮ LIỆU)
// Quản lý toàn bộ các thao tác Create, Read, Update, Delete và đồng bộ
// giữa IndexedDB cục bộ và Google Sheets thông qua Vercel API.
// =============================================================================

const URL_VERCEL_API  = 'https://hsk-gilt.vercel.app/api/gSheet';
const URL_AI_GENERATE = 'https://hsk-gilt.vercel.app/api/aiGenerate';

const SPREAD_DIARY    = '1UiAS_mUhl6j6wHyPkNiol9pclzkQJWD4qzPIZD2sx3k';
const SHEET_DIARY     = 'DairyList';

const SPREAD_SCORE    = '1_OuLRGiUEzXUpMf-QmPeNYCQee0L1ueGAZcUvNELp8A';
const SHEET_SCORE     = 'ScoreList';

const STORE_NAME      = 'NIKKI';

/**
 * Gọi API trung gian Vercel và tự động xóa cache IndexedDB khi có thao tác ghi/sửa/xóa
 */
async function callAPI(paramsObj, URL = '') {
    if (typeof deleteFromDB === 'function') {
        await deleteFromDB(STORE_NAME, SHEET_DIARY);
    }
    const targetUrl = (URL === '') ? URL_VERCEL_API : URL;
    return await callAjax(targetUrl, paramsObj);
}

/**
 * [READ] Tải danh sách nhật ký: Ưu tiên lấy từ IndexedDB, nếu chưa có thì nạp từ Sheets
 */
async function loadDiaries() {
    try {
        // Kiểm tra xem có dữ liệu trong IndexedDB không
        if (typeof getFromDB === 'function') {
            const cachedData = await getFromDB(STORE_NAME, SHEET_DIARY);
            if (cachedData && cachedData.length > 0) {
                currentDiaries = cachedData;
                if (typeof renderList === 'function') renderList(currentDiaries);
                if (typeof selectedDiaryId !== 'undefined' && selectedDiaryId && typeof selectRecord === 'function') {
                    selectRecord(selectedDiaryId, true);
                }
                return; // Lấy dữ liệu thành công từ IndexedDB, không cần gọi API
            }
        }

        const data = await callAjax(URL_VERCEL_API, { 
            sheet: SHEET_DIARY, 
            act: 'read', 
            spread: SPREAD_DIARY 
        });

        if (data && data.values) {
            currentDiaries = data.values.map(r => ({
                id: r[0],
                date: r[1],
                text: r[2],
                paragraph: r[3],
                conversation: r[4],
                pinned: String(r[5]).toLowerCase() === 'true',
                voiceCount: parseInt(r[6] || 0),
                paragraph_trans: r[7],
                conversation_trans: r[8],
                image: r[9] || ''
            })).reverse();
            
            // Lưu dữ liệu vừa lấy từ API vào IndexedDB để dùng cho lần sau
            if (typeof saveToDB === 'function') {
                await saveToDB(STORE_NAME, SHEET_DIARY, currentDiaries);
            }

            if (typeof renderList === 'function') renderList(currentDiaries);
            if (typeof selectedDiaryId !== 'undefined' && selectedDiaryId && typeof selectRecord === 'function') {
                selectRecord(selectedDiaryId, true);
            }
        }
    } catch (err) {
        console.warn("[CRUD Sync] Lỗi kết nối / Chế độ Offline:", err);
    }
}

/**
 * [CREATE] Thêm mới bài nhật ký vào Google Sheets & cập nhật UI
 */
async function saveDiary() {
    if ((typeof isUploadingImage !== 'undefined' && isUploadingImage) || (typeof checkIsImageUploading === 'function' && checkIsImageUploading())) {
        if (typeof waitForImageUpload === 'function') {
            await waitForImageUpload();
        }
    }
    const diaryInput = document.getElementById('diaryInput');
    const text = (diaryInput ? diaryInput.value : '').trim();
    const image = (typeof getAttachedImage === 'function' ? getAttachedImage() : '') || '';
    if (!text && !image) return;

    const id = Date.now().toString();
    const date = new Date().toLocaleString('vi-VN');
    const newItem = {
        id,
        date,
        text,
        paragraph: "",
        conversation: "",
        pinned: false,
        voiceCount: 0,
        paragraph_trans: "",
        conversation_trans: "",
        image
    };

    if (typeof currentDiaries !== 'undefined') {
        currentDiaries.unshift(newItem);
        if (typeof renderList === 'function') renderList(currentDiaries);
    }

    if (diaryInput) diaryInput.value = '';
    if (typeof removeAttachedImage === 'function') removeAttachedImage();
    if (typeof collapseWriteCard === 'function') collapseWriteCard();

    const rowData = [id, date, text, "", "", "false", 0, "", "", image];

    await callAPI({
        act: 'add',
        sheet: SHEET_DIARY,
        spread: SPREAD_DIARY,
        data: JSON.stringify(rowData)
    });

    if (typeof selectRecord === 'function') {
        selectRecord(id, true);
    }
}

/**
 * [UPDATE] Cập nhật bài nhật ký hiện có
 */
async function updateDiary() {
    if ((typeof isUploadingImage !== 'undefined' && isUploadingImage) || (typeof checkIsImageUploading === 'function' && checkIsImageUploading())) {
        if (typeof waitForImageUpload === 'function') {
            await waitForImageUpload();
        }
    }
    const diaryInput = document.getElementById('diaryInput');
    const text = (diaryInput ? diaryInput.value : '').trim();
    const image = (typeof getAttachedImage === 'function' ? getAttachedImage() : '') || '';
    if (!text && !image) return;

    if (typeof currentDiaries === 'undefined' || typeof editingId === 'undefined') return;
    const idx = currentDiaries.findIndex(i => i.id == editingId);
    if (idx === -1) return;

    const item = currentDiaries[idx];
    item.text = text;
    item.image = image;

    if (typeof renderList === 'function') renderList(currentDiaries);
    const tid = editingId;
    if (typeof clearEditMode === 'function') clearEditMode();

    const rowData = [
        item.id,
        item.date,
        item.text,
        item.paragraph,
        item.conversation,
        String(item.pinned),
        item.voiceCount,
        item.paragraph_trans || "",
        item.conversation_trans || "",
        item.image || ""
    ];

    await callAPI({
        act: 'updateByPosVal',
        pos: 0,
        val: tid,
        sheet: SHEET_DIARY,
        spread: SPREAD_DIARY,
        data: JSON.stringify(rowData)
    });
}

/**
 * [DELETE] Xóa nhật ký theo ID
 */
async function deleteDiary(id) {
    if (confirm("Xóa nhật ký này?")) {
        if (typeof currentDiaries !== 'undefined') {
            currentDiaries = currentDiaries.filter(i => i.id != id);
            if (typeof renderList === 'function') renderList(currentDiaries);
        }
        await callAPI({
            act: 'deleteByPosVal',
            pos: 0,
            val: id,
            sheet: SHEET_DIARY,
            spread: SPREAD_DIARY
        });
    }
}

/**
 * [UPDATE - PIN] Bật / tắt ghim bài viết
 */
async function togglePin(id) {
    if (typeof currentDiaries === 'undefined') return;
    const idx = currentDiaries.findIndex(d => d.id == id);
    if (idx === -1) return;

    const item = currentDiaries[idx];
    item.pinned = !item.pinned;
    if (typeof renderList === 'function') renderList(currentDiaries);

    const rowData = [
        item.id,
        item.date,
        item.text,
        item.paragraph,
        item.conversation,
        String(item.pinned),
        item.voiceCount,
        item.paragraph_trans || "",
        item.conversation_trans || "",
        item.image || ""
    ];

    await callAPI({
        act: 'updateByPosVal',
        pos: 0,
        val: id,
        sheet: SHEET_DIARY,
        spread: SPREAD_DIARY,
        data: JSON.stringify(rowData)
    });
}

/**
 * [AI REQUEST] Gửi nội dung nhật ký lên AI để biên soạn Trình độ N3 & N2
 */
async function askAI(id, content) {
    if (typeof selectRecord === 'function') selectRecord(id);
    if (typeof switchTab === 'function') switchTab(1);

    const pContainer = document.getElementById('paragraphContainer');
    const cContainer = document.getElementById('conversationContainer');
    const mContainer = document.getElementById('aiMeaningContainer');

    if (pContainer) pContainer.innerHTML = '<p class="loading-text">🤖 Đang biên soạn nội dung...</p>';
    if (cContainer) cContainer.innerHTML = '<p class="loading-text">🤖 Đang biên soạn nội dung...</p>';
    if (mContainer) mContainer.innerHTML = '<p class="loading-text">🤖 Đang biên soạn nội dung...</p>';

    try {
        const res = await callAPI({ content, lessionId: id }, URL_AI_GENERATE);
        if (res.status === 'success') {
            await loadDiaries();
        } else {
            alert(res.message);
            if (typeof switchTab === 'function') switchTab(0);
        }
    } catch (e) {
        console.error("[AI Error]", e);
        alert("Lỗi kết nối server AI");
        if (typeof switchTab === 'function') switchTab(0);
    }
}

/**
 * [READ - SCORES] Nạp và tổng hợp điểm số ghi âm các bài học từ ScoreList
 */
async function getLessonTotalScore() {
    try {
        let result;
        if (typeof getFromDB === 'function') {
            const cachedScores = await getFromDB(STORE_NAME, SHEET_SCORE);
            if (cachedScores && cachedScores.values && cachedScores.values.length > 0) {
                result = cachedScores;
            }
        }
        if (!result) {
            result = await callAjax(URL_VERCEL_API, { 
                sheet: SHEET_SCORE, 
                act: 'read', 
                spread: SPREAD_SCORE 
            });
            if (result && result.values && result.values.length > 0 && typeof saveToDB === 'function') {
                await saveToDB(STORE_NAME, SHEET_SCORE, result);
            }
        }
        if (result && result.values && Array.isArray(result.values)) {
            document.querySelectorAll('.count-trigger').forEach(badge => {
                const match = badge.getAttribute('onclick')?.match(/'([^']+)'/);
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
    } catch (e) {
        console.error("[Score Sync Error]", e);
    }
}

// Đối tượng CRUD gom nhóm tiện ích
window.DiaryCRUD = {
    load: loadDiaries,
    create: saveDiary,
    update: updateDiary,
    delete: deleteDiary,
    togglePin: togglePin,
    askAI: askAI,
    getScores: getLessonTotalScore
};
