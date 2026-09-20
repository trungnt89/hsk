// =============================================================================
// QUẢN LÝ PHÁT ÂM (TTS) & MODAL GHI ÂM (RECORDER)
// =============================================================================

var currentPlayingTarget = null; // 'paragraph' | 'conversation' | 'p-vi-view' | 'c-vi-view' | null
var isRepeating = localStorage.getItem("diary_repeat") === "true";

function getTargetFromElId(elId) {
    if (elId === 'p-content') return 'paragraph';
    if (elId === 'c-content') return 'conversation';
    if (elId === 'p-vi-view') return 'p-vi-view';
    if (elId === 'c-vi-view') return 'c-vi-view';
    return elId;
}

function loadTTSSettings() {
    const v = localStorage.getItem("diary_voice");
    const r = localStorage.getItem("diary_rate");
    const voiceSelect = document.getElementById("voiceSelect");
    const rateSelect = document.getElementById("rateSelect");
    const btnRepeat = document.getElementById("btnRepeat");

    if (v && voiceSelect) voiceSelect.value = v;
    if (r && rateSelect) rateSelect.value = r;
    if (btnRepeat) btnRepeat.classList.toggle("active", isRepeating);
    
    // Xử lý mở tab ban đầu
    const urlParams = new URLSearchParams(window.location.search);
    const urlTab = urlParams.get('tab');
    if (typeof switchTab === 'function') {
        if (urlTab === '1') {
            switchTab(0);
        } else if (urlTab === '2') {
            switchTab(1);
        } else if (urlTab === '3') {
            switchTab(2);
        } else {
            const savedTop = parseInt(localStorage.getItem("diary_top_tab")) || 0;
            const savedSub = localStorage.getItem("diary_sub_tab") || 'paragraph';
            if (savedTop === 1) {
                switchTab(savedSub === 'conversation' ? 2 : 1);
            } else {
                switchTab(0);
            }
        }
    }
}

function saveTTSSettings() {
    const voiceSelect = document.getElementById("voiceSelect");
    const rateSelect = document.getElementById("rateSelect");
    if (voiceSelect) localStorage.setItem("diary_voice", voiceSelect.value);
    if (rateSelect) localStorage.setItem("diary_rate", rateSelect.value);
    localStorage.setItem("diary_repeat", isRepeating);
}

function toggleRepeat() { 
    isRepeating = !isRepeating; 
    const btnRepeat = document.getElementById("btnRepeat");
    if (btnRepeat) btnRepeat.classList.toggle("active", isRepeating); 
    saveTTSSettings(); 
    const btnMainSpeak = document.getElementById('btnMainSpeak');
    if (btnMainSpeak && btnMainSpeak.classList.contains("playing")) {
        handleGlobalSpeak();
        handleGlobalSpeak(); 
    }
}

function handleInlineSpeak(elId, btnId) {
    const target = getTargetFromElId(elId);
    if (currentPlayingTarget === target) {
        if (window.stopSpeak) window.stopSpeak();
        currentPlayingTarget = null;
        resetSpeakBtns();
        return;
    }
    if (window.stopSpeak) window.stopSpeak();
    currentPlayingTarget = target;
    speakText(elId, btnId, target);
}

async function speakText(elId, btnId, target) {
    const el = document.getElementById(elId);
    if (!el || !window.speakCommon) return;

    const textToSpeak = (el.innerText || '').trim();
    if (!textToSpeak) {
        console.warn("[TTS] Không có nội dung văn bản để đọc.");
        currentPlayingTarget = null;
        resetSpeakBtns();
        return;
    }

    currentPlayingTarget = target || getTargetFromElId(elId);
    resetSpeakBtns();

    // Xác định giọng đọc dựa theo tùy chọn và ngôn ngữ của khối văn bản
    let voiceValue = document.getElementById("voiceSelect")?.value || 'ja-JP-KeitaNeural';
    const isVietnameseView = (elId === 'p-vi-view' || elId === 'c-vi-view');

    if (isVietnameseView) {
        // Tự động chuyển sang giọng Tiếng Việt tương ứng theo giới tính (Nam/Nữ)
        const isMale = voiceValue.includes('Keita') || voiceValue.includes('Nam');
        voiceValue = isMale ? 'vi-VN-NamMinhNeural' : 'vi-VN-HoaiMyNeural';
    }

    const rateValue = document.getElementById("rateSelect")?.value || "0.70";
    const diaryId = typeof selectedDiaryId !== 'undefined' ? selectedDiaryId : 'default';

    try {
        await window.speakCommon({
            text: textToSpeak,
            voice: voiceValue,
            rate: rateValue,
            filename: `Diary_AI_${diaryId}`,
            loop: isRepeating
        });
    } catch (error) {
        console.error("[TTS Error]", error);
    } finally {
        if (!isRepeating) {
            currentPlayingTarget = null;
            resetSpeakBtns();
        }
    }
}

