/**
 * Voice Recorder Module - Fixed Icon-Only & PageInfo ID
 */
const VoiceRecorder = (() => {
    const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
    let mediaRecorder;
    let audioChunks = [];
    let isListLoaded = false;

    // Lấy ID từ thẻ <span id="pageInfo">9 / 11</span> -> "9_11"
    const getContextId = () => {
        const pageInfoEl = document.getElementById('pageInfo');
        if (pageInfoEl) {
            return pageInfoEl.innerText.replace(/\s+/g, '').replace(/\//g, '_');
        }
        return "default_page";
    };

    const style = document.createElement('style');
    style.textContent = `
        .vr-top-bar { position: fixed; top: 0; left: 0; width: 100%; height: 50px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; gap: 15px; z-index: 9999; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .vr-btn-icon { width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid #cbd5e1; cursor: pointer; font-size: 18px; background: #fff; transition: all 0.2s; position: relative; }
        .vr-btn-icon:disabled { opacity: 0.4; cursor: not-allowed; }
        .vr-btn-rec.active { background: #fee2e2; border-color: #dc2626; color: #dc2626; animation: vr-pulse 1.5s infinite; }
        .vr-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 10px; padding: 2px 5px; border-radius: 10px; border: 2px solid #fff; font-weight: bold; }
        .vr-status-text { font-size: 11px; color: #ef4444; font-weight: bold; min-width: 60px; text-align: center; }
        .vr-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: none; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(2px); }
        .vr-overlay.show { display: flex; }
        .vr-modal { background: white; width: 95%; max-width: 400px; border-radius: 16px; padding: 20px; position: relative; max-height: 80vh; display: flex; flex-direction: column; }
        .vr-list-container { flex: 1; overflow-y: auto; margin-top: 15px; display: flex; flex-direction: column; gap: 10px; }
        .vr-item { position: relative; border: 1px solid #f1f5f9; border-radius: 8px; padding: 4px; background: #f8fafc; }
        .vr-item iframe { width: 100%; height: 60px; border: none; display: block; }
        .vr-del { position: absolute; top: 5px; right: 5px; color: #cbd5e1; border: none; background: none; cursor: pointer; font-size: 16px; z-index: 10; }
        @keyframes vr-pulse { 0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); } 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); } }
        body { padding-top: 55px !important; }
    `;
    document.head.appendChild(style);

    const injectUI = () => {
        const topBar = document.createElement('div');
        topBar.className = 'vr-top-bar';
        topBar.innerHTML = `
            <button id="vr-start" class="vr-btn-icon" title="Ghi âm">🎤</button>
            <button id="vr-stop" class="vr-btn-icon" disabled title="Dừng">⏹</button>
            <span id="vr-status" class="vr-status-text"></span>
            <button id="vr-open-history" class="vr-btn-icon" title="Lịch sử">
                📂<span id="vr-count" class="vr-badge">0</span>
            </button>
        `;
        document.body.appendChild(topBar);

        const overlay = document.createElement('div');
        overlay.id = 'vr-overlay';
        overlay.className = 'vr-overlay';
        overlay.innerHTML = `
            <div class="vr-modal">
                <button style="position:absolute; top:15px; right:15px; border:none; background:none; font-size:20px; cursor:pointer; color:#94a3b8;" onclick="VoiceRecorder.toggleHistory()">✕</button>
                <div style="font-weight:bold; font-size:16px">Bản ghi trang: <span id="vr-page-id"></span></div>
                <div id="vr-list" class="vr-list-container">Đang tải...</div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('vr-start').onclick = startRec;
        document.getElementById('vr-stop').onclick = stopRec;
        document.getElementById('vr-open-history').onclick = toggleHistory;
        loadList(true);
    };

    function toggleHistory() {
        const overlay = document.getElementById('vr-overlay');
        overlay.classList.toggle('show');
        if (overlay.classList.contains('show')) {
            document.getElementById('vr-page-id').innerText = getContextId();
            loadList();
        }
    }

    async function startRec() {
        try {
            audioChunks = [];
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = uploadFile;
            mediaRecorder.start();
            document.getElementById('vr-start').classList.add('active');
            document.getElementById('vr-start').disabled = true;
            document.getElementById('vr-stop').disabled = false;
            document.getElementById('vr-status').innerText = "REC ●";
        } catch (e) { alert("Lỗi Micro!"); }
    }

    function stopRec() {
        if (mediaRecorder) mediaRecorder.stop();
        document.getElementById('vr-start').classList.remove('active');
        document.getElementById('vr-start').disabled = false;
        document.getElementById('vr-stop').disabled = true;
        document.getElementById('vr-status').innerText = "SAVING...";
    }

    function uploadFile() {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        const pageId = getContextId();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            // Lưu log đầy đủ theo yêu cầu
            console.log(`[Log] Đang tải lên bản ghi cho trang: ${pageId}`);
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "uploadVoice", base64, fileName: `PAGE_${pageId}_${Date.now()}.webm`, lessonId: pageId })
            });
            document.getElementById('vr-status').innerText = "DONE!";
            setTimeout(() => { document.getElementById('vr-status').innerText = ""; loadList(true); }, 1000);
        };
    }

    async function loadList(silent = false) {
        const container = document.getElementById('vr-list');
        const countBadge = document.getElementById('vr-count');
        const pageId = getContextId();
        try {
            const res = await fetch(`${GAS_URL}?type=listVoice&lessonId=${pageId}&_t=${Date.now()}`);
            const data = await res.json();
            countBadge.innerText = data.length;
            if (!silent) {
                container.innerHTML = data.map(f => `
                    <div class="vr-item" id="vr-${f.id}">
                        <button class="vr-del" onclick="VoiceRecorder.delete('${f.id}')">✕</button>
                        <iframe src="https://drive.google.com/file/d/${f.id}/preview"></iframe>
                    </div>
                `).join('') || '<div style="text-align:center; color:gray; font-size:13px;">Trống</div>';
            }
        } catch (e) { if(!silent) container.innerHTML = "Lỗi tải dữ liệu."; }
    }

    // Export ra object window để có thể gọi từ bên ngoài (onclick trong HTML)
    window.VoiceRecorder = {
        toggleHistory: toggleHistory,
        delete: async (id) => {
            if (!confirm("Xóa bản ghi này?")) return;
            const el = document.getElementById(`vr-${id}`);
            if (el) el.style.opacity = "0.3";
            await fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "deleteVoice", fileId: id }) });
            setTimeout(() => loadList(true), 500);
        }
    };

    if (document.readyState === 'complete') injectUI();
    else window.addEventListener('load', injectUI);

    return { toggle: toggleHistory };
})();