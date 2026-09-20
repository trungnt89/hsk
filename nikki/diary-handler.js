// =============================================================================
// QUẢN LÝ NHẬT KÝ & DỮ LIỆU (DIARY & DATA HANDLER)
// Bao gồm: Toàn bộ xử lý CRUD (Create, Read, Update, Delete), đồng bộ
// Google Sheets / IndexedDB, giao diện danh sách, tương tác soạn thảo & AI.
// =============================================================================

const URL_VERCEL_API  = 'https://hsk-gilt.vercel.app/api/gSheet';
const URL_AI_GENERATE = 'https://hsk-gilt.vercel.app/api/aiGenerate';

const SPREAD_DIARY    = '1UiAS_mUhl6j6wHyPkNiol9pclzkQJWD4qzPIZD2sx3k';
const SHEET_DIARY     = 'DairyList';

const SPREAD_SCORE    = '1_OuLRGiUEzXUpMf-QmPeNYCQee0L1ueGAZcUvNELp8A';
const SHEET_SCORE     = 'ScoreList';

const STORE_NAME      = 'NIKKI';

var currentDiaries = [];
var editingId = null;

var diaryUrlParams = new URLSearchParams(window.location.search);
var diaryUrlId = diaryUrlParams.get('id');
var selectedDiaryId = diaryUrlId || localStorage.getItem("diary_selected_id") || null;
if (diaryUrlId && diaryUrlId !== localStorage.getItem("diary_selected_id")) {
    localStorage.setItem("diary_selected_id", diaryUrlId);
}

var showPinnedOnly = localStorage.getItem("diary_show_pinned_only") === "true";

// =============================================================================
// TẦNG DỮ LIỆU & GỌI API (DATA ACCESS LAYER)
// =============================================================================

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
 * [READ] Tải danh sách nhật ký: Ưu tiên lấy từ IndexedDB, nếu chưa có thì nạp từ Google Sheets
 */
