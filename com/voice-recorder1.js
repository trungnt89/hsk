/**
 * Voice Recorder Module - Fixed Scoping, Layout & Loading State
 */
const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
let mediaRecorder;
let audioChunks = [];

const getContextId = () => {
    const pageInfoEl = document.getElementById('pageInfo');
    return pageInfoEl ? pageInfoEl.innerText.replace(/\s+/g, '').replace(/\//g, '_') : "default";
};

const style = document.createElement('style');
style.textContent = `
    .vr-top-bar { position: fixed; top: 0; left: 0; width: 100%; height: 50px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; gap: 15px; z-index: 9999; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .vr-btn-icon { width: 36px; height: 36px; border-radius: 50%; border: 1px solid #cbd5e1; cursor: pointer; font-size: 18px; background: #fff; display: flex; align-items: center; justify-content: center; transition: 0.2s; position: relative; }
    .vr-btn-rec.active { background: #fee2e2; border-color: #dc2626; animation: vr-pulse 1.5s infinite; }
    
    /* Loading Animation */
    .vr-loading { animation: vr-spin 1s linear infinite; display: inline-block; pointer-events: none; }
    @keyframes vr-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    .vr-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 10px; padding: 1px 5px; border-radius: 10px; border: 2px solid #fff; }
    .vr-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.2); display: none; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(2px); }
    .vr-overlay.show { display: flex; }
    .vr-modal { background: white; width: 95%; max-width: 420px; border-radius: 12px; padding: 30px 15px 15px 15px; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
    .vr-close-modal { position: absolute; top: 8px; right: 8px; border: none; background: none; font-size: 22px; cursor: pointer; color: #cbd5e1; line-height: 1; }
    .vr-close-modal:hover { color: #64748b; }
    .vr-list { max-height: 320px; overflow-y: auto; margin-top: 10px; display: flex; flex-direction: column; gap: 10px; padding: 5px; }
    .vr-item { border: 1px solid #f1f5f9; border-radius: 10px; padding: 8px; background: #fff; display: flex; align-items: center; gap: 10px; transition: 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
    .vr-iframe-wrap { flex: 1; height: 48px; overflow: hidden; border-radius: 6px; background: #000; }
    .vr-item iframe { width: 100%; height: 100%; border: none; display: block; }
    .vr-item-del { width: 32px; height: 32px; border: 1px solid #fecaca; background: #fff; color: #ef4444; cursor: pointer; font-size: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: 0.2s; }
    .vr-item-del:hover { background: #ef4444; color: #fff; border-color: #ef4444; }
    @keyframes vr-pulse { 0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); } 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); } }
    body { padding-top: 55px !important; }
`;
document.head.appendChild(style);

const VoiceRecorder = {
    injectUI: () => {
        const bar = document.createElement('div');
        bar.className = 'vr-top-bar';
        bar.innerHTML = `
            <button id="vr-start" class="vr-btn-icon">🎤</button>
            <button id="vr-stop" class="vr-btn-icon" disabled>⏹</button>
            <button id="vr-open-history" class="vr-btn-icon">📂<span id="vr-count" class="vr-badge">0</span></button>
        `;
        document.body.appendChild(bar);

        const overlay = document.createElement('div');
        overlay.id = 'vr-overlay';
        overlay.className = 'vr-overlay';
        overlay.innerHTML = `
            <div class="vr-modal">
                <button class="vr-close-modal" onclick="document.getElementById('vr-overlay').classList.remove('show')">✕</button>
                <div style="font-weight:bold; margin-bottom:10px; font-size: 15px; color: #475569; padding-left: 5px;">Lịch sử: <span id="vr-pid"></span></div>
                <div id="vr-list" class="vr-list">Đang tải...</div>
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
        } catch (e) { alert("Micro Error!"); }
    },

    stop: () => {
        if (mediaRecorder) mediaRecorder.stop();
        document.getElementById('vr-start').classList.remove('active');
        document.getElementById('vr-start').disabled = false;
        document.getElementById('vr-stop').disabled = true;
    },

    upload: async () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        const pid = getContextId();
        const stopBtn = document.getElementById('vr-stop');
        
        // Hiển thị loading trên nút dừng khi đang tải lên
        stopBtn.innerHTML = '<span class="vr-loading">⏳</span>';
        stopBtn.disabled = true;

        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "uploadVoice", base64, fileName: `PAGE_${pid}_${Date.now()}.webm`, lessonId: pid })
            });
            setTimeout(() => {
                VoiceRecorder.load(true);
                stopBtn.innerHTML = '⏹';
            }, 1000);
        };
    },

    load: async (silent = false) => {
        const pid = getContextId();
        const listEl = document.getElementById('vr-list');
        try {
            const res = await fetch(`${GAS_URL}?type=listVoice&lessonId=${pid}&_t=${Date.now()}`);
            const data = await res.json();
            document.getElementById('vr-count').innerText = data.length;
            if (!silent) {
                listEl.innerHTML = data.map(f => `
                    <div class="vr-item" id="vr-item-${f.id}">
                        <div class="vr-iframe-wrap">
                            <iframe src="https://drive.google.com/file/d/${f.id}/preview"></iframe>
                        </div>
                        <button class="vr-item-del" onclick="VoiceRecorder.delete('${f.id}')">✕</button>
                    </div>
                `).join('') || '<div style="text-align:center; color:#94a3b8;">Trống</div>';
            }
        } catch (e) { if(!silent) listEl.innerHTML = "Lỗi tải dữ liệu."; }
    },

    delete: async (id) => {
        if (!confirm("Xóa bản ghi này?")) return;
        const btnDel = document.querySelector(`#vr-item-${id} .vr-item-del`);
        if (btnDel) {
            btnDel.innerHTML = '<span class="vr-loading">⏳</span>';
            btnDel.disabled = true;
        }
        
        try {
            await fetch(GAS_URL, { 
                method: "POST", 
                mode: "no-cors", 
                body: JSON.stringify({ action: "deleteVoice", fileId: id }) 
            });
            setTimeout(() => VoiceRecorder.load(true), 800);
        } catch (err) {
            alert("Lỗi khi xóa!");
            VoiceRecorder.load(true);
        }
    }
};

const initVoiceRecorder = () => {
    window.VoiceRecorder = VoiceRecorder; 
    VoiceRecorder.injectUI();
};

if (document.readyState === 'complete') initVoiceRecorder();
else window.addEventListener('load', initVoiceRecorder);

export default VoiceRecorder;