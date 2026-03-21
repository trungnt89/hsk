/**
 * Voice Recorder Module - Top Bar & Pre-load Version
 */
const VoiceRecorder = (() => {
    const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
    let mediaRecorder;
    let audioChunks = [];
    let isListLoaded = false;

    // 1. CSS Giao diện
    const style = document.createElement('style');
    style.textContent = `
        /* Thanh điều khiển luôn dính trên đỉnh (Sticky Top) */
        .vr-top-bar { position: fixed; top: 0; left: 0; width: 100%; height: 50px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; gap: 10px; z-index: 9998; box-shadow: 0 2px 4px rgba(0,0,0,0.05); padding: 0 15px; }
        
        .vr-btn { padding: 6px 15px; border-radius: 20px; border: 1px solid #cbd5e1; cursor: pointer; font-size: 13px; font-weight: 600; background: #fff; transition: all 0.2s; display: flex; align-items: center; gap: 5px; }
        .vr-btn-rec { color: #dc2626; border-color: #fecaca; }
        .vr-btn-rec.active { background: #fee2e2; border-color: #dc2626; animation: vr-pulse 1.5s infinite; }
        .vr-btn-history { color: #475569; }
        
        .vr-status-text { font-size: 11px; color: #ef4444; min-width: 80px; font-weight: bold; }

        /* Popup Lịch sử */
        .vr-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: none; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(2px); }
        .vr-overlay.show { display: flex; }
        .vr-modal { background: white; width: 95%; max-width: 450px; border-radius: 16px; padding: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); position: relative; max-height: 80vh; display: flex; flex-direction: column; }
        .vr-close { position: absolute; top: 15px; right: 15px; border: none; background: none; font-size: 20px; cursor: pointer; color: #94a3b8; }
        
        .vr-list-container { flex: 1; overflow-y: auto; margin-top: 15px; display: flex; flex-direction: column; gap: 12px; }
        .vr-item { position: relative; border: 1px solid #f1f5f9; border-radius: 8px; padding: 4px; background: #f8fafc; }
        .vr-info { font-size: 11px; color: #64748b; margin: 2px 0 4px 6px; display: flex; justify-content: space-between; padding-right: 30px; }
        .vr-item iframe { width: 100%; height: 60px; border: none; display: block; }
        
        .vr-del { position: absolute; top: 6px; right: 8px; color: #cbd5e1; border: none; background: none; cursor: pointer; font-size: 16px; z-index: 5; }
        .vr-del:hover { color: #ef4444; }

        @keyframes vr-pulse { 0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); } 70% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); } 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); } }
        
        /* Đẩy body xuống để không bị thanh top che mất nội dung web */
        body { padding-top: 55px !important; }
    `;
    document.head.appendChild(style);

    const injectUI = () => {
        // 1. Tạo thanh Top Bar
        const topBar = document.createElement('div');
        topBar.className = 'vr-top-bar';
        topBar.innerHTML = `
            <button id="vr-start" class="vr-btn vr-btn-rec">🔴 Ghi âm</button>
            <button id="vr-stop" class="vr-btn" disabled>⏹ Dừng</button>
            <span id="vr-status" class="vr-status-text"></span>
            <button id="vr-open-history" class="vr-btn vr-btn-history">📂 Lịch sử (<span id="vr-count">0</span>)</button>
        `;
        document.body.appendChild(topBar);

        // 2. Tạo Modal Lịch sử (Ẩn)
        const overlay = document.createElement('div');
        overlay.id = 'vr-overlay';
        overlay.className = 'vr-overlay';
        overlay.innerHTML = `
            <div class="vr-modal">
                <button class="vr-close" onclick="VoiceRecorder.toggleHistory()">✕</button>
                <div style="font-weight:bold; font-size:16px">Lịch sử ghi âm</div>
                <div id="vr-list" class="vr-list-container">Đang tải...</div>
            </div>
        `;
        overlay.onclick = (e) => { if(e.target === overlay) toggleHistory(); };
        document.body.appendChild(overlay);

        // Gán sự kiện
        document.getElementById('vr-start').onclick = startRec;
        document.getElementById('vr-stop').onclick = stopRec;
        document.getElementById('vr-open-history').onclick = toggleHistory;

        // LOAD NGẦM NGAY LẬP TỨC
        loadList(true);
    };

    function toggleHistory() {
        const overlay = document.getElementById('vr-overlay');
        overlay.classList.toggle('show');
        if (overlay.classList.contains('show') && !isListLoaded) {
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
        mediaRecorder.stop();
        document.getElementById('vr-start').classList.remove('active');
        document.getElementById('vr-start').disabled = false;
        document.getElementById('vr-stop').disabled = true;
        document.getElementById('vr-status').innerText = "SAVING...";
    }

    function uploadFile() {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "uploadVoice", base64, fileName: `Speak_${Date.now()}.webm` })
            });
            document.getElementById('vr-status').innerText = "DONE!";
            setTimeout(() => { document.getElementById('vr-status').innerText = ""; loadList(); }, 1000);
        };
    }

    async function loadList(silent = false) {
        const container = document.getElementById('vr-list');
        const countBadge = document.getElementById('vr-count');
        try {
            const res = await fetch(`${GAS_URL}?type=listVoice&_t=${Date.now()}`);
            const data = await res.json();
            countBadge.innerText = data.length;
            
            container.innerHTML = data.map(f => {
                const dateObj = new Date(f.date);
                const dateStr = `${dateObj.getDate()}/${dateObj.getMonth()+1} ${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                return `
                    <div class="vr-item" id="vr-${f.id}">
                        <div class="vr-info"><span>📅 ${dateStr}</span></div>
                        <button class="vr-del" onclick="VoiceRecorder.delete('${f.id}')">✕</button>
                        <iframe src="https://drive.google.com/file/d/${f.id}/preview"></iframe>
                    </div>
                `;
            }).join('') || '<div style="text-align:center; color:gray; font-size:13px;">Trống</div>';
            
            isListLoaded = true;
        } catch (e) { if(!silent) container.innerHTML = "Lỗi tải."; }
    }

    window.VoiceRecorder = {
        toggleHistory: toggleHistory,
        delete: async (id) => {
            if (!confirm("Xóa file này?")) return;
            const el = document.getElementById(`vr-${id}`);
            if (el) el.style.opacity = "0.3";
            fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "deleteVoice", fileId: id }) });
            setTimeout(() => { el && el.remove(); loadList(true); }, 500);
        }
    };

    if (document.readyState === 'complete') injectUI();
    else window.addEventListener('load', injectUI);

    return { toggle: toggleHistory };
})();

export default VoiceRecorder;