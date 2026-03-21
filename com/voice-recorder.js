const GAS_URL = "VUI_LONG_THAY_URL_TRIEN_KHAI_CUA_BAN_TAI_DAY";
const DB_NAME = "VoiceRecorderDB";
const DB_STORE = "audios";

let mediaRecorder;
let audioChunks = [];

const VoiceRecorder = {
    db: null,

    init: async function() {
        await this.initDB();
        this.injectCSS();
        this.injectUI();
        this.load(true);
        console.log("[VR Log] Module Initialized");
    },

    initDB: () => new Promise(res => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE);
        req.onsuccess = e => { VoiceRecorder.db = e.target.result; res(); };
    }),

    injectCSS: () => {
        const style = document.createElement('style');
        style.textContent = `
            .vr-bar { position: fixed; top: 0; left: 0; width: 100%; height: 50px; background: #fff; border-bottom: 1px solid #ddd; display: flex; align-items: center; justify-content: center; gap: 15px; z-index: 9999; }
            .vr-btn { width: 35px; height: 35px; border-radius: 50%; border: 1px solid #ccc; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; position: relative; }
            .vr-btn.active { background: #ffebeb; border-color: red; animation: pulse 1s infinite; }
            .vr-badge { position: absolute; top: -5px; right: -5px; background: red; color: white; font-size: 10px; padding: 2px 5px; border-radius: 10px; }
            .vr-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: none; z-index: 10000; align-items: center; justify-content: center; }
            .vr-modal.show { display: flex; }
            .vr-content { background: white; padding: 20px; border-radius: 10px; width: 90%; max-width: 400px; max-height: 80vh; overflow-y: auto; }
            .vr-item { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 10px; border: 1px solid #eee; border-radius: 8px; transition: opacity 0.3s; }
            audio { height: 35px; flex: 1; }
            @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255,0,0,0.4); } 100% { box-shadow: 0 0 0 10px rgba(255,0,0,0); } }
        `;
        document.head.appendChild(style);
    },

    injectUI: () => {
        const html = `
            <div class="vr-bar">
                <button id="vr-start" class="vr-btn">🎤</button>
                <button id="vr-stop" class="vr-btn" disabled>⏹</button>
                <button id="vr-open" class="vr-btn">📂<span id="vr-count" class="vr-badge">0</span></button>
            </div>
            <div id="vr-overlay" class="vr-modal">
                <div class="vr-content">
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                        <strong>Lịch sử ghi âm</strong>
                        <button onclick="document.getElementById('vr-overlay').classList.remove('show')">✕</button>
                    </div>
                    <div id="vr-list">Đang tải...</div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        document.getElementById('vr-start').onclick = () => VoiceRecorder.start();
        document.getElementById('vr-stop').onclick = () => VoiceRecorder.stop();
        document.getElementById('vr-open').onclick = () => {
            document.getElementById('vr-overlay').classList.add('show');
            VoiceRecorder.load();
        };
    },

    start: async function() {
        audioChunks = [];
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
        mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => this.upload();
        mediaRecorder.start();
        document.getElementById('vr-start').classList.add('active');
        document.getElementById('vr-stop').disabled = false;
    },

    stop: () => {
        mediaRecorder.stop();
        document.getElementById('vr-start').classList.remove('active');
        document.getElementById('vr-stop').disabled = true;
    },

    upload: async function() {
        const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            const pid = document.getElementById('pageInfo')?.innerText.trim() || "default";
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "uploadVoice", base64, fileName: `Speak_${pid}_${Date.now()}.webm` })
            });
            setTimeout(() => this.load(true), 1500);
        };
    },

    load: async function(silent = false) {
        const pid = document.getElementById('pageInfo')?.innerText.trim() || "default";
        const res = await fetch(`${GAS_URL}?type=listVoice&lessonId=${pid}`);
        const data = await res.json();
        document.getElementById('vr-count').innerText = data.length;
        if (silent) return;

        const list = document.getElementById('vr-list');
        list.innerHTML = data.length ? "" : "Trống";
        data.forEach(f => {
            const div = document.createElement('div');
            div.className = 'vr-item';
            div.id = `item-${f.id}`;
            div.innerHTML = `<div id="play-${f.id}" style="flex:1">⏳</div><button onclick="VoiceRecorder.delete('${f.id}')" style="color:red; border:none; background:none; cursor:pointer;">✕</button>`;
            list.appendChild(div);
            this.prepareAudio(f.id);
        });
    },

    prepareAudio: async function(id) {
        const container = document.getElementById(`play-${id}`);
        const tx = this.db.transaction(DB_STORE, "readonly");
        const cached = await new Promise(r => {
            const req = tx.objectStore(DB_STORE).get(id);
            req.onsuccess = () => r(req.result);
        });

        const toBase64Play = (blob) => new Promise(r => {
            const fr = new FileReader();
            fr.onloadend = () => r(fr.result);
            fr.readAsDataURL(blob);
        });

        if (cached) {
            const src = await toBase64Play(cached);
            container.innerHTML = `<audio controls playsinline src="${src}"></audio>`;
        } else {
            const res = await fetch(`${GAS_URL}?type=getFileBlob&fileId=${id}`);
            const json = await res.json();
            if (json.status === "success") {
                const bChars = atob(json.data);
                const bNums = new Array(bChars.length);
                for (let i = 0; i < bChars.length; i++) bNums[i] = bChars.charCodeAt(i);
                const blob = new Blob([new Uint8Array(bNums)], { type: json.contentType });
                
                const wrTx = this.db.transaction(DB_STORE, "readwrite");
                wrTx.objectStore(DB_STORE).put(blob, id);
                
                const src = await toBase64Play(blob);
                container.innerHTML = `<audio controls playsinline src="${src}"></audio>`;
            }
        }
    },

    delete: async function(id) {
        if (!confirm("Xóa?")) return;
        const el = document.getElementById(`item-${id}`);
        el.style.opacity = "0.3";
        fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "deleteVoice", fileId: id }) });
        const tx = this.db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).delete(id);
        setTimeout(() => { el.remove(); this.load(true); }, 300);
    }
};

VoiceRecorder.init();