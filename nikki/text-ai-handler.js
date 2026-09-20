// =============================================================================
// QUẢN LÝ HIỂN THỊ & TƯƠNG TÁC NỘI DUNG AI (TRÌNH ĐỘ N3, N2, BẢN DỊCH VIỆT)
// =============================================================================

var urlParams = new URLSearchParams(window.location.search);
var urlTab = urlParams.get('tab');
var currentTopTab = 0; // 0 = Nhật ký, 1 = Nghĩa VN / AI
var currentAISubTab = localStorage.getItem("diary_sub_tab") || 'paragraph'; // 'paragraph' | 'conversation'
var showViTrans = false;

function switchTab(index) {
    if (typeof editingId !== 'undefined' && !editingId) {
        const diaryInput = document.getElementById('diaryInput');
        if (!diaryInput || !diaryInput.value || !diaryInput.value.trim()) {
            if (typeof collapseWriteCard === 'function') collapseWriteCard();
        }
    }

    if (index === 0) {
        currentTopTab = 0;
    } else if (index === 1) {
        currentTopTab = 1;
        currentAISubTab = 'paragraph';
    } else if (index === 2) {
        currentTopTab = 1;
        currentAISubTab = 'conversation';
    }

    localStorage.setItem("diary_top_tab", currentTopTab);
    localStorage.setItem("diary_sub_tab", currentAISubTab);

    // Đồng bộ tham số URL: tab=1 (Nhật ký), tab=2 (Đoạn văn), tab=3 (Hội thoại)
    const urlTabVal = currentTopTab === 0 ? 1 : (currentAISubTab === 'paragraph' ? 2 : 3);
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('tab', urlTabVal);
    window.history.replaceState({}, '', newUrl);

    // Cập nhật trạng thái 2 tab phía trên
    const btn0 = document.getElementById('tab-btn-0');
    const btn1 = document.getElementById('tab-btn-1');
    const tabDiary = document.getElementById('tab-diary');
    const tabMeaning = document.getElementById('tab-meaning');

    if (btn0) btn0.classList.toggle('active', currentTopTab === 0);
    if (btn1) btn1.classList.toggle('active', currentTopTab === 1);
    if (tabDiary) tabDiary.classList.toggle('active', currentTopTab === 0);
    if (tabMeaning) tabMeaning.classList.toggle('active', currentTopTab === 1);

    updateAIView();
    if (typeof applyImmediateHighlight === 'function') applyImmediateHighlight();

    if (currentTopTab === 0 && typeof selectedDiaryId !== 'undefined' && selectedDiaryId) {
        const el = document.getElementById(`item-${selectedDiaryId}`);
        if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
}

function switchAISubTab(subTab) {
    currentAISubTab = subTab;
    localStorage.setItem("diary_sub_tab", subTab);
    
    if (currentTopTab !== 1) {
        currentTopTab = 1;
        document.getElementById('tab-btn-0')?.classList.remove('active');
        document.getElementById('tab-btn-1')?.classList.add('active');
        document.getElementById('tab-diary')?.classList.remove('active');
        document.getElementById('tab-meaning')?.classList.add('active');
    }

    const urlTabVal = (currentAISubTab === 'paragraph') ? 2 : 3;
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('tab', urlTabVal);
    window.history.replaceState({}, '', newUrl);

    updateAIView();
    if (typeof applyImmediateHighlight === 'function') applyImmediateHighlight();
}

function toggleAISubTab() {
    const nextTab = (currentAISubTab === 'paragraph') ? 'conversation' : 'paragraph';
    switchAISubTab(nextTab);
}

function toggleViTrans() {
    showViTrans = !showViTrans;
    updateAIView();
}

function updateAIView() {
    const container = document.getElementById('aiMeaningContainer');
    if (!container) return;

    const list = (typeof currentDiaries !== 'undefined' && Array.isArray(currentDiaries)) ? currentDiaries : [];
    const item = list.find(d => typeof selectedDiaryId !== 'undefined' && d.id == selectedDiaryId);
    if (!item) {
        container.innerHTML = '<p class="loading-text">Vui lòng chọn một bài nhật ký từ danh sách.</p>';
        const btnSpeak = document.getElementById('btnMainSpeak');
        if (btnSpeak) btnSpeak.disabled = true;
        return;
    }

    const pContent = (item.paragraph || '').trim();
    const cContent = (item.conversation || '').trim();
    const pTrans = (item.paragraph_trans || '').trim();
    const cTrans = (item.conversation_trans || '').trim();

    const hasP = !!(pContent || pTrans);
    const hasC = !!(cContent || cTrans);

    const highlightedP = pContent && typeof formatJapaneseHighlight === 'function' ? formatJapaneseHighlight(pContent) : pContent;
    const highlightedC = cContent && typeof formatJapaneseHighlight === 'function' ? formatJapaneseHighlight(cContent) : cContent;

    if (currentAISubTab === 'paragraph' && !hasP && hasC) {
        currentAISubTab = 'conversation';
    } else if (currentAISubTab === 'conversation' && !hasC && hasP) {
        currentAISubTab = 'paragraph';
    }

    const isParagraph = (currentAISubTab === 'paragraph');
    const isN3Playing = (typeof currentPlayingTarget !== 'undefined' && currentPlayingTarget === 'paragraph');
    const isN2Playing = (typeof currentPlayingTarget !== 'undefined' && currentPlayingTarget === 'conversation');
    const isPViPlaying = (typeof currentPlayingTarget !== 'undefined' && currentPlayingTarget === 'p-vi-view');
    const isCViPlaying = (typeof currentPlayingTarget !== 'undefined' && currentPlayingTarget === 'c-vi-view');

    let bodyHTML = '';
    if (isParagraph) {
        if (hasP) {
            bodyHTML = `
                <div class="ai-header-bar">
                    <span class="ai-type-badge p-badge">📖 Trình độ N3</span>
                    <button class="btn-speak-inline ${isN3Playing ? 'playing' : ''}" id="btn-speak-p" onclick="handleInlineSpeak('p-content', 'btn-speak-p')">
                        ${isN3Playing ? '⏹ Dừng' : '🔊 Đọc tiếng Nhật'}
                    </button>
                </div>
                <div id="p-content" class="ai-ja-section">${highlightedP || '(Chưa có văn bản tiếng Nhật)'}</div>
                <div class="ai-vi-section">
                    <div class="vi-header" onclick="toggleViTrans()">
                        <div class="vi-title">
                            <span>🇻🇳</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px;">
                            ${showViTrans ? `
                                <button class="btn-speak-inline ${isPViPlaying ? 'playing' : ''}" id="btn-speak-p-vi" onclick="event.stopPropagation(); handleInlineSpeak('p-vi-view', 'btn-speak-p-vi')">
                                    ${isPViPlaying ? '⏹ Dừng' : '🔊 Đọc dịch'}
                                </button>
                            ` : ''}
                            <button class="vi-toggle-btn" type="button">
                                ${showViTrans ? 'Ẩn nghĩa ▲' : '👁️ Xem nghĩa ▼'}
                            </button>
                        </div>
                    </div>
                    ${showViTrans ? `
                        <div class="vi-body">
                            <div id="p-vi-view" class="vi-content">${pTrans || 'Chưa có bản dịch tiếng Việt.'}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            bodyHTML = `
                <div class="ai-header-bar">
                    <span class="ai-type-badge p-badge">📖 Trình độ N3</span>
                </div>
                <p class="loading-text" style="padding: 20px 0;">Chưa có dữ liệu Trình độ N3.<br><button class="btn-save" style="margin-top: 8px;" onclick="askAI('${item.id}', \`${item.text.replace(/`/g, '\\`')}\`)">✨ Tạo bằng AI</button></p>
            `;
        }
    } else {
        if (hasC) {
            bodyHTML = `
                <div class="ai-header-bar">
                    <span class="ai-type-badge c-badge">💬 Trình độ N2</span>
                    <button class="btn-speak-inline ${isN2Playing ? 'playing' : ''}" id="btn-speak-c" onclick="handleInlineSpeak('c-content', 'btn-speak-c')">
                        ${isN2Playing ? '⏹ Dừng' : '🔊 Đọc tiếng Nhật'}
                    </button>
                </div>
                <div id="c-content" class="ai-ja-section">${highlightedC || '(Chưa có văn bản tiếng Nhật)'}</div>
                <div class="ai-vi-section c-trans">
                    <div class="vi-header" onclick="toggleViTrans()">
                        <div class="vi-title">
                            <span>🇻🇳</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px;">
                            ${showViTrans ? `
                                <button class="btn-speak-inline ${isCViPlaying ? 'playing' : ''}" id="btn-speak-c-vi" onclick="event.stopPropagation(); handleInlineSpeak('c-vi-view', 'btn-speak-c-vi')">
                                    ${isCViPlaying ? '⏹ Dừng' : '🔊 Đọc dịch'}
                                </button>
                            ` : ''}
                            <button class="vi-toggle-btn" type="button">
                                ${showViTrans ? 'Ẩn nghĩa ▲' : '👁️ Xem nghĩa ▼'}
                            </button>
                        </div>
                    </div>
                    ${showViTrans ? `
                        <div class="vi-body">
                            <div id="c-vi-view" class="vi-content">${cTrans || 'Chưa có bản dịch tiếng Việt.'}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            bodyHTML = `
                <div class="ai-header-bar">
                    <span class="ai-type-badge c-badge">💬 Trình độ N2</span>
                </div>
                <p class="loading-text" style="padding: 20px 0;">Chưa có dữ liệu Trình độ N2.<br><button class="btn-save" style="margin-top: 8px;" onclick="askAI('${item.id}', \`${item.text.replace(/`/g, '\\`')}\`)">✨ Tạo bằng AI</button></p>
            `;
        }
    }

    container.innerHTML = `
        <div class="ai-box-container">
            <!-- Thanh chuyển hiển thị bên trái là 1 khối duy nhất: click để chuyển đổi giữa Trình độ N3 và Trình độ N2 -->
            <div class="ai-left-bar ${isParagraph ? 'paragraph-bar' : 'conversation-bar'}" 
                 onclick="event.stopPropagation(); toggleAISubTab()" 
                 title="Nhấn vào thanh này để chuyển đổi giữa Trình độ N3 và Trình độ N2">
                <span class="left-bar-icon">${isParagraph ? '📖' : '💬'}</span>
                <span class="left-bar-text">${isParagraph ? 'TRÌNH ĐỘ N3' : 'TRÌNH ĐỘ N2'}</span>
                <span class="left-bar-switch-hint">⇄</span>
            </div>
            <!-- Khung nội dung bên phải -->
            <div class="ai-content-body">
                ${bodyHTML}
            </div>
        </div>
    `;

    const btnSpeak = document.getElementById('btnMainSpeak');
    if (btnSpeak) {
        if (currentTopTab === 1) {
            btnSpeak.disabled = isParagraph ? !hasP : !hasC;
            const isCurrentTabPlaying = (currentAISubTab === currentPlayingTarget);
            btnSpeak.classList.toggle('playing', isCurrentTabPlaying);
            btnSpeak.innerHTML = isCurrentTabPlaying ? '⏹' : '🔊';
            btnSpeak.title = isCurrentTabPlaying ? 'Dừng đọc' : 'Đọc';
        } else {
            btnSpeak.disabled = true;
            btnSpeak.title = 'Đọc';
        }
    }

    if (typeof applyImmediateHighlight === 'function') applyImmediateHighlight();
}
