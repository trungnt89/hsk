/**
 * Voice Recorder Module - Icon-Only, Sticky Top & PageInfo ID
 */
const VoiceRecorder = (() => {
    const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
    let mediaRecorder;
    let audioChunks = [];
    let isListLoaded = false;

    /**
     * Lấy ID dựa trên thẻ <span id="pageInfo"> (Ví dụ: "9 / 11" -> "9_11")
     */
    const getContextId = () => {
        const pageInfoEl = document.getElementById('pageInfo');
        if (pageInfoEl) {
            return pageInfoEl.innerText.replace(/\s+/g, '').replace(/\//g, '_');
        }
        return "default_page";
    };

    // 1. CSS Giao diện
    const style = document.createElement('style');
    style.textContent = `
        /* Thanh điều khiển Sticky Top */
        .vr-top-bar { 
            position: fixed; top: 0; left: 0; width: 100%; height: 50px; 
            background: #fff; border-bottom: 1px solid #e2e8f0; 
            display: flex; align-items: center; justify-content: center; 
            gap: 12px; z-index: 9999; box-shadow: 0 2px 4px rgba(0,0,0,0.05); 
        }
        
        /* Style nút bấm dạng Icon */
        .vr-btn-icon { 
            width: 36px; height: 36px; display: flex; align-items: center; 
            justify-content: center; border-radius: 8px; border: 1px solid #e2e8f0; 
            background: #fff; cursor: pointer; font-size: 18px; transition: all 0.2s;
            position: relative; color: #475569; padding: 0;
        }
        
        .vr-btn-icon:disabled { opacity: 0.3; cursor: not-allowed; }
        .vr-btn-icon:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }

        /* Trạng thái Active/Selected */
        .vr-btn-icon.selected { 
            background: #eff6ff; border-color: #3b82f6; color: #3b82f6; 
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
        }

        /* Nút Ghi âm khi đang chạy */
        .vr-btn-rec.recording { 
            background: #fee2e2; border-color: #ef4444; color: #ef4444; 
            animation: vr-pulse 1.5s infinite; 
        }

        .vr-badge { 
            position: absolute; top: -5px; right: -5px; background: #1e293b; 
            color: #fff; font-size: 9px; padding: 1px 4px; border-radius: 10px; border: 1px solid #fff;
        }

        .vr-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; margin-left: 5px; }
        .vr-status-dot.recording { background: #ef4444; }

        /* Popup Lịch sử */
        .vr-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: none; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(2px); }
        .vr-overlay.show { display: flex; }
        .vr-modal { background: white; width: 95%; max-width: 420px; border-radius: 16px; padding: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); position: relative; max-height: 80vh; display: flex; flex-direction: column; }
        
        .vr-list-container { flex: 1; overflow-y: auto; margin-top: 15px; display: flex; flex-direction: column; gap: 10px; }
        .vr-item { position: relative; border: 1px solid #f1f5f9; border-radius: 8px; padding: 4px; background: #f8fafc; }
        .vr-item iframe { width: 100%; height: 60px; border: none; display: block; }
        .vr-del { position: absolute; top: 5px; right: 5px; color: #cbd5e1; border: none; background: none; cursor: pointer; }

        @keyframes vr-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
        body { padding-top: 55px !important; }
    `;
    document.head.appendChild(style);

    const injectUI = () => {
        const topBar = document.createElement('div');
        topBar.className = 'vr-top-bar';
        topBar.innerHTML = `
            <button id="vr-start" class="vr-btn-icon vr-btn-rec" title="Ghi âm">🎤</button>
            <button id="vr-stop" class="vr-btn-icon" disabled title="Dừng">⏹</button>
            <div id="vr-dot" class="vr-status-dot"></div>
            <div style="width:1px; height:20px; background:#e2e8f0; margin: 0 10px;"></div>
            <button id="vr-history-btn" class="vr-btn-icon" title="Lịch sử trang này">
                📂<span id="vr-count" class="vr-badge">0</span>
            </button>
        `;
        document.body.appendChild(topBar);

        const overlay = document.createElement('div');
        overlay.id = 'vr-overlay';
        overlay.className = 'vr-overlay';
        overlay.innerHTML = `
            <div class="vr-modal">
                <button style="position:absolute; top:10px; right:10px; border:none; background:none; cursor:pointer;" onclick="VoiceRecorder.toggleHistory()">✕</button>
                <div style="font-weight:bold; font-size:14px; color:#1e293b">Lịch sử bản ghi (Trang: <span id="vr-current-id"></span>)</div>
                <div id="vr-list" class="vr-list-container">Đang tải...</div>
            </div>
        `;
        overlay.onclick = (e) => { if(e.target === overlay) toggleHistory(); };
        document.body.appendChild(overlay);

        document.getElementById('vr-start').onclick = startRec;
        document.getElementById('vr-stop').onclick = stopRec;
        document.getElementById('vr-history-btn').onclick = toggleHistory;

        loadList(true); // Load ngầm cập nhật số lượng badge
    };

    function toggleHistory() {
        const overlay = document.getElementById('vr-overlay');
        const btn = document.getElementById('vr-history-btn');
        overlay.classList.toggle('show');
        btn.classList.toggle('selected', overlay.classList.contains('show'));
        if (overlay.classList.contains('show')) {
            document.getElementById('vr-current-id').innerText = getContextId();
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
            
            document.getElementById('vr-start').classList.add('recording');
            document.getElementById('vr-start').disabled = true;
            document.getElementById('vr-stop').disabled = false;
            document.getElementById('vr-dot').classList.add('recording');
        } catch (e) { alert("Lỗi truy cập Micro!"); }
    }

    function stopRec() {
        mediaRecorder.stop();
        document.getElementById('vr-start').classList.remove('recording');
        document.getElementById('vr-start').disabled = false;
        document.getElementById('vr-stop').disabled = true;
        document.getElementById('vr-dot').classList.remove('recording');
    }

    function uploadFile() {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        const pageId = getContextId();
        
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            console.log(`[VoiceRecorder] Tải lên bản ghi trang: ${pageId}`); // Log đầy đủ
            
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "uploadVoice", base64, fileName: `PAGE_${pageId}_${Date.now()}.webm`, lessonId: pageId })
            });
            setTimeout(() => loadList(true), 1000); // Cập nhật lại badge sau khi lưu
        };
    }

    async function loadList(silent = false) {
        const container = document.getElementById('vr-list');
        const countBadge = document.getElementById('vr-count');
        const pageId = getContextId();
        
        try {
            // Gửi pageId (lessonId) lên GAS để lọc đúng file của trang đó
            const res = await fetch(`${GAS_URL}?type=listVoice&lessonId=${pageId}&_t=${Date.now()}`);
            const data = await res.json();
            
            countBadge.innerText = data.length;
            
            if (!silent) {
                container.innerHTML = data.map(f => `
                    <div class="vr-item" id="vr-${f.id}">
                        <button class="vr-del" onclick="VoiceRecorder.delete('${f.id}')">✕</button>
                        <iframe src="https://drive.google.com/file/d/${f.id}/preview"></iframe>
                    </div>
                `).join('') || '<div style="text-align:center; color:gray; font-size:13px;">Chưa có bản ghi cho trang này.</div>';
            }
        } catch (e) { if(!silent) container.innerHTML = "Lỗi kết nối."; }
    }

    window.VoiceRecorder = {
        toggleHistory,
        delete: async (id) => {
            if (!confirm("Xóa bản ghi này?")) return;
            document.getElementById(`vr-${id}`).style.opacity = "0.3";
            await fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "deleteVoice", fileId: id }) });
            loadList(true);
        }
    };

    if (document.readyState === 'complete') injectUI();
    else window.addEventListener('load', injectUI);
})();