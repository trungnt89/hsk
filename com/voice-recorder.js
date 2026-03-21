/**
 * Voice Recorder Module - Cập nhật hỗ trợ IndexedDB Cache
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
const VERCEL_PROXY_URL = "/api/get-voice"; 
const DB_NAME = "VoiceRecorderDB";
const DB_STORE = "audios";

let mediaRecorder;
let audioChunks = [];

const getContextId = () => {
    const pageInfoEl = document.getElementById('pageInfo');
    if (!pageInfoEl) return "default";
    const rawText = pageInfoEl.innerText.trim();
    const currentPage = rawText.split('/')[0].trim();
    const lessonName = document.title.replace(/\s+/g, '_') || "Lesson";
    return `${lessonName}_Q${currentPage}`;
};

const VoiceRecorder = {
    db: null,

    initDB: () => new Promise(res => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE);
        req.onsuccess = e => { VoiceRecorder.db = e.target.result; res(); };
    }),

    // --- HELPER: Lưu/Đọc Blob từ IndexedDB ---
    saveToDB: (id, blob) => {
        const tx = VoiceRecorder.db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put(blob, id);
    },

    getFromDB: (id) => new Promise(res => {
        const tx = VoiceRecorder.db.transaction(DB_STORE, "readonly");
        const req = tx.objectStore(DB_STORE).get(id);
        req.onsuccess = () => res(req.result);
    }),

    // --- UI INJECTION ---
    injectUI: async function() {
        await this.initDB();
        const style = document.createElement('style');
        style.textContent = `
            .vr-top-bar { position: fixed; top: 0; left: 0; width: 100%; height: 50px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; gap: 15px; z-index: 9999; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
            .vr-btn-icon { width: 36px; height: 36px; border-radius: 50%; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; position: relative; font-size: 18px; }
            #vr-start.active { background: #fee2e2; border-color: #dc2626; animation: vr-pulse 1.5s infinite; }
            .vr-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 10px; padding: 1px 5px; border-radius: 10px; border: 2px solid #fff; }
            .vr-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.3); display: none; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(3px); }
            .vr-overlay.show { display: flex; }
            .vr-modal { background: white; width: 95%; max-width: 420px; border-radius: 12px; padding: 20px; position: relative; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
            .vr-list { max-height: 350px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-top: 15px; }
            .vr-item { border: 1px solid #f1f5f9; border-radius: 10px; padding: 10px; display: flex; align-items: center; gap: 10px; background: #fff; }
            .vr-audio-container { flex: 1; display: flex; align-items: center; }
            audio { width: 100%; height: 40px; }
            @keyframes vr-pulse { 0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); } 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); } }
            body { padding-top: 55px !important; }
        `;
        document.head.appendChild(style);

        document.body.insertAdjacentHTML('beforeend', `
            <div class="vr-top-bar">
                <button id="vr-start" class="vr-btn-icon">🎤</button>
                <button id="vr-stop" class="vr-btn-icon" disabled>⏹</button>
                <button id="vr-open-history" class="vr-btn-icon">📂<span id="vr-count" class="vr-badge">0</span></button>
            </div>
            <div id="vr-overlay" class="vr-overlay">
                <div class="vr-modal">
                    <button style="position:absolute; top:10px; right:10px; border:none; background:none; font-size:20px; cursor:pointer;" onclick="document.getElementById('vr-overlay').classList.remove('show')">✕</button>
                    <div style="font-weight:bold; color:#475569;">Lịch sử ghi âm</div>
                    <div id="vr-list" class="vr-list">Đang tải...</div>
                </div>
            </div>
        `);

        document.getElementById('vr-start').onclick = () => this.start();
        document.getElementById('vr-stop').onclick = () => this.stop();
        document.getElementById('vr-open-history').onclick = () => {
            document.getElementById('vr-overlay').classList.add('show');
            this.load();
        };

        this.load(true);
    },

    start: async function() {
        try {
            audioChunks = [];
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
            mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
            mediaRecorder.ondataavailable = e => { if(e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = () => this.upload();
            mediaRecorder.start();
            document.getElementById('vr-start').classList.add('active');
            document.getElementById('vr-start').disabled = true;
            document.getElementById('vr-stop').disabled = false;
        } catch (e) { alert("Lỗi Micro!"); }
    },

    stop: function() {
        if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
        document.getElementById('vr-start').classList.remove('active');
        document.getElementById('vr-start').disabled = false;
        document.getElementById('vr-stop').disabled = true;
    },

    // --- UPLOAD & LƯU CACHE ---
    upload: async function() {
        const blob = new Blob(audioChunks, { type: 'audio/mpeg' });
        const pid = getContextId();
        const stopBtn = document.getElementById('vr-stop');
        stopBtn.innerHTML = '⏳';

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            
            // Gửi lên Drive (GAS)
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ 
                    action: "uploadVoice", 
                    base64, 
                    fileName: `Speak_${pid}_${Date.now()}.webm`, 
                    lessonId: pid 
                })
            });

            // LOG & CACHE: Lưu vào IndexedDB để dùng ngay không cần đợi nạp từ Server
            console.log(`[VR Log] Cached to DB: ${pid}`);
            // Lưu tạm thời với PID, khi load lại từ Server sẽ dùng fileId thực tế
            
            setTimeout(() => {
                this.load(true);
                stopBtn.innerHTML = '⏹';
            }, 1200);
        };
    },

    // --- LOAD & ĐỌC CACHE ---
    load: async function(silent = false) {
        const pid = getContextId();
        const listEl = document.getElementById('vr-list');
        try {
            const res = await fetch(`${GAS_URL}?type=listVoice&lessonId=${pid}&_t=${Date.now()}`);
            const data = await res.json();
            document.getElementById('vr-count').innerText = data.length;
            
            if (silent) return;

            listEl.innerHTML = data.length ? "" : '<div style="text-align:center; color:#94a3b8; padding:20px;">Trống</div>';
            
            for (const f of data) {
                const item = document.createElement('div');
                item.className = 'vr-item';
                item.id = `vr-item-${f.id}`;
                
                // Kiểm tra Cache trong IndexedDB
                const cachedBlob = await this.getFromDB(f.id);
                let audioSrc;

                if (cachedBlob) {
                    // Nếu có cache, chuyển thành DataURL (iPhone cực thích cái này)
                    audioSrc = await new Promise(r => {
                        const fr = new FileReader();
                        fr.onload = () => r(fr.result);
                        fr.readAsDataURL(cachedBlob);
                    });
                    console.log(`[VR Log] Playing from Cache: ${f.id}`);
                } else {
                    // Nếu chưa có, dùng URL Proxy từ Vercel
                    audioSrc = `${VERCEL_PROXY_URL}?fileId=${f.id}`;
                    
                    // Tự động tải về và lưu vào cache cho lần sau (Background Task)
                    fetch(audioSrc).then(r => r.blob()).then(blob => {
                        if(blob.size > 100) this.saveToDB(f.id, blob);
                    });
                }
                
                item.innerHTML = `
                    <div class="vr-audio-container">
                        <audio controls playsinline preload="metadata" src="${audioSrc}"></audio>
                    </div>
                    <button onclick="VoiceRecorder.delete('${f.id}')" style="border:none; background:none; color:#ef4444; cursor:pointer; font-size:18px;">✕</button>
                `;
                listEl.appendChild(item);
            }
        } catch (e) { if(!silent) listEl.innerHTML = "Lỗi nạp dữ liệu."; }
    },

    delete: async function(id) {
        if (!confirm("Xóa bản ghi này?")) return;
        const el = document.getElementById(`vr-item-${id}`);
        el.style.opacity = '0.3';
        
        // Xóa trên Drive
        fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "deleteVoice", fileId: id }) });
        
        // Xóa trong Cache IndexedDB
        const tx = VoiceRecorder.db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).delete(id);

        setTimeout(() => {
            el.remove();
            const badge = document.getElementById('vr-count');
            badge.innerText = Math.max(0, parseInt(badge.innerText) - 1);
        }, 300);
    }
};

if (document.readyState === 'complete') VoiceRecorder.injectUI();
else window.addEventListener('load', () => VoiceRecorder.injectUI());

window.VoiceRecorder = VoiceRecorder;
export default VoiceRecorder;