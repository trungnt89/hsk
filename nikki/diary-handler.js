// =============================================================================
// QUẢN LÝ DANH SÁCH & SOẠN THẢO NHẬT KÝ (DIARY HANDLER)
// =============================================================================

var currentDiaries = [];
var editingId = null;

var diaryUrlParams = new URLSearchParams(window.location.search);
var diaryUrlId = diaryUrlParams.get('id');
var selectedDiaryId = diaryUrlId || localStorage.getItem("diary_selected_id") || null;
if (diaryUrlId && diaryUrlId !== localStorage.getItem("diary_selected_id")) {
    localStorage.setItem("diary_selected_id", diaryUrlId);
}

var showPinnedOnly = localStorage.getItem("diary_show_pinned_only") === "true";

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
    if (typeof loadDiaries === 'function') {
        loadDiaries();
    }
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
    if (typeof getLessonTotalScore === 'function') {
        getLessonTotalScore();
    }
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

// Khởi tạo các sự kiện giao diện cho Nhật ký
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
                if (typeof updateDiary === 'function') await updateDiary();
            } else {
                if (typeof saveDiary === 'function') await saveDiary();
            }
            collapseWriteCard();
        });
    }

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', handleCancelClick);
    }
}
