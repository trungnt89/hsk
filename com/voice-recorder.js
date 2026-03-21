/**
 * Voice Recorder Module - Final Optimized (GAS Proxy & IndexedDB Support)
 * Guiding Principle: "Bất biến Logic" & Full Logging.
 */
const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
const DB_NAME = "VoiceRecorderDB";
const DB_STORE = "audios";

let mediaRecorder;
let audioChunks = [];

const getContextId = () => {
    const pageInfoEl = document.getElementById('pageInfo');
    const pid = pageInfoEl ? pageInfoEl.innerText.replace(/\s+/g, '').replace(/\//g, '_') : "default";
    return pid;
};

// --- CSS Interface ---
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
    .vr-item { border: 1px solid #f1f5f9; border-radius: 10px; padding: 10px; background: #fff; display: flex; align-items: center; gap: 8px; transition: 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
    .vr-audio-wrap { flex: 1; display: flex; align-items: center; overflow: hidden; }
    .vr-audio-wrap audio { width: 100%; height: 36px; outline: none; }
    .vr-item-del { width: 32px; height: 32px; border: 1px solid #fecaca; background: #fff; color: #ef4444; cursor: pointer; font-size: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    @keyframes vr-pulse { 0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); } 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); } }
    body { padding-top: 55px !important; }
`;
document.head.appendChild(style);

const VoiceRecorder = {
    db: null,

    // --- Database Management ---
    initDB: () => {
        console.log("[VR Log] Initializing IndexedDB...");
        return new Promise((resolve) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE);
            req.onsuccess = e => { 
                VoiceRecorder.db = e.target.result; 
                console.log("[VR Log] IndexedDB Connected.");
                resolve(); 
            };
            req.onerror = () => console.error("[VR Log] IndexedDB Error.");
        });
    },

    saveToDB: (id, blob) => {
        const tx = VoiceRecorder.db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put(blob, id);
        console.log(`[VR Log] Blob cached in DB: ${id}`);
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
        console.log(`[VR Log] Cache removed: ${id}`);
    },

    // --- UI Methods ---
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

    // --- Core Recording Logic ---
    start: async () => {
        try {
            console.log("[VR Log] Starting Stream...");
            audioChunks = [];
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = VoiceRecorder.upload;
            mediaRecorder.start();
            document.getElementById('vr-start').classList.add('active');
            document.getElementById('vr-start').disabled = true;
            document.getElementById('vr-stop').disabled = false;
        } catch (e) { 
            console.error("[VR Log] Media Error:", e);
            alert("Không thể truy cập Micro!"); 
        }
    },

    stop: () => {
        if (mediaRecorder) mediaRecorder.stop();
        document.getElementById('vr-start').classList.remove('active');
        document.getElementById('vr-start').disabled = false;
        document.getElementById('vr-stop').disabled = true;
    },

    upload: async () => {
        console.log("[VR Log] Processing audio blob...");
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const pid = getContextId();
        const stopBtn = document.getElementById('vr-stop');
        
        stopBtn.innerHTML = '<span class="vr-loading">⏳</span>';
        stopBtn.disabled = true;

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            // Lưu tạm vào DB
            const tempId = "last_rec_" + Date.now();
            VoiceRecorder.saveToDB(tempId, blob);

            console.log("[VR Log] Uploading to GAS...");
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ 
                    action: "uploadVoice", 
                    base64, 
                    fileName: `PAGE_${pid}_${Date.now()}.webm`, 
                    lessonId: pid 
                })
            });
            
            setTimeout(() => {
                VoiceRecorder.load(false); 
                stopBtn.innerHTML = '⏹';
            }, 1000);
        };
    },

    // --- Fetch & Play Logic ---
    load: async (silent = false) => {
        const pid = getContextId();
        const listEl = document.getElementById('vr-list');
        try {
            console.log(`[VR Log] Fetching list for: ${pid}`);
            const res = await fetch(`${GAS_URL}?type=listVoice&lessonId=${pid}&_t=${Date.now()}`);
            const data = await res.json();
            document.getElementById('vr-count').innerText = data.length;
            if (!silent) {
                listEl.innerHTML = "";
                if (data.length === 0) listEl.innerHTML = '<div style="text-align:center; color:#94a3b8;">Trống</div>';
                for (const f of data) {
                    const item = document.createElement('div');
                    item.className = 'vr-item';
                    item.id = `vr-item-${f.id}`;
                    item.innerHTML = `
                        <div class="vr-audio-wrap" id="audio-container-${f.id}">⏳ Đang tải...</div>
                        <button class="vr-item-del" onclick="VoiceRecorder.delete('${f.id}')">✕</button>
                    `;
                    listEl.appendChild(item);
                    VoiceRecorder.prepareAudio(f.id);
                }
            }
        } catch (e) { 
            console.error("[VR Log] List fetch failed:", e);
            if(!silent) listEl.innerHTML = "Lỗi kết nối server."; 
        }
    },

    prepareAudio: async (id) => {
        const container = document.getElementById(`audio-container-${id}`);
        // 1. Kiểm tra cache IndexedDB
        let blob = await VoiceRecorder.getFromDB(id);
        
        if (blob) {
            console.log(`[VR Log] Playing from Cache: ${id}`);
            const url = URL.createObjectURL(blob);
            container.innerHTML = `<audio controls src="${url}"></audio>`;
        } else {
            console.log(`[VR Log] Fetching via Proxy for CORS bypass: ${id}`);
            try {
                // 2. Tải qua GAS Proxy (vượt CORS)
                const res = await fetch(`${GAS_URL}?type=getFileBlob&fileId=${id}`);
                const json = await res.json();
                
                if (json.status === "success") {
                    // Chuyển Base64 sang Blob
                    const byteCharacters = atob(json.data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const newBlob = new Blob([byteArray], {type: json.contentType});
                    
                    // Lưu vào DB cho lần sau
                    VoiceRecorder.saveToDB(id, newBlob);
                    
                    const url = URL.createObjectURL(newBlob);
                    container.innerHTML = `<audio controls src="${url}"></audio>`;
                } else {
                    throw new Error("GAS_PROXY_ERR");
                }
            } catch (e) {
                console.warn("[VR Log] CORS/Proxy Error, using Iframe fallback:", e);
                // 3. Fallback: Iframe (Nếu các cách trên đều thất bại)
                container.innerHTML = `<iframe src="https://drive.google.com/file/d/${id}/preview" style="width:100%; height:45px; border:none; border-radius:5px;"></iframe>`;
            }
        }
    },

    delete: async (id) => {
        if (!confirm("Xóa bản ghi này?")) return;
        console.log(`[VR Log] Deleting file: ${id}`);
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
            VoiceRecorder.removeFromDB(id);
            setTimeout(() => VoiceRecorder.load(true), 800);
        } catch (err) {
            console.error("[VR Log] Delete error:", err);
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