function handleGlobalSpeak() {
    const currentSub = typeof currentAISubTab !== 'undefined' ? currentAISubTab : 'paragraph';
    const currentTarget = (currentSub === 'paragraph') ? 'paragraph' : 'conversation';
    const elId = (currentSub === 'paragraph') ? 'p-content' : 'c-content';
    const btnId = (currentSub === 'paragraph') ? 'btn-speak-p' : 'btn-speak-c';

    if (currentPlayingTarget === currentTarget) {
        if (window.stopSpeak) window.stopSpeak();
        currentPlayingTarget = null;
        resetSpeakBtns();
        return;
    }

    if (window.stopSpeak) window.stopSpeak();
    currentPlayingTarget = currentTarget;
    speakText(elId, 'btnMainSpeak', currentTarget);
}

function resetSpeakBtns() { 
    const isN3Playing = (currentPlayingTarget === 'paragraph');
    const isN2Playing = (currentPlayingTarget === 'conversation');
    const isPViPlaying = (currentPlayingTarget === 'p-vi-view');
    const isCViPlaying = (currentPlayingTarget === 'c-vi-view');

    // Nút đọc N3
    const btnP = document.getElementById('btn-speak-p');
    if (btnP) {
        btnP.classList.toggle('playing', isN3Playing);
        btnP.innerHTML = isN3Playing ? '⏹ Dừng' : '🔊 Đọc tiếng Nhật';
    }

    // Nút đọc N2
    const btnC = document.getElementById('btn-speak-c');
    if (btnC) {
        btnC.classList.toggle('playing', isN2Playing);
        btnC.innerHTML = isN2Playing ? '⏹ Dừng' : '🔊 Đọc tiếng Nhật';
    }

    // Nút dịch N3
    const btnPVi = document.getElementById('btn-speak-p-vi');
    if (btnPVi) {
        btnPVi.classList.toggle('playing', isPViPlaying);
        btnPVi.innerHTML = isPViPlaying ? '⏹ Dừng' : '🔊 Đọc dịch';
    }

    // Nút dịch N2
    const btnCVi = document.getElementById('btn-speak-c-vi');
    if (btnCVi) {
        btnCVi.classList.toggle('playing', isCViPlaying);
        btnCVi.innerHTML = isCViPlaying ? '⏹ Dừng' : '🔊 Đọc dịch';
    }

    // Nút Đọc tổng phía trên (Main Speak)
    const btnMain = document.getElementById('btnMainSpeak');
    if (btnMain) {
        const topTab = typeof currentTopTab !== 'undefined' ? currentTopTab : 0;
        const subTab = typeof currentAISubTab !== 'undefined' ? currentAISubTab : 'paragraph';
        const isCurrentVisiblePlaying = (topTab === 1 && subTab === currentPlayingTarget);
        btnMain.classList.toggle('playing', isCurrentVisiblePlaying);
        btnMain.innerHTML = isCurrentVisiblePlaying ? '⏹' : '🔊';
        btnMain.title = isCurrentVisiblePlaying ? 'Dừng đọc' : 'Đọc';
    }
}

// =============================================================================
// MODAL GHI ÂM (AUDIO RECORDER IFRAME)
// =============================================================================

function handleRecordBadgeClick(id) {
    if (typeof selectRecord === 'function') selectRecord(id);
    const modal = document.getElementById('audioModal');
    const frame = document.getElementById('audioFrame');
    if (frame) frame.src = `./recorder.html?lessionId=${id}&tab=1`;
    if (modal) modal.style.display = 'block';
}

function closeAudioModal() {
    const frame = document.getElementById('audioFrame');
    const modal = document.getElementById('audioModal');
    if (frame) frame.src = "";
    if (modal) modal.style.display = 'none';
}

function backAudioModal() {
    const iframe = document.getElementById('audioFrame');
    if (iframe && iframe.contentWindow) iframe.contentWindow.history.back();
}

function reloadAudioModal() {
    const iframe = document.getElementById('audioFrame');
    if (iframe && iframe.src) iframe.src = iframe.src;
}
