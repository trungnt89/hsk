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
        console.log("Log: Saving to IndexedDB -> ID:", id, "Meta:", metadata);
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
                <div id="gameScore" style="font-weight:bold; color:#4ade80;">0/1000</div>
            </div>
            <div id="voiceListPanel" style="display:none; position:fixed; top:10px; left:10px; right:10px; background:white; border:1px solid #cbd5e1; border-radius:12px; padding:10px; max-height:70vh; overflow-y:auto; box-shadow:0 5px 25px rgba(0,0,0,0.2); z-index:10001;">
                <div style="display:flex; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:8px; gap:15px;">
                    <span id="closeList" style="cursor:pointer; font-size:20px;" title="Đóng">✕</span>
                    <span id="refreshList" style="cursor:pointer; font-size:18px;" title="Lấy mới từ server">🔄</span>
                    <b style="font-size:14px; flex-grow:1; text-align:right;">🎙️ Danh sách ghi âm</b>
                </div>
                <div id="voiceItems" style="font-size:12px; color:#333;"></div>
            </div>
            <div id="scoreResultPanel" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:90%; max-width:400px; background:white; border-radius:16px; padding:20px; box-shadow:0 10px 40px rgba(0,0,0,0.3); z-index:10005; border:1px solid #e2e8f0;">
                <div style="text-align:center; margin-bottom:15px;">
                    <h3 style="margin:0; color:#1e293b;">Kết quả luyện tập</h3>
                    <div id="finalScoreDisplay" style="font-size:32px; font-weight:bold; color:#10b981; margin:10px 0;">0/1000</div>
                </div>
                <div style="font-size:12px; font-weight:bold; color:#64748b; margin-bottom:5px;">Văn bản đã ghi nhận:</div>
                <div id="spokenResultText" style="font-size:14px; padding:10px; background:#f1f5f9; border-radius:8px; margin-bottom:15px; border:1px dashed #cbd5e1; max-height:100px; overflow-y:auto; color:#1e293b;"></div>
                <div style="font-size:12px; font-weight:bold; color:#64748b; margin-bottom:5px;">So sánh với bản gốc:</div>
                <div id="scoreReasoning" style="font-size:14px; line-height:1.6; max-height:200px; overflow-y:auto; padding:10px; background:#f8fafc; border-radius:8px; border:1px solid #f1f5f9; margin-bottom:15px; word-break: break-word;"></div>
                <button id="closeScore" style="width:100%; padding:10px; background:#1e293b; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">Đóng & Lưu</button>
            </div>
        `;

        document.body.appendChild(wrapper);
        document.body.style.paddingBottom = "80px";
        this.getEl('btnMic').onclick = () => this.toggle();
        this.getEl('btnList').onclick = () => this.toggleVoiceList();
        this.getEl('refreshList').onclick = () => this.toggleVoiceList(true);
        this.getEl('closeList').onclick = () => { this.getEl('voiceListPanel').style.display = 'none'; };
        this.getEl('closeScore').onclick = () => { this.getEl('scoreResultPanel').style.display = 'none'; };
    },

    async init() {
        console.log("Log: Initializing ShadowGame module...");
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
        console.log("Log: Recording started");
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
                const score = this.getEl('gameScore').innerText;
                console.log("Log: Recording stopped. Final Score:", score);
                this.uploadToDrive(blob, score).then(() => {
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
        this.showFinalResult();
        if (this.mediaRecorder) this.mediaRecorder.stop();
    },

    async uploadToDrive(blob, score = "0/1000") {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64 = reader.result.split(',')[1];
                const urlParams = new URLSearchParams(window.location.search);
                const lessonId = urlParams.get('id') || "unknown";
                
                const fileName = `Shadow_${lessonId}_${Date.now()}_${score.replace('/', '-')}.webm`;
                console.log("Log: Uploading file with name:", fileName);

                try {
                    const res = await fetch(RECORD_GAS_URL, {
                        method: "POST",
                        body: JSON.stringify({ action: "uploadVoice", base64, fileName, score })
                    });
                    const result = await res.json();
                    if (result.status === 'success') {
                        await this.saveVoiceLocal(result.id, blob, { name: fileName, date: Date.now(), formattedDate: new Date().toLocaleString(), lessonId: lessonId, score: score });
                        this.showToast("✅ Đã lưu ghi âm!");
                    }
                } catch (err) { 
                    console.error("Log: Upload error:", err);
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
            let voiceFiles = [];
            const tx = this.db.transaction("voices", "readonly");
            const store = tx.objectStore("voices");
            const localFiles = await new Promise(res => {
                const req = store.getAll();
                req.onsuccess = () => res(req.result.filter(v => (v.lessonId == lessonId) || (v.name && v.name.includes(`_${lessonId}_`))).sort((a,b) => (b.date || 0) - (a.date || 0)));
            });

            if (syncFromServer) {
                console.log("Log: Refreshing - Clearing local records for lesson:", lessonId);
                const deleteTx = this.db.transaction("voices", "readwrite");
                const deleteStore = deleteTx.objectStore("voices");
                for (const localF of localFiles) {
                    if (localF.id) deleteStore.delete(localF.id);
                }
                await new Promise(r => deleteTx.oncomplete = r);
                
                console.log("Log: Syncing fresh records from server");
                const res = await fetch(`${RECORD_GAS_URL}?type=listVoice&lessonId=${lessonId}`);
                const data = await res.json();
                voiceFiles = data.data || [];
            } else if (localFiles.length > 0) {
                voiceFiles = localFiles;
                console.log("Log: Loading local records");
            } else {
                console.log("Log: No local records, syncing from server");
                const res = await fetch(`${RECORD_GAS_URL}?type=listVoice&lessonId=${lessonId}`);
                const data = await res.json();
                voiceFiles = data.data || [];
            }

            if (voiceFiles.length > 0) {
                this.getEl('voiceItems').innerHTML = "";
                for (const f of voiceFiles) {
                    let local = await this.getVoiceLocal(f.id);
                    
                    if (!local && f.id) {
                        try {
                            const bRes = await fetch(`${RECORD_GAS_URL}?type=getFileBlob&fileId=${f.id}`);
                            const bData = await bRes.json();
                            if (bData.status === "success" && bData.data) {
                                const byteCharacters = atob(bData.data);
                                const byteNumbers = new Array(byteCharacters.length);
                                for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                                const blob = new Blob([new Uint8Array(byteNumbers)], { type: "audio/webm" });
                                await this.saveVoiceLocal(f.id, blob, { name: f.name, date: f.date, formattedDate: f.formattedDate, lessonId: lessonId, score: f.score || '0/1000' });
                                local = { blob, formattedDate: f.formattedDate, name: f.name, score: f.score };
                            }
                        } catch (err) { console.error("Blob download failed", f.id); }
                    }

                    const url = local ? URL.createObjectURL(local.blob) : "";
                    const rawName = f.name || local?.name || 'Unknown File';
                    const displayName = rawName.replace('.webm', '');
                    const scoreMatch = rawName.match(/(\d+(\/\d+)?%?)/);
                    const extractedScore = scoreMatch ? scoreMatch[0].replace('-', '/') : (f.score || local?.score || '0/1000');

                    const item = document.createElement('div');
                    item.style.cssText = "display:flex; flex-direction:column; gap:2px; padding:8px; border-bottom:1px solid #f0f0f0;";
                    item.innerHTML = `
                        <div style="font-size:9px; color:#94a3b8; margin-bottom:2px; display:flex; justify-content:space-between;">
                            <span>ID: ${f.id}</span>
                            <span style="color:#64748b;">🕒 ${f.formattedDate || local?.formattedDate || new Date(f.date).toLocaleString() || ''}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-bottom:4px;">
                            <b style="color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:70%;">${displayName}</b>
                            <span style="background:#dcfce7; color:#166534; padding:2px 6px; border-radius:4px; font-weight:bold;">⭐ ${extractedScore}</span>
                        </div>
                        <audio controls style="height:32px; width:100%; outline:none;"><source src="${url}" type="audio/webm"></audio>
                    `;
                    this.getEl('voiceItems').appendChild(item);
                }
            } else {
                this.getEl('voiceItems').innerHTML = '<p style="text-align:center;padding:20px;">Chưa có bản ghi âm cho bài này.</p>';
            }
        } catch (e) {
            console.error("Log: List error:", e);
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

    showFinalResult() {
        const area = document.querySelector('.content-area.active');
        if (!area) return;

        console.log("Log: Processing Final Results...");
        const originalText = area.innerText.trim();
        const targetWords = originalText.split(/[\s,.;:!?、。]+/).filter(w => w.length > 0);
        const fullSpokenText = this.history.join(" ");
        const spokenTextLower = fullSpokenText.toLowerCase();
        
        let resultHtml = "";
        let matchCount = 0;

        targetWords.forEach(word => {
            const cleanWord = word.toLowerCase();
            const isMatch = spokenTextLower.includes(cleanWord);
            if (isMatch) matchCount++;
            
            resultHtml += `<span style="color: ${isMatch ? '#10b981' : '#ef4444'}; font-weight: ${isMatch ? 'bold' : 'normal'}">${word} </span>`;
        });

        const score = targetWords.length > 0 ? Math.min(1000, Math.round((matchCount / targetWords.length) * 1000)) : 0;
        
        // Hiển thị text đã chuyển đổi từ voice
        if (this.getEl('spokenResultText')) {
            this.getEl('spokenResultText').innerText = fullSpokenText || "(Không ghi nhận được âm thanh)";
        }

        this.getEl('finalScoreDisplay').innerText = `${score}/1000`;
        this.getEl('scoreReasoning').innerHTML = resultHtml;
        this.getEl('scoreResultPanel').style.display = 'block';
        
        this.getEl('gameScore').innerText = `${score}/1000`;
        console.log(`Log: Mapping complete. Score: ${score}. Matches: ${matchCount}/${targetWords.length}`);
    },

    updateUI() {
        if(this.getEl('gameHistory')) this.getEl('gameHistory').innerText = this.history.join(" ");
        if(this.getEl('gameCurrent')) this.getEl('gameCurrent').innerText = this.currentInterim;
    },

    resetUI() {
        console.log("Log: UI Reset");
        this.history = [];
        if(this.getEl('gameHistory')) this.getEl('gameHistory').innerText = "";
        if(this.getEl('gameCurrent')) this.getEl('gameCurrent').innerText = "";
        if(this.getEl('gameScore')) this.getEl('gameScore').innerText = "0/1000";
    }
};

setTimeout(() => ShadowGame.init(), 1000);