async function loadDiaries() {
    try {
        if (typeof getFromDB === 'function') {
            const cachedData = await getFromDB(STORE_NAME, SHEET_DIARY);
            if (cachedData && cachedData.length > 0) {
                currentDiaries = cachedData;
                renderList(currentDiaries);
                if (selectedDiaryId) selectRecord(selectedDiaryId, true);
                return;
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
            
            if (typeof saveToDB === 'function') {
                await saveToDB(STORE_NAME, SHEET_DIARY, currentDiaries);
            }

            renderList(currentDiaries);
            if (selectedDiaryId) selectRecord(selectedDiaryId, true);
        }
    } catch (err) {
        console.warn("[Diary Data] Lỗi kết nối / Chế độ Offline:", err);
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

    currentDiaries.unshift(newItem);
    renderList(currentDiaries);

    if (diaryInput) diaryInput.value = '';
    if (typeof removeAttachedImage === 'function') removeAttachedImage();
    collapseWriteCard();

    const rowData = [id, date, text, "", "", "false", 0, "", "", image];

    await callAPI({
        act: 'add',
        sheet: SHEET_DIARY,
        spread: SPREAD_DIARY,
        data: JSON.stringify(rowData)
    });

    selectRecord(id, true);
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

    const idx = currentDiaries.findIndex(i => i.id == editingId);
    if (idx === -1) return;

    const item = currentDiaries[idx];
    item.text = text;
    item.image = image;

    renderList(currentDiaries);
    const tid = editingId;
    clearEditMode();

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
        currentDiaries = currentDiaries.filter(i => i.id != id);
        renderList(currentDiaries);
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
    const idx = currentDiaries.findIndex(d => d.id == id);
    if (idx === -1) return;

    const item = currentDiaries[idx];
    item.pinned = !item.pinned;
    renderList(currentDiaries);

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
    selectRecord(id);
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

// =============================================================================
// GIAO DIỆN & TƯƠNG TÁC NGƯỜI DÙNG (UI & INTERACTION)
// =============================================================================

function expandWriteCard() {
    const card = document.querySelector('.write-card');
    const input = document.getElementById('diaryInput');
    const cancelBtn = document.getElementById('cancelBtn');
    if (card) card.classList.add('expanded');
    if (input) input.classList.add('expanded');
    if (!editingId && cancelBtn) {
        cancelBtn.innerText = 'Thu gọn';
        cancelBtn.style.display = 'inline-block';
    }
}

function collapseWriteCard() {
    if (typeof currentAttachedImage !== 'undefined' && currentAttachedImage) return; // Không tự động thu gọn nếu đang có ảnh đính kèm
    const card = document.querySelector('.write-card');
    const input = document.getElementById('diaryInput');
    const cancelBtn = document.getElementById('cancelBtn');
    if (card) card.classList.remove('expanded');
    if (input) {
        input.classList.remove('expanded');
        input.blur();
    }
    if (!editingId && cancelBtn) {
        cancelBtn.style.display = 'none';
    }
}

function handleCancelClick() {
    if (editingId) {
        clearEditMode();
    } else {
        if (typeof removeAttachedImage === 'function') removeAttachedImage();
        collapseWriteCard();
    }
}

async function initApp() {
    await loadDiaries();
}

function renderList(diaries) {
    const container = document.getElementById('diaryContainer');
    if (!container) return;
    container.innerHTML = '';
    const toggleWrapper = document.getElementById('pinToggleWrapper');
    const pinLabel = document.getElementById('pinLabelText');
    if (toggleWrapper) {
        toggleWrapper.classList.toggle('toggle-active', showPinnedOnly);
        if (pinLabel) pinLabel.innerText = showPinnedOnly ? "Ghim" : "Tất cả";
    }
    let displayData = diaries || [];
    if (showPinnedOnly) {
        displayData = displayData.filter(d => d.pinned);
    }
    displayData.forEach((item) => container.appendChild(createItemEl(item)));
    getLessonTotalScore();
    if (typeof currentTopTab !== 'undefined' && currentTopTab === 0 && selectedDiaryId) {
        const el = document.getElementById(`item-${selectedDiaryId}`);
        if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
}

function createItemEl(item) {
    const isGen = !!(item.paragraph || item.conversation);
    const div = document.createElement('div');
    div.className = `diary-item ${item.id == selectedDiaryId ? 'selected' : ''} ${item.pinned ? 'pinned' : ''}`;
    div.id = `item-${item.id}`;
    div.onclick = (e) => {
        if (!e.target.closest('.item-action-btn') && !e.target.closest('.count-trigger') && !e.target.closest('.diary-image-wrapper') && !e.target.closest('.diary-gallery-container')) {
            selectRecord(item.id);
        }
    };
    const imageHtml = typeof renderDiaryImagesHtml === 'function' ? renderDiaryImagesHtml(item.image) : '';
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div class="diary-date" style="margin-bottom:0;">
                ${item.date} - ${item.id}
                <span class="count-trigger" 
                      onclick="event.stopPropagation(); handleRecordBadgeClick('${item.id}')" 
                      style="margin-left:8px; color:white; background:${item.voiceCount > 0 ? '#e67e22' : '#ccc'}; padding:2px 8px; border-radius:10px; font-size:0.7rem; cursor:pointer; font-weight:bold; display:inline-block;">
                    🎙️ ${item.voiceCount || 0}
                </span>
            </div>
            <div style="display:flex; gap:10px;">
                <div class="item-action-btn edit-btn" onclick="event.stopPropagation(); startEdit('${item.id}', \`${item.text.replace(/`/g, '\\`')}\`)">✏️ Sửa</div>
                <div class="item-action-btn delete-btn" onclick="event.stopPropagation(); deleteDiary('${item.id}')">🗑️ Xóa</div>
            </div>
        </div>
        <div class="diary-content">${item.text}</div>
        ${imageHtml}
        <div class="item-actions">
            <div class="item-action-btn pin-btn" onclick="event.stopPropagation(); togglePin('${item.id}')">${item.pinned ? '📍 Bỏ' : '📌 Ghim'}</div>
            <div class="item-action-btn ${item.paragraph ? '' : 'disabled'}" style="color:var(--primary-color); font-size:0.75rem;" onclick="event.stopPropagation(); selectRecord('${item.id}'); switchTab(1)">📖 Trình độ N3</div>
            <div class="item-action-btn ${item.conversation ? '' : 'disabled'}" style="color:#e67e22; font-size:0.75rem;" onclick="event.stopPropagation(); selectRecord('${item.id}'); switchTab(2)">💬 Trình độ N2</div>
            <div class="item-action-btn ai-btn ${isGen ? 'generated' : ''}" style="font-size:0.75rem;" onclick="event.stopPropagation(); askAI('${item.id}', \`${item.text.replace(/`/g, '\\`')}\`)">${isGen ? '✅ AI' : '✨ AI'}</div>
        </div>
    `;
    return div;
}

function startEdit(id, text) {
    editingId = id;
    const diaryInput = document.getElementById('diaryInput');
    if (diaryInput) diaryInput.value = text;
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.innerHTML = '💾';
        saveBtn.title = 'Cập nhật';
    }
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.innerHTML = '✕';
        cancelBtn.title = 'Hủy';
        cancelBtn.style.display = 'inline-flex';
    }
    const item = currentDiaries.find(d => String(d.id) === String(id));
    if (item && item.image) {
        if (typeof setAttachedImage === 'function') setAttachedImage(item.image);
    } else {
        if (typeof removeAttachedImage === 'function') removeAttachedImage();
    }
    expandWriteCard();
    if (diaryInput) diaryInput.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function togglePinFilter() {
    showPinnedOnly = !showPinnedOnly;
    localStorage.setItem("diary_show_pinned_only", showPinnedOnly);
    renderList(currentDiaries);
}

function selectRecord(id, scroll = true) {
    if (selectedDiaryId !== id && typeof currentPlayingTarget !== 'undefined' && currentPlayingTarget) {
        if (window.stopSpeak) window.stopSpeak();
        currentPlayingTarget = null;
    }
    selectedDiaryId = id; 
    localStorage.setItem("diary_selected_id", id);
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('id', id);
    window.history.replaceState({}, '', newUrl); 
    document.querySelectorAll('.diary-item').forEach(el => el.classList.remove('selected'));
    const el = document.getElementById(`item-${id}`);
    if (el) {
        el.classList.add('selected');
        if (scroll) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
    if (typeof updateAIView === 'function') updateAIView();
    if (typeof applyImmediateHighlight === 'function') applyImmediateHighlight();
}

function clearEditMode() { 
    editingId = null; 
    const input = document.getElementById('diaryInput');
    if (input) input.value = ''; 
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.innerHTML = '💾';
        saveBtn.title = 'Lưu lại';
    }
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.innerHTML = '✕';
        cancelBtn.title = 'Hủy';
        cancelBtn.style.display = 'none';
    }
    if (typeof removeAttachedImage === 'function') removeAttachedImage();
    collapseWriteCard();
}

async function resetAppData() {
    if (confirm("Bạn có chắc chắn muốn reset toàn bộ dữ liệu nhật ký không?")) {
        try {
            await deleteFromDB(STORE_NAME, SHEET_DIARY);
            window.location.reload();
        } catch (error) {
            console.error("Lỗi khi xóa IndexedDB:", error);
            alert("Không thể xóa dữ liệu IndexedDB.");
        }
    }
}

// Khởi tạo các sự kiện giao diện cho thẻ soạn thảo
function initDiaryEvents() {
    const diaryInput = document.getElementById('diaryInput');
    if (diaryInput) {
        diaryInput.addEventListener('focus', expandWriteCard);
        diaryInput.addEventListener('click', expandWriteCard);
    }

    // Tự động thu gọn khi click ra ngoài thẻ nhập liệu nếu ô trống, không có ảnh và không trong chế độ sửa
    document.addEventListener('click', (e) => {
        const card = document.querySelector('.write-card');
        const camModal = document.getElementById('cameraModal');
        const lbModal = document.getElementById('imageLightboxModal');
        if (camModal && camModal.classList.contains('active')) return;
        if (lbModal && lbModal.classList.contains('active')) return;
        if (card && !card.contains(e.target)) {
            const hasImg = typeof currentAttachedImage !== 'undefined' && !!currentAttachedImage;
            if (!editingId && !hasImg && diaryInput && (!diaryInput.value || diaryInput.value.trim() === '')) {
                collapseWriteCard();
            }
        }
    });

    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (typeof isUploadingImage !== 'undefined' && isUploadingImage) {
                const origHtml = saveBtn.innerHTML;
                saveBtn.innerHTML = '⏳';
                saveBtn.disabled = true;
                if (typeof waitForImageUpload === 'function') {
                    await waitForImageUpload();
                }
                saveBtn.disabled = false;
                saveBtn.innerHTML = origHtml;
            }
            if (editingId) {
                await updateDiary();
            } else {
                await saveDiary();
            }
            collapseWriteCard();
        });
    }

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', handleCancelClick);
    }
}

// Khởi tạo ứng dụng khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    console.log("[Nikki App] Khởi tạo hệ thống...");

    // 1. Khởi tạo nạp từ vựng Mazii từ IndexedDB để tô màu chữ tức thì
    if (typeof initWordHighlightFromDB === 'function') {
        initWordHighlightFromDB();
    }

    // 2. Khởi tạo tải danh sách nhật ký từ máy chủ / IndexedDB
    initApp();

    // 3. Khởi tạo cài đặt giọng đọc TTS & thiết lập tab ban đầu
    if (typeof loadTTSSettings === 'function') {
        loadTTSSettings();
    }

    // 4. Khởi tạo tính năng kéo thả, paste ảnh & cử chỉ vuốt Lightbox
    if (typeof initImageDropAndPaste === 'function') {
        initImageDropAndPaste();
    }

    // 5. Khởi tạo các sự kiện cho thẻ soạn thảo nhật ký
    initDiaryEvents();
});
