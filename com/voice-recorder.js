/**
 * Voice Recorder Module - Final Optimized
 * Cam kết: Ghi log đầy đủ, không sửa logic ngoại vi.
 */
const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
const DB_NAME = "VoiceRecorderDB";
const DB_STORE = "audios";

let mediaRecorder;
let audioChunks = [];

const getContextId = () => {
    const pageInfoEl = document.getElementById('pageInfo');
    return pageInfoEl ? pageInfoEl.innerText.replace(/\s+/g, '').replace(/\//g, '_') : "default";
};

// --- CSS Style ---
const style = document.createElement('style');
style.textContent = `
    .vr-top-bar { position: fixed; top: 0; left: 0; width: 100%; height: 50px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; gap: 15px; z-index: 9999; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .vr-btn-icon { width: 36px; height: 36px; border-radius: 50%; border: 1px solid #cbd5e1; cursor: pointer; font-size: 18px; background: #fff; display: flex; align-items: center; justify-content: center; transition: 0.2s; position: relative; }
    #vr-start.active { background: #fee2e2; border-color: #dc2626; animation: vr-pulse 1.5s infinite; }
    .vr-loading { animation: vr-spin 1s linear infinite; display: inline-block; pointer-events: none; }
    @keyframes vr-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .vr-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 10px; padding: 1px 5px; border-radius: 10px; border: 2px solid #fff; }
    .vr-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.2); display: none; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(2px); }
    .vr-overlay.show { display: flex; }
    .vr-modal { background: white; width: 95%; max-width: 420px; border-radius: 12px; padding: 30px 15px 15px 15px; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
    .vr-close-modal { position: absolute; top: 8px; right: 8px; border: none; background: none; font-size: 22px; cursor: pointer; color: #cbd5e1; line-height: 1; }
    .vr-list { max-height: 320px; overflow-y: auto; margin-top: 10px; display: flex; flex-direction: column; gap: 10px; padding: 5px; }
    .vr-item { border: 1px solid #f1f5f9; border-radius: 10px; padding: 10px; background: #fff; display: flex; align-items: center; gap: 8px; transition: opacity 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
    .vr-audio-wrap { flex: 1; display: flex; align-items: center; overflow: hidden; }
    .vr-audio-wrap audio { width: 100%; height: 36px; outline: none; }
    .vr-item-del { width: 32px; height: 32px; border: 1px solid #fecaca; background: #fff; color: #ef4444; cursor: pointer; font-size: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    @keyframes vr-pulse { 0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); } 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); } }
    body { padding-top: 55px !important; }
`;
document.head.appendChild(style);

const VoiceRecorder = {
    db: null,

    initDB: () => {
        return new Promise((resolve) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE);
            req.onsuccess = e => { VoiceRecorder.db = e.target.result; resolve(); };
        });
    },

    saveToDB: (id, blob) => {
        const tx = VoiceRecorder.db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put(blob, id);
        console.log(`[VR Log] Cached: ${id}`);
    },

    getFromDB: (id) => {
        return new Promise((resolve) => {
            const tx = VoiceRecorder.db.transaction(DB_STORE, "readonly");
            const req = tx.objectStore(DB_STORE).get(id);
            req.onsuccess = () => resolve(req.result);
        });
    },

    removeFromDB: (id) => {
        const tx = VoiceRecorder.db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).delete(id);
    },

    injectUI: async () => {
        await VoiceRecorder.initDB();
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
        } catch (e) { alert("Lỗi truy cập Micro!"); }
    },

    stop: () => {
        if (mediaRecorder) mediaRecorder.stop();
        document.getElementById('vr-start').classList.remove('active');
        document.getElementById('vr-start').disabled = false;
        document.getElementById('vr-stop').disabled = true;
    },

    upload: async () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const pid = getContextId();
        const stopBtn = document.getElementById('vr-stop');
        stopBtn.innerHTML = '<span class="vr-loading">⏳</span>';

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "uploadVoice", base64, fileName: `PAGE_${pid}_${Date.now()}.webm`, lessonId: pid })
            });
            setTimeout(() => { VoiceRecorder.load(false); stopBtn.innerHTML = '⏹'; }, 1000);
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
                listEl.innerHTML = data.length ? "" : '<div style="text-align:center; color:#94a3b8;">Trống</div>';
                data.forEach(f => {
                    const item = document.createElement('div');
                    item.className = 'vr-item';
                    item.id = `vr-item-${f.id}`;
                    item.innerHTML = `<div class="vr-audio-wrap" id="audio-container-${f.id}">⏳...</div><button class="vr-item-del" onclick="VoiceRecorder.delete('${f.id}')">✕</button>`;
                    listEl.appendChild(item);
                    VoiceRecorder.prepareAudio(f.id);
                });
            }
        } catch (e) { console.error("[VR Log] Load Error", e); }
    },

    prepareAudio: async (id) => {
        const container = document.getElementById(`audio-container-${id}`);
        let blob = await VoiceRecorder.getFromDB(id);
        
        if (blob) {
            container.innerHTML = `<audio controls src="${URL.createObjectURL(blob)}"></audio>`;
        } else {
            try {
                const res = await fetch(`${GAS_URL}?type=getFileBlob&fileId=${id}`);
                const json = await res.json();
                if (json.status === "success") {
                    const byteCharacters = atob(json.data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                    const newBlob = new Blob([new Uint8Array(byteNumbers)], {type: json.contentType});
                    VoiceRecorder.saveToDB(id, newBlob);
                    container.innerHTML = `<audio controls src="${URL.createObjectURL(newBlob)}"></audio>`;
                } else throw new Error();
            } catch (e) {
                container.innerHTML = `<iframe src="https://drive.google.com/file/d/${id}/preview" style="width:100%; height:45px; border:none;"></iframe>`;
            }
        }
    },

    delete: async (id) => {
        if (!confirm("Xóa bản ghi này?")) return;
        const itemEl = document.getElementById(`vr-item-${id}`);
        const btnDel = itemEl.querySelector('.vr-item-del');
        
        btnDel.innerHTML = '⏳';
        btnDel.style.pointerEvents = 'none';

        try {
            // Gửi lệnh xóa tới GAS (không đợi phản hồi lâu)
            fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "deleteVoice", fileId: id }) });
            
            // Xóa ngay lập tức trên UI và Cache cục bộ
            await VoiceRecorder.removeFromDB(id);
            itemEl.style.opacity = '0';
            setTimeout(() => {
                itemEl.remove();
                const countEl = document.getElementById('vr-count');
                countEl.innerText = Math.max(0, parseInt(countEl.innerText) - 1);
                console.log(`[VR Log] UI Updated for: ${id}`);
            }, 300);
        } catch (err) {
            alert("Lỗi xóa!");
            btnDel.innerHTML = '✕';
            btnDel.style.pointerEvents = 'auto';
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