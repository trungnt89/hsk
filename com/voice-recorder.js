/**
 * Voice Recorder Module - Icon Only, Sticky Top & Active States
 */
const VoiceRecorder = (() => {
    const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
    let mediaRecorder;
    let audioChunks = [];
    let isListLoaded = false;

    const style = document.createElement('style');
    style.textContent = `
        /* Khung cố định 2 dòng trên cùng */
        .vr-sticky-header { 
            position: fixed; top: 0; left: 0; width: 100%; 
            background: #fff; z-index: 9999; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
            display: flex; flex-direction: column;
        }

        /* Dòng 1: Ghi âm & Lịch sử */
        .vr-row-primary { 
            display: flex; align-items: center; justify-content: center; 
            gap: 15px; padding: 8px 15px; border-bottom: 1px solid #f1f5f9;
        }

        /* Dòng 2: Trạng thái & Lọc (Ví dụ theo ảnh e28301) */
        .vr-row-secondary { 
            display: flex; align-items: center; justify-content: center; 
            gap: 10px; padding: 6px 15px; background: #fafafa;
        }

        /* Nút bấm dạng Icon */
        .vr-icon-btn { 
            width: 36px; height: 36px; display: flex; align-items: center; 
            justify-content: center; border-radius: 8px; border: 1px solid #e2e8f0; 
            background: #fff; cursor: pointer; font-size: 18px; transition: all 0.2s;
            position: relative; color: #475569;
        }
        
        /* Trạng thái Active cho nút bấm */
        .vr-icon-btn.active { 
            background: #eff6ff; border-color: #3b82f6; color: #3b82f6; 
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
        }

        /* Nút Ghi âm đặc biệt */
        .vr-btn-rec.recording { 
            background: #fee2e2; border-color: #ef4444; color: #ef4444;
            animation: vr-pulse 1.5s infinite;
        }

        .vr-badge { 
            position: absolute; top: -5px; right: -5px; background: #1e293b; 
            color: #fff; font-size: 9px; padding: 2px 5px; border-radius: 10px; 
            border: 1px solid #fff;
        }

        /* Popup Lịch sử */
        .vr-overlay { 
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.4); display: none; align-items: center; 
            justify-content: center; z-index: 10000; backdrop-filter: blur(2px); 
        }
        .vr-overlay.show { display: flex; }
        .vr-modal { 
            background: white; width: 95%; max-width: 420px; border-radius: 16px; 
            padding: 20px; position: relative; max-height: 70vh; display: flex; flex-direction: column; 
        }
        .vr-list-container { flex: 1; overflow-y: auto; margin-top: 15px; display: flex; flex-direction: column; gap: 10px; }
        
        .vr-item { position: relative; border: 1px solid #f1f5f9; border-radius: 8px; padding: 4px; background: #f8fafc; }
        .vr-item iframe { width: 100%; height: 60px; border: none; display: block; }
        .vr-del { position: absolute; top: 5px; right: 5px; border: none; background: none; cursor: pointer; color: #cbd5e1; }

        @keyframes vr-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        
        /* Đẩy nội dung trang xuống */
        body { padding-top: 95px !important; }
    `;
    document.head.appendChild(style);

    const injectUI = () => {
        const header = document.createElement('div');
        header.className = 'vr-sticky-header';
        header.innerHTML = `
            <div class="vr-row-primary">
                <button id="vr-start" class="vr-icon-btn vr-btn-rec" title="Ghi âm">🎤</button>
                <button id="vr-stop" class="vr-icon-btn" disabled title="Dừng">⏹</button>
                <div id="vr-status" style="width: 10px; height: 10px; border-radius: 50%; background: #ccc;"></div>
                <button id="vr-open-history" class="vr-icon-btn" title="Lịch sử">
                    📂<span id="vr-count" class="vr-badge">0</span>
                </button>
            </div>
            <div class="vr-row-secondary">
                <button class="vr-icon-btn active" title="Loa">🔊</button>
                <button class="vr-icon-btn" title="Lặp lại">🔁</button>
                <select style="border:1px solid #e2e8f0; border-radius:5px; font-size:12px; padding:2px;">
                    <option>Nam</option>
                    <option>Nữ</option>
                </select>
                <select style="border:1px solid #e2e8f0; border-radius:5px; font-size:12px; padding:2px;">
                    <option>0.8</option>
                    <option>1.0</option>
                </select>
            </div>
        `;
        document.body.appendChild(header);

        const overlay = document.createElement('div');
        overlay.id = 'vr-overlay';
        overlay.className = 'vr-overlay';
        overlay.innerHTML = `
            <div class="vr-modal">
                <button style="position:absolute; top:10px; right:10px; border:none; background:none; cursor:pointer;" onclick="VoiceRecorder.toggleHistory()">✕</button>
                <div style="font-weight:bold; font-size:14px; color:#1e293b">Lịch sử bản ghi</div>
                <div id="vr-list" class="vr-list-container"></div>
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
        const btn = document.getElementById('vr-open-history');
        overlay.classList.toggle('show');
        btn.classList.toggle('active', overlay.classList.contains('show'));
        if (overlay.classList.contains('show')) loadList();
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
            document.getElementById('vr-status').style.background = "#ef4444";
        } catch (e) { alert("Micro error!"); }
    }

    function stopRec() {
        mediaRecorder.stop();
        document.getElementById('vr-start').classList.remove('recording');
        document.getElementById('vr-stop').disabled = true;
        document.getElementById('vr-status').style.background = "#ccc";
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
            loadList(true);
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
                const d = new Date(f.date);
                return `
                    <div class="vr-item" id="vr-${f.id}">
                        <div style="font-size:10px; color:#94a3b8; margin-bottom:2px">${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}</div>
                        <button class="vr-del" onclick="VoiceRecorder.delete('${f.id}')">✕</button>
                        <iframe src="https://drive.google.com/file/d/${f.id}/preview"></iframe>
                    </div>
                `;
            }).join('');
        } catch (e) { if(!silent) container.innerHTML = "Error."; }
    }

    window.VoiceRecorder = {
        toggleHistory,
        delete: async (id) => {
            if (!confirm("Xóa?")) return;
            document.getElementById(`vr-${id}`).style.opacity = "0.3";
            await fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "deleteVoice", fileId: id }) });
            loadList(true);
        }
    };

    if (document.readyState === 'complete') injectUI();
    else window.addEventListener('load', injectUI);
})();

export default VoiceRecorder;