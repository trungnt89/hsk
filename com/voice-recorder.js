/**
 * Voice Recorder Module - Optimized UI with Close button & Delete action
 */
const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
let mediaRecorder;
let audioChunks = [];

const getContextId = () => {
    const pageInfoEl = document.getElementById('pageInfo');
    return pageInfoEl ? pageInfoEl.innerText.replace(/\s+/g, '').replace(/\//g, '_') : "default";
};

// 1. CSS Giao diện cập nhật
const style = document.createElement('style');
style.textContent = `
    .vr-top-bar { position: fixed; top: 0; left: 0; width: 100%; height: 50px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; gap: 15px; z-index: 9999; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .vr-btn-icon { width: 36px; height: 36px; border-radius: 50%; border: 1px solid #cbd5e1; cursor: pointer; font-size: 18px; background: #fff; display: flex; align-items: center; justify-content: center; transition: 0.2s; position: relative; }
    .vr-btn-rec.active { background: #fee2e2; border-color: #dc2626; color: #dc2626; animation: vr-pulse 1.5s infinite; }
    .vr-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 10px; padding: 1px 5px; border-radius: 10px; border: 2px solid #fff; }
    
    /* Modal & List */
    .vr-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: none; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(2px); }
    .vr-overlay.show { display: flex; }
    .vr-modal { background: white; width: 90%; max-width: 400px; border-radius: 12px; padding: 20px; position: relative; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
    
    /* Nút đóng góc trên bên phải */
    .vr-close-top { position: absolute; top: 12px; right: 12px; border: none; background: none; font-size: 20px; cursor: pointer; color: #94a3b8; padding: 5px; line-height: 1; }
    .vr-close-top:hover { color: #64748b; }

    .vr-list { max-height: 350px; overflow-y: auto; margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }
    
    /* Item ngắn gọn */
    .vr-item { border: 1px solid #f1f5f9; border-radius: 8px; padding: 8px; background: #f8fafc; display: flex; align-items: center; gap: 10px; }
    .vr-item audio { flex: 1; height: 35px; }
    
    /* Nút xóa item */
    .vr-btn-del { border: none; background: #fff; color: #cbd5e1; cursor: pointer; font-size: 16px; width: 28px; height: 28px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
    .vr-btn-del:hover { color: #ef4444; background: #fee2e2; }

    @keyframes vr-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
    body { padding-top: 55px !important; }
`;
document.head.appendChild(style);

const VoiceRecorder = {
    injectUI: () => {
        const bar = document.createElement('div');
        bar.className = 'vr-top-bar';
        bar.innerHTML = `
            <button id="vr-start" class="vr-btn-icon" title="Ghi âm">🎤</button>
            <button id="vr-stop" class="vr-btn-icon" disabled title="Dừng">⏹</button>
            <button id="vr-open-history" class="vr-btn-icon" title="Lịch sử">
                📂<span id="vr-count" class="vr-badge">0</span>
            </button>
        `;
        document.body.appendChild(bar);

        const overlay = document.createElement('div');
        overlay.id = 'vr-overlay';
        overlay.className = 'vr-overlay';
        overlay.innerHTML = `
            <div class="vr-modal">
                <button class="vr-close-top" onclick="VoiceRecorder.toggle()">✕</button>
                <div style="font-weight:bold; font-size:15px; color:#1e293b; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">Lịch sử: <span id="vr-pid"></span></div>
                <div id="vr-list" class="vr-list"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('vr-start').onclick = VoiceRecorder.start;
        document.getElementById('vr-stop').onclick = VoiceRecorder.stop;
        document.getElementById('vr-open-history').onclick = VoiceRecorder.toggle;
        VoiceRecorder.load(true);
    },

    toggle: () => {
        const ovl = document.getElementById('vr-overlay');
        ovl.classList.toggle('show');
        if (ovl.classList.contains('show')) {
            document.getElementById('vr-pid').innerText = getContextId();
            VoiceRecorder.load();
        }
    },

    start: async () => {
        try {
            audioChunks = [];
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = VoiceRecorder.upload;
            mediaRecorder.start();
            document.getElementById('vr-start').classList.add('active');
            document.getElementById('vr-start').disabled = true;
            document.getElementById('vr-stop').disabled = false;
        } catch (e) { alert("Lỗi Micro!"); }
    },

    stop: () => {
        mediaRecorder.stop();
        document.getElementById('vr-start').classList.remove('active');
        document.getElementById('vr-start').disabled = false;
        document.getElementById('vr-stop').disabled = true;
    },

    upload: async () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        const pid = getContextId();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            console.log(`[Log] Đang tải lên trang: ${pid}`);
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "uploadVoice", base64, fileName: `PAGE_${pid}_${Date.now()}.webm`, lessonId: pid })
            });
            setTimeout(() => VoiceRecorder.load(true), 1200);
        };
    },

    load: async (silent = false) => {
        const pid = getContextId();
        try {
            const res = await fetch(`${GAS_URL}?type=listVoice&lessonId=${pid}&_t=${Date.now()}`);
            const data = await res.json();
            document.getElementById('vr-count').innerText = data.length;
            if (!silent) {
                document.getElementById('vr-list').innerHTML = data.map(f => `
                    <div class="vr-item" id="item-${f.id}">
                        <audio controls src="https://drive.google.com/uc?export=download&id=${f.id}"></audio>
                        <button class="vr-btn-del" onclick="VoiceRecorder.delete('${f.id}')" title="Xóa">✕</button>
                    </div>
                `).join('') || '<div style="text-align:center; color:#94a3b8; font-size:13px; padding:20px;">Trống</div>';
            }
        } catch (e) { }
    },

    delete: async (id) => {
        if (!confirm("Bạn muốn xóa bản ghi này?")) return;
        const item = document.getElementById(`item-${id}`);
        if (item) item.style.opacity = "0.3";
        
        await fetch(GAS_URL, {
            method: "POST", mode: "no-cors",
            body: JSON.stringify({ action: "deleteVoice", fileId: id })
        });
        
        setTimeout(() => {
            if (item) item.remove();
            VoiceRecorder.load(true);
        }, 500);
    }
};

if (document.readyState === 'complete') VoiceRecorder.injectUI();
else window.addEventListener('load', VoiceRecorder.injectUI);

export default VoiceRecorder;