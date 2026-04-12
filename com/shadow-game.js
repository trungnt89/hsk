/**
 * ShadowGame Module - Full Auto-Injection & IndexedDB Audio Storage
 */

const RECORD_GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";

export const ShadowGame = {
    isListening: false,
    history: [],
    currentInterim: "",
    recognition: null,
    mediaRecorder: null,
    audioChunks: [],
    db: null,

    getEl(id) { return document.getElementById(id); },

    async initDB() {
        return new Promise((resolve) => {
            const request = indexedDB.open("ShadowVoiceDB", 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("voices")) {
                    db.createObjectStore("voices", { keyPath: "id" });
                }
            };
            request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
        });
    },

    async saveVoiceLocal(id, blob, metadata) {
        if (!this.db) return;
        console.log("Saving to IndexedDB:", id, metadata);
        const tx = this.db.transaction("voices", "readwrite");
        tx.objectStore("voices").put({ id, blob, ...metadata });
    },

    async getVoiceLocal(id) {
        if (!this.db) return null;
        const tx = this.db.transaction("voices", "readonly");
        return new Promise(res => {
            const req = tx.objectStore("voices").get(id);
            req.onsuccess = () => res(req.result);
            req.onerror = () => res(null);
        });
    },

    injectRequiredClasses() {
        const containers = ['paragraphContainer', 'conversationContainer'];
        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.classList.contains('content-area')) el.classList.add('content-area');
        });
        
        const activeTab = document.querySelector('.tab-content.active .content-area');
        if (activeTab) {
            document.querySelectorAll('.content-area').forEach(a => a.classList.remove('active'));
            activeTab.classList.add('active');
        }
    },

    buildUI() {
        if (this.getEl('shadow-game-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.id = "shadow-game-wrapper";
        wrapper.style.cssText = `
            display: flex; align-items: center; gap: 10px; padding: 8px 12px; 
            min-height: 60px; width: 100%; position: fixed; bottom: 0; left: 0;
            background: #ffffff; z-index: 9999; border-top: 2px solid #cbd5e1;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1); box-sizing: border-box;
        `;
        
        wrapper.innerHTML = `
            <button id="btnMic" style="width: 44px; height: 44px; border-radius: 50%; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink:0;">🎤</button>
            <button id="btnList" style="width: 44px; height: 44px; border-radius: 50%; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink:0;">📜</button>
            <div id="gamePanel" style="display:none; flex-grow: 1; background:#1e293b; color:#f1f5f9; padding: 6px 14px; border-radius: 12px; align-items: center; gap: 10px; overflow: hidden;">
                <div style="flex-grow: 1; display: flex; flex-direction: column; overflow: hidden;">
                    <div id="gameHistory" style="font-size: 10px; color:#94a3b8; white-space: nowrap; overflow-x: auto;"></div>
                    <div id="gameCurrent" style="font-size: 13px; font-weight: 600; color:#4ade80; white-space: nowrap; overflow-x: auto;"></div>
                </div>
                <div id="gameScore" style="font-weight:bold; color:#4ade80;">0%</div>
            </div>
            <div id="voiceListPanel" style="display:none; position:fixed; top:10px; left:10px; right:10px; background:white; border:1px solid #cbd5e1; border-radius:12px; padding:10px; max-height:80vh; overflow-y:auto; box-shadow:0 10px 25px rgba(0,0,0,0.2); z-index:10001;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:8px;">
                    <b style="font-size:14px;">🎙️ Danh sách ghi âm</b>
                    <div style="display:flex; gap:15px; align-items:center;">
                        <span id="refreshList" style="cursor:pointer; font-size:18px;" title="Lấy mới từ server">🔄</span>
                        <span id="closeList" style="cursor:pointer; font-size:20px; padding:0 5px;">✕</span>
                    </div>
                </div>
                <div id="voiceItems" style="font-size:12px; color:#333;"></div>
            </div>
        `;

        document.body.appendChild(wrapper);
        document.body.style.paddingBottom = "80px";
        this.getEl('btnMic').onclick = () => this.toggle();
        this.getEl('btnList').onclick = () => this.toggleVoiceList();
        this.getEl('refreshList').onclick = () => this.toggleVoiceList(true);
        this.getEl('closeList').onclick = () => { this.getEl('voiceListPanel').style.display = 'none'; };
    },

    async init() {
        await this.initDB();
        this.buildUI();
        this.injectRequiredClasses();

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                setTimeout(() => { this.injectRequiredClasses(); this.resetUI(); }, 200);
            });
        });

        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
            this.recognition = new SR();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'ja-JP';
            this.recognition.onresult = (event) => {
                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        this.handleVoiceInput(event.results[i][0].transcript, true);
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }
                if (interim) this.handleVoiceInput(interim, false);
            };
            this.recognition.onend = () => { if (this.isListening) this.recognition.start(); };
        }
    },

    toggle() { this.isListening ? this.stop() : this.start(); },

    async start() {
        this.isListening = true;
        this.history = [];
        this.audioChunks = [];
        this.getEl('gamePanel').style.display = 'flex';
        this.getEl('btnMic').innerHTML = '🛑';
        try { this.recognition.start(); } catch(e) {}

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.ondataavailable = (e) => this.audioChunks.push(e.data);
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.uploadToDrive(blob).then(() => {
                    if (this.getEl('voiceListPanel').style.display === 'block') this.toggleVoiceList(false);
                });
                stream.getTracks().forEach(t => t.stop());
            };
            this.mediaRecorder.start();
        } catch (err) { console.error("Mic error:", err); }
    },

    stop() {
        this.isListening = false;
        this.getEl('btnMic').innerHTML = '🎤';
        if (this.recognition) this.recognition.stop();
        if (this.mediaRecorder) this.mediaRecorder.stop();
    },

    async uploadToDrive(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64 = reader.result.split(',')[1];
                const urlParams = new URLSearchParams(window.location.search);
                const lessonId = urlParams.get('id') || "unknown";
                const fileName = `Shadow_${lessonId}_${Date.now()}.webm`;

                try {
                    const res = await fetch(RECORD_GAS_URL, {
                        method: "POST",
                        body: JSON.stringify({ action: "uploadVoice", base64, fileName })
                    });
                    const result = await res.json();
                    if (result.status === 'success') {
                        await this.saveVoiceLocal(result.id, blob, { name: fileName, date: Date.now(), formattedDate: new Date().toLocaleString(), lessonId: lessonId });
                        this.showToast("✅ Đã lưu ghi âm!");
                    }
                } catch (err) { 
                    this.showToast("❌ Lỗi Drive");
                }
                resolve();
            };
        });
    },

    async toggleVoiceList(syncFromServer = false) {
        const panel = this.getEl('voiceListPanel');
        if (!syncFromServer && panel.style.display === 'block') {
            panel.style.display = 'none';
            return;
        }
        panel.style.display = 'block';
        this.getEl('voiceItems').innerHTML = `<p style="text-align:center;padding:20px;">Đang kiểm tra dữ liệu...</p>`;

        const urlParams = new URLSearchParams(window.location.search);
        const lessonId = urlParams.get('id');
        if (!lessonId) {
            this.getEl('voiceItems').innerHTML = '<p style="text-align:center;padding:20px;">Không tìm thấy ID bài học.</p>';
            return;
        }

        try {
            // Luôn lấy danh sách từ server trước để biết ID nào đang tồn tại
            const res = await fetch(`${RECORD_GAS_URL}?type=listVoice&lessonId=${lessonId}`);
            const data = await res.json();
            let voiceFiles = data.data || [];

            // Nếu server trống và không phải yêu cầu đồng bộ, thử lấy từ local cũ
            if (voiceFiles.length === 0 && !syncFromServer) {
                const tx = this.db.transaction("voices", "readonly");
                const store = tx.objectStore("voices");
                voiceFiles = await new Promise(res => {
                    const req = store.getAll();
                    req.onsuccess = () => res(req.result.filter(v => (v.lessonId == lessonId) || (v.name && v.name.includes(`_${lessonId}_`))).sort((a,b) => (b.date || 0) - (a.date || 0)));
                });
            }

            if (voiceFiles.length > 0) {
                this.getEl('voiceItems').innerHTML = "";
                for (const f of voiceFiles) {
                    let local = await this.getVoiceLocal(f.id);
                    
                    // TỰ ĐỘNG GỌI SERVER: Nếu local chưa có file này, tải về ngay
                    if (!local && f.id) {
                        try {
                            const bRes = await fetch(`${RECORD_GAS_URL}?type=getFileBlob&fileId=${f.id}`);
                            const bData = await bRes.json();
                            if (bData.status === "success" && bData.data) {
                                const byteCharacters = atob(bData.data);
                                const byteNumbers = new Array(byteCharacters.length);
                                for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                                const blob = new Blob([new Uint8Array(byteNumbers)], { type: "audio/webm" });
                                await this.saveVoiceLocal(f.id, blob, { name: f.name, date: f.date, formattedDate: f.formattedDate, lessonId: lessonId });
                                local = { blob, formattedDate: f.formattedDate, name: f.name };
                            }
                        } catch (err) { console.error("Auto-fetch failed for", f.id); }
                    }

                    const url = local ? URL.createObjectURL(local.blob) : "";
                    const displayName = f.name || local?.name || 'Unknown File';
                    const item = document.createElement('div');
                    item.style.cssText = "display:flex; flex-direction:column; gap:2px; padding:8px; border-bottom:1px solid #f0f0f0;";
                    item.innerHTML = `
                        <div style="font-size:9px; color:#94a3b8; margin-bottom:2px;">ID: ${f.id}</div>
                        <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748b; margin-bottom:4px;">
                            <b style="color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${displayName}</b>
                            <span>${f.formattedDate || local?.formattedDate || ''}</span>
                        </div>
                        <audio controls style="height:32px; width:100%; outline:none;"><source src="${url}" type="audio/webm"></audio>
                    `;
                    this.getEl('voiceItems').appendChild(item);
                }
            } else {
                this.getEl('voiceItems').innerHTML = '<p style="text-align:center;padding:20px;">Chưa có bản ghi âm cho bài này.</p>';
            }
        } catch (e) {
            console.error("List error:", e);
            this.getEl('voiceItems').innerHTML = '<p style="text-align:center;padding:20px;color:red;">Lỗi kết nối hoặc dữ liệu.</p>';
        }
    },

    showToast(msg) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.8); color: white; padding: 10px 20px;
            border-radius: 20px; font-size: 12px; z-index: 10002;
            transition: opacity 0.5s; pointer-events: none;
        `;
        toast.innerText = msg;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 2000);
    },

    handleVoiceInput(text, isFinal) {
        if (isFinal) {
            this.highlightInBody(text);
            this.history.push(text);
        }
        this.currentInterim = text;
        this.updateUI();
    },

    highlightInBody(text) {
        const area = document.querySelector('.content-area.active');
        if (!area) return;
        const regex = new RegExp(`(${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const walk = document.createTreeWalker(area, NodeFilter.SHOW_TEXT, null, false);
        let node, nodes = [];
        while(node = walk.nextNode()) if (regex.test(node.textContent)) nodes.push(node);
        nodes.forEach(n => {
            const s = document.createElement('span');
            s.innerHTML = n.textContent.replace(regex, '<span style="background:#fef08a;font-weight:bold;">$1</span>');
            n.replaceWith(s);
        });
    },

    updateUI() {
        this.getEl('gameHistory').innerText = this.history.join(" ");
        this.getEl('gameCurrent').innerText = this.currentInterim;
    },

    resetUI() {
        this.history = [];
        if(this.getEl('gameHistory')) this.getEl('gameHistory').innerText = "";
        if(this.getEl('gameCurrent')) this.getEl('gameCurrent').innerText = "";
        if(this.getEl('gameScore')) this.getEl('gameScore').innerText = "0%";
    }
};

setTimeout(() => ShadowGame.init(), 1000);