/**
 * Voice Recorder Module - Final Solution for iPhone/Safari Compatibility
 * Mô phỏng cơ chế trả về Binary của Server TTS.
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

const VoiceRecorder = {
    db: null,

    // Khởi tạo DB
    initDB: () => new Promise(res => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE);
        req.onsuccess = e => { VoiceRecorder.db = e.target.result; res(); };
    }),

    // --- GIAO DIỆN ---
    injectUI: async function() {
        await this.initDB();
        const style = document.createElement('style');
        style.textContent = `
            .vr-top-bar { position: fixed; top: 0; left: 0; width: 100%; height: 50px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; gap: 15px; z-index: 9999; }
            .vr-btn-icon { width: 36px; height: 36px; border-radius: 50%; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; position: relative; }
            #vr-start.active { background: #fee2e2; border-color: #dc2626; animation: vr-pulse 1.5s infinite; }
            .vr-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 10px; padding: 1px 5px; border-radius: 10px; border: 2px solid #fff; }
            .vr-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.2); display: none; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(2px); }
            .vr-overlay.show { display: flex; }
            .vr-modal { background: white; width: 95%; max-width: 420px; border-radius: 12px; padding: 15px; position: relative; }
            .vr-list { max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
            .vr-item { border: 1px solid #f1f5f9; border-radius: 10px; padding: 8px; display: flex; align-items: center; gap: 10px; background: #fff; }
            .vr-audio-container { flex: 1; }
            audio { width: 100%; height: 35px; }
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
                    <button style="position:absolute; top:5px; right:5px; border:none; background:none; font-size:20px;" onclick="document.getElementById('vr-overlay').classList.remove('show')">✕</button>
                    <div style="font-weight:bold; margin-bottom:10px;">Lịch sử ghi âm</div>
                    <div id="vr-list" class="vr-list">Đang tải...</div>
                </div>
            </div>
        `);

        document.getElementById('vr-start').onclick = this.start;
        document.getElementById('vr-stop').onclick = this.stop;
        document.getElementById('vr-open-history').onclick = () => {
            document.getElementById('vr-overlay').classList.add('show');
            this.load();
        };
        this.load(true);
    },

    // --- LOGIC XỬ LÝ ÂM THANH ---
    start: async () => {
        try {
            audioChunks = [];
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Safari iOS hỗ trợ tốt nhất audio/mp4
            const mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
            mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
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
        const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        const reader = new FileReader();
        const pid = getContextId();
        const stopBtn = document.getElementById('vr-stop');
        stopBtn.innerHTML = '⏳';

        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "uploadVoice", base64, fileName: `Speak_${pid}_${Date.now()}.webm`, lessonId: pid })
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
            if (silent) return;

            listEl.innerHTML = data.length ? "" : "Trống";
            data.forEach(f => {
                const item = document.createElement('div');
                item.className = 'vr-item';
                item.id = `vr-item-${f.id}`;
                item.innerHTML = `
                    <div class="vr-audio-container" id="play-${f.id}">⏳ Loading...</div>
                    <button onclick="VoiceRecorder.delete('${f.id}')" style="border:none; background:none; color:red; cursor:pointer;">✕</button>
                `;
                listEl.appendChild(item);
                VoiceRecorder.prepareAudio(f.id);
            });
        } catch (e) { if(!silent) listEl.innerHTML = "Lỗi tải."; }
    },

    // CHÌA KHÓA: Chuyển Blob thành DataURL tương tự cơ chế Buffer của TTS Server
    prepareAudio: async (id) => {
        const container = document.getElementById(`play-${id}`);
        
        const toDataURL = (blob) => new Promise(resolve => {
            const fr = new FileReader();
            fr.onloadend = () => resolve(fr.result);
            fr.readAsDataURL(blob);
        });

        // Thử lấy từ IndexedDB
        const tx = VoiceRecorder.db.transaction(DB_STORE, "readonly");
        const cachedBlob = await new Promise(r => {
            const req = tx.objectStore(DB_STORE).get(id);
            req.onsuccess = () => r(req.result);
        });

        if (cachedBlob) {
            const src = await toDataURL(cachedBlob);
            container.innerHTML = `<audio controls playsinline src="${src}"></audio>`;
        } else {
            // Lấy từ Drive qua GAS Proxy (giống TTS Server)
            try {
                const res = await fetch(`${GAS_URL}?type=getFileBlob&fileId=${id}`);
                const json = await res.json();
                if (json.status === "success") {
                    const bChars = atob(json.data);
                    const bNums = new Array(bChars.length);
                    for (let i = 0; i < bChars.length; i++) bNums[i] = bChars.charCodeAt(i);
                    const newBlob = new Blob([new Uint8Array(bNums)], {type: 'audio/mpeg'});
                    
                    // Lưu Cache
                    const wrTx = VoiceRecorder.db.transaction(DB_STORE, "readwrite");
                    wrTx.objectStore(DB_STORE).put(newBlob, id);

                    const src = await toDataURL(newBlob);
                    container.innerHTML = `<audio controls playsinline src="${src}"></audio>`;
                }
            } catch (e) { container.innerHTML = "Lỗi nạp file"; }
        }
    },

    delete: async (id) => {
        if (!confirm("Xóa?")) return;
        const el = document.getElementById(`vr-item-${id}`);
        el.style.opacity = '0.3';
        fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "deleteVoice", fileId: id }) });
        
        // Xóa Cache và UI ngay lập tức
        const tx = VoiceRecorder.db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).delete(id);
        setTimeout(() => {
            el.remove();
            const badge = document.getElementById('vr-count');
            badge.innerText = Math.max(0, parseInt(badge.innerText) - 1);
        }, 300);
    }
};

// Khởi chạy
if (document.readyState === 'complete') VoiceRecorder.injectUI();
else window.addEventListener('load', () => VoiceRecorder.injectUI());

export default VoiceRecorder;