/**
 * Voice Recorder Module - Sticky Top, Icon-Only & PageInfo ID
 */
const VoiceRecorder = (() => {
    const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
    let mediaRecorder;
    let audioChunks = [];

    /**
     * Lấy ID dựa trên thẻ <span id="pageInfo">
     * Ví dụ: "9 / 11" -> "9_11"
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
        .vr-sticky-header { 
            position: fixed; top: 0; left: 0; width: 100%; 
            background: #fff; z-index: 9999; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
            display: flex; flex-direction: column;
        }
        .vr-row { 
            display: flex; align-items: center; justify-content: center; 
            gap: 12px; padding: 6px 15px; border-bottom: 1px solid #f1f5f9;
        }
        .vr-btn-icon { 
            width: 36px; height: 36px; display: flex; align-items: center; 
            justify-content: center; border-radius: 8px; border: 1px solid #e2e8f0; 
            background: #fff; cursor: pointer; font-size: 18px; transition: all 0.2s;
            position: relative; color: #475569;
        }
        /* Trạng thái Active/Selected */
        .vr-btn-icon.active { 
            background: #eff6ff; border-color: #3b82f6; color: #3b82f6; 
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
        }
        .vr-btn-rec.recording { 
            background: #fee2e2; border-color: #ef4444; color: #ef4444;
            animation: vr-pulse 1.5s infinite;
        }
        .vr-badge { 
            position: absolute; top: -5px; right: -5px; background: #1e293b; 
            color: #fff; font-size: 9px; padding: 1px 4px; border-radius: 10px; border: 1px solid #fff;
        }
        /* Popup Lịch sử */
        .vr-overlay { 
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.4); display: none; align-items: center; 
            justify-content: center; z-index: 10000; backdrop-filter: blur(2px); 
        }
        .vr-overlay.show { display: flex; }
        .vr-modal { background: white; width: 90%; max-width: 400px; border-radius: 12px; padding: 15px; position: relative; max-height: 70vh; display: flex; flex-direction: column; }
        .vr-list { flex: 1; overflow-y: auto; margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
        .vr-item { border: 1px solid #f1f5f9; border-radius: 8px; padding: 4px; background: #f8fafc; position: relative; }
        .vr-item iframe { width: 100%; height: 60px; border: none; display: block; }
        @keyframes vr-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.08); } 100% { transform: scale(1); } }
        body { padding-top: 90px !important; }
    `;
    document.head.appendChild(style);

    const injectUI = () => {
        const header = document.createElement('div');
        header.className = 'vr-sticky-header';
        header.innerHTML = `
            <div class="vr-row">
                <button id="vr-start" class="vr-btn-icon" title="Ghi âm">🎤</button>
                <button id="vr-stop" class="vr-btn-icon" disabled title="Dừng">⏹</button>
                <button id="vr-history-btn" class="vr-btn-icon" title="Lịch sử trang này">
                    📂<span id="vr-count" class="vr-badge">0</span>
                </button>
            </div>
            <div class="vr-row" style="background: #fafafa; gap: 8px;">
                <button class="vr-btn-icon active" title="Loa" onclick="this.classList.toggle('active')">🔊</button>
                <button class="vr-btn-icon" title="Lặp lại" onclick="this.classList.toggle('active')">🔁</button>
                <select style="border:1px solid #e2e8f0; border-radius:4px; font-size:12px; height:30px;">
                    <option>Nam</option><option>Nữ</option>
                </select>
                <select style="border:1px solid #e2e8f0; border-radius:4px; font-size:12px; height:30px;">
                    <option>0.8</option><option>1.0</option>
                </select>
            </div>
        `;
        document.body.appendChild(header);

        const overlay = document.createElement('div');
        overlay.id = 'vr-overlay';
        overlay.className = 'vr-overlay';
        overlay.innerHTML = `
            <div class="vr-modal">
                <div style="font-weight:bold; font-size:13px; margin-bottom:8px; color:#64748b;">Trang: <span id="vr-current-id"></span></div>
                <div id="vr-list" class="vr-list"></div>
                <button style="margin-top:10px; width:100%; padding:8px; border:none; background:#f1f5f9; border-radius:6px; cursor:pointer; font-size:12px;" onclick="VoiceRecorder.toggleHistory()">Đóng</button>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('vr-start').onclick = startRec;
        document.getElementById('vr-stop').onclick = stopRec;
        document.getElementById('vr-history-btn').onclick = toggleHistory;

        loadList(true); // Load ngầm số lượng file
    };

    function toggleHistory() {
        const overlay = document.getElementById('vr-overlay');
        const btn = document.getElementById('vr-history-btn');
        overlay.classList.toggle('show');
        btn.classList.toggle('active', overlay.classList.contains('show'));
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
            document.getElementById('vr-stop').disabled = false;
        } catch (e) { alert("Lỗi Micro!"); }
    }

    function stopRec() {
        mediaRecorder.stop();
        document.getElementById('vr-start').classList.remove('recording');
        document.getElementById('vr-stop').disabled = true;
    }

    function uploadFile() {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        const pageId = getContextId();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            console.log(`[Log] Lưu ghi âm trang: ${pageId}`); // Nghiêm cấm việc không ghi log đầy đủ
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "uploadVoice", base64, fileName: `PAGE_${pageId}_${Date.now()}.webm` })
            });
            setTimeout(() => loadList(true), 1000);
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
                    <div class="vr-item">
                        <iframe src="https://drive.google.com/file/d/${f.id}/preview"></iframe>
                    </div>
                `).join('') || '<div style="text-align:center;font-size:12px;color:gray;">Chưa có bản ghi trang này.</div>';
            }
        } catch (e) { if(!silent) container.innerHTML = "Lỗi tải dữ liệu."; }
    }

    window.VoiceRecorder = { toggleHistory };
    if (document.readyState === 'complete') injectUI();
    else window.addEventListener('load', injectUI);
})();