/**
 * ShadowGame Module - Hỗ trợ xóa sạch IndexedDB khi Tải lại
 */
const RECORD_GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";

export const ShadowGame = {
    isListening: false, history: [], currentInterim: "", recognition: null,
    mediaRecorder: null, audioChunks: [], db: null, _tempBlob: null,
    
    get lessonId() {
        return new URLSearchParams(window.location.search).get('id') || "unknown";
    },

    getEl: (id) => document.getElementById(id),

    async api(params = {}, method = 'GET', body = null) {
        console.log(`[LOG] API Call: ${method}`, params);
        const url = new URL(RECORD_GAS_URL);
        if (method === 'GET') Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
        const res = await fetch(url, { method, body: body ? JSON.stringify(body) : null });
        return res.json();
    },

    async initDB() {
        return new Promise(res => {
            const req = indexedDB.open("ShadowVoiceDB", 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore("voices", { keyPath: "id" });
            req.onsuccess = e => { this.db = e.target.result; res(); };
        });
    },

    async dbOp(mode, storeName, action, data) {
        const tx = this.db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        return new Promise(res => {
            let req;
            if (action === 'put') req = store.put(data);
            else if (action === 'get') req = store.get(data);
            else if (action === 'clear') req = store.clear();
            else if (action === 'delete') req = store.delete(data);
            else req = store.getAll();
            req.onsuccess = () => res(req.result);
        });
    },

    injectCSS() {
        const style = document.createElement('style');
        style.textContent = `
            #shadow-game-wrapper { display: flex; align-items: center; gap: 10px; padding: 8px 12px; min-height: 60px; width: 100%; position: fixed; bottom: 0; left: 0; background: #fff; z-index: 999; border-top: 2px solid #cbd5e1; box-sizing: border-box; }
            .sg-btn { width: 44px; height: 44px; border-radius: 50%; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink:0; }
            #gamePanel { display:none; flex-grow: 1; background:#1e293b; color:#f1f5f9; padding: 6px 14px; border-radius: 12px; align-items: center; gap: 10px; overflow: hidden; }
            .sg-panel { display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:90%; max-width:450px; background:white; border-radius:16px; padding:15px; box-shadow:0 10px 40px rgba(0,0,0,0.3); z-index:10001; }
            .content-area mark { background: #fef08a; font-weight: bold; }
            .ai-score-btn { background: #0ea5e9; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer; border: none; white-space: nowrap; }
            .ai-comment-btn { background: #64748b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer; border: none; white-space: nowrap; }
            .voice-item-actions { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; justify-content: flex-end; }
            #aiReport { font-size:13px; line-height:1.5; color:#334155; white-space: pre-wrap; margin-top:10px; }
        `;
        document.head.appendChild(style);
    },

    buildUI() {
        if (this.getEl('shadow-game-wrapper')) return;
        this.injectCSS();
        const wrap = document.createElement('div'); wrap.id = "shadow-game-wrapper";
        wrap.innerHTML = `
            <button id="btnMic" class="sg-btn">🎤</button>
            <button id="btnList" class="sg-btn">📜</button>
            <div id="gamePanel">
                <div style="flex-grow: 1; overflow: hidden; font-size: 10px;">
                    <div id="gameHistory" style="color:#94a3b8; white-space: nowrap;"></div>
                    <div id="gameCurrent" style="font-size: 13px; color:#4ade80; font-weight:600;">...</div>
                </div>
            </div>
            <div id="voiceListPanel" class="sg-panel">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #eee;">
                    <span id="closeList" style="cursor:pointer">✕ Đóng</span>
                    <b>🎙️ Ghi âm</b>
                    <span id="refreshList" style="cursor:pointer">🔄 Tải lại</span>
                </div>
                <div id="voiceItems" style="max-height:60vh; overflow-y:auto;"></div>
            </div>
            <div id="scoreResultPanel" class="sg-panel" style="z-index:10005;">
                <h3 style="text-align:center">🤖 Phân tích & Chấm điểm</h3>
                <div id="scoreReasoning" style="font-size:14px; margin:15px 0; max-height:300px; overflow:auto; word-break:break-word; line-height:1.6; color:#334155; border:1px solid #e2e8f0; padding:10px; border-radius:8px;">
                    <div id="aiReport"></div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button id="cancelScore" style="flex:1; padding:12px; background:#f1f5f9; color:#475569; border-radius:8px; cursor:pointer; border:1px solid #cbd5e1; font-weight:600;">Đóng</button>
                    <button id="saveScore" style="flex:1; padding:12px; background:#1e293b; color:#fff; border-radius:8px; cursor:pointer; border:none; font-weight:600;">Lưu</button>
                </div>
            </div>`;
        document.body.appendChild(wrap);
        document.body.style.paddingBottom = "80px";

        this.getEl('btnMic').onclick = () => this.toggle();
        this.getEl('btnList').onclick = () => this.toggleVoiceList();
        this.getEl('refreshList').onclick = () => this.toggleVoiceList(true);
        this.getEl('closeList').onclick = () => this.getEl('voiceListPanel').style.display = 'none';
        
        this.getEl('cancelScore').onclick = () => {
            this.getEl('scoreResultPanel').style.display = 'none';
        };
        this.getEl('saveScore').onclick = async () => {
            await this.uploadToDrive(this._tempBlob);
            this.getEl('scoreResultPanel').style.display = 'none';
        };
    },

    async aiScoreVoice(fileId) {
        if (!fileId) return this.showToast("❌ Không có ID file.");

        console.log(`[LOG] Chuyển tới trang chấm điểm cho fileId: ${fileId}`);
        
        // Đường dẫn đến file HTML chấm điểm
        const checkerUrl = "checker.html"; 
        const finalUrl = `${checkerUrl}?fileId=${encodeURIComponent(fileId)}`;
        
        // Mở trang chấm điểm trong tab mới
        window.open(finalUrl, '_blank');
        this.showToast("🚀 Đang mở trang phân tích...");
    },

    async updateBadgeCounts() {
        try {
            const res = await this.api({ type: 'countVoiceByLesson' });
            if (res.status === "success") {
                document.querySelectorAll("div.diary-date > span").forEach(el => el.innerText = "0");
                for (const [lessonId, count] of Object.entries(res.data)) {
                    const span = document.querySelector(`#item-${lessonId} div.diary-date span`);
                    if (span) span.innerText = count;
                }
            }
        } catch (e) { console.error("Badge update fail", e); }
    },

    async init() {
        console.log("[LOG] ShadowGame Init");
        await this.initDB(); 
        this.buildUI(); 
        this.injectRequiredClasses();
        this._lastLessonId = this.lessonId;
        setInterval(() => {
            if (this.lessonId !== this._lastLessonId) {
                this._lastLessonId = this.lessonId;
                this.updateBadgeCounts();
            }
        }, 2000);
        setTimeout(() => this.updateBadgeCounts(), 5000);
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
            this.recognition = new SR(); this.recognition.continuous = true; this.recognition.interimResults = true; this.recognition.lang = 'ja-JP';
            this.recognition.onresult = e => {
                let interim = '';
                for (let i = e.resultIndex; i < e.results.length; ++i) {
                    if (e.results[i].isFinal) this.handleVoiceInput(e.results[i][0].transcript, true);
                    else interim += e.results[i][0].transcript;
                }
                if (interim) this.handleVoiceInput(interim, false);
            };
            this.recognition.onend = () => this.isListening && this.recognition.start();
        }
    },

    toggle() { this.isListening ? this.stop() : this.start(); },

    async start() {
        this.isListening = true; this.history = []; this.audioChunks = []; this._tempBlob = null;
        this.getEl('gamePanel').style.display = 'flex';
        this.getEl('btnMic').innerHTML = '🛑';
        this.recognition?.start();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
        this.mediaRecorder.onstop = async () => {
            const blob = new Blob(this.audioChunks, { type: 'audio/mp4' });
            this._tempBlob = blob;
            stream.getTracks().forEach(t => t.stop());
        };
        this.mediaRecorder.start();
    },

    stop() {
        this.isListening = false; this.getEl('btnMic').innerHTML = '🎤';
        this.recognition?.stop(); this.showFinalResult(); this.mediaRecorder?.stop();
    },

    async uploadToDrive(blob) {
        if (!blob) return;
        const reader = new FileReader(); reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            const browserScript = this.history.join(" ");
            let area = document.querySelector('.content-area.active') || Array.from(document.querySelectorAll('.content-area')).find(el => getComputedStyle(el).display !== 'none');
            const script = area ? area.innerText.trim() : "";
            const fileName = `Shadow_${this.lessonId}_${Date.now()}.mp4`;
            
            console.log("[LOG] Uploading to Drive...");
            const res = await this.api({}, "POST", { 
                action: "uploadVoice", base64, fileName, lessonId: this.lessonId, 
                score: "N/A", script: script, browserScript: browserScript 
            });
            if (res.status === 'success') {
                await this.dbOp('readwrite', 'voices', 'put', { 
                    id: res.id, blob, name: fileName, date: Date.now(), 
                    formattedDate: res.formattedDate, lessonId: this.lessonId, 
                    score: "N/A", script, browserScript 
                });
                this.updateBadgeCounts();
                this.showToast("✅ Đã lưu!");
            }
        };
    },

    async toggleVoiceList(sync = false) {
        const panel = this.getEl('voiceListPanel');
        if (!sync && panel.style.display === 'block') return panel.style.display = 'none';
        panel.style.display = 'block';
        const itemsWrap = this.getEl('voiceItems'); 
        itemsWrap.innerHTML = `<div style="padding:20px; text-align:center; color:#64748b;">🔄 Đang tải...</div>`;
        
        if (sync) {
            console.log("[LOG] Xóa toàn bộ IndexedDB để đồng bộ mới từ server...");
            await this.dbOp('readwrite', 'voices', 'clear');
        }
        
        let localFiles = await this.dbOp('readonly', 'voices', 'getAll');
        localFiles = localFiles.filter(v => String(v.lessonId) === String(this.lessonId));
        
        if (sync || localFiles.length === 0) {
            const res = await this.api({ type: 'listVoice', lessonId: this.lessonId });
            const serverFiles = res.data || [];
            for (const f of serverFiles) {
                const existing = await this.dbOp('readonly', 'voices', 'get', f.id);
                if (!existing) await this.dbOp('readwrite', 'voices', 'put', { ...f, lessonId: this.lessonId });
                else await this.dbOp('readwrite', 'voices', 'put', { ...existing, ...f });
            }
            localFiles = await this.dbOp('readonly', 'voices', 'getAll');
            localFiles = localFiles.filter(v => String(v.lessonId) === String(this.lessonId));
        }

        itemsWrap.innerHTML = localFiles.length === 0 ? `<div style="padding:20px; text-align:center; color:#94a3b8;">Chưa có bản ghi nào.</div>` : "";
        
        localFiles.sort((a, b) => (b.formattedDate || "").localeCompare(a.formattedDate || "")).forEach(async f => {
            const item = document.createElement('div');
            item.style.padding = "10px"; item.style.borderBottom = "1px solid #eee";
            let audioSrc = f.blob ? URL.createObjectURL(f.blob) : "";
            let scoreDisplay = (f.score && f.score !== "N/A" && f.score !== 0) ? `<b style="color:#059669">${f.score}</b>` : `<span style="color:#94a3b8">---</span>`;
            
            item.innerHTML = `
                <div style="font-size:11px; color:#64748b; margin-bottom:4px; word-break:break-all;">📄 ${f.name || 'Ghi âm mới'}</div>
                <div style="font-size:11px; display:flex; justify-content:space-between; align-items: flex-start; gap: 5px;">
                    <span style="flex: 1;">🕒 ${f.formattedDate} <br> ⭐: ${scoreDisplay}</span>
                    <div class="voice-item-actions">
                        ${f.aiFeedback ? `<button class="ai-comment-btn">💬 Nhận xét</button>` : ''}
                        <button class="ai-score-btn">🤖 Chấm điểm</button>
                    </div>
                </div>
                <audio controls playsinline webkit-playsinline src="${audioSrc}" style="width:100%; height:32px; margin-top:5px"></audio>
                <div style="text-align:right; margin-top:5px;"><span class="del-btn" style="color:red; cursor:pointer; font-size:11px">🗑️ Xóa</span></div>`;
            
            if (!audioSrc && f.fileId) {
                this.api({ type: 'getFileBlob', fileId: f.fileId }).then(res => {
                    if (res.data) {
                        const b = new Blob([new Uint8Array(atob(res.data).split("").map(c => c.charCodeAt(0)))], { type: "audio/mp4" });
                        const aud = item.querySelector('audio');
                        if (aud) aud.src = URL.createObjectURL(b);
                        this.dbOp('readwrite', 'voices', 'put', { ...f, blob: b });
                    }
                });
            }

            item.querySelector('.ai-score-btn').onclick = () => this.aiScoreVoice(f.fileId);
            const commentBtn = item.querySelector('.ai-comment-btn');
            if (commentBtn) {
                commentBtn.onclick = () => {
                    this.getEl('aiReport').innerText = f.aiFeedback;
                    this.getEl('scoreResultPanel').style.display = 'block';
                    this.getEl('saveScore').style.display = 'none';
                };
            }
            item.querySelector('.del-btn').onclick = () => this.deleteVoice(f.fileId, item);
            itemsWrap.appendChild(item);
        });
    },

    async deleteVoice(fileId, el) {
        if (!confirm("Xóa bản ghi?")) return;
        console.log(`[LOG] Deleting voice: ${fileId}`);
        const res = await this.api({}, "POST", { action: "deleteVoice", fileId: fileId });
        if (res.status === 'success') {
            await this.dbOp('readwrite', 'voices', 'delete', fileId);
            el.remove(); this.updateBadgeCounts();
        }
    },

    handleVoiceInput(text, isFinal) {
        this.currentInterim = text;
        this.getEl('gameHistory').innerText = this.history.join(" ");
        this.getEl('gameCurrent').innerText = text;
        if (isFinal) this.history.push(text);
    },

    showFinalResult() {
        const spokenText = this.history.join(" ");
        this.getEl('aiReport').innerText = spokenText || "(Không có âm thanh)";
        this.getEl('scoreResultPanel').style.display = 'block';
        this.getEl('saveScore').style.display = 'block';
    },

    showToast(m) {
        const t = document.createElement('div'); t.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#333; color:#fff; padding:5px 15px; border-radius:15px; z-index:10002; font-size:12px";
        t.innerText = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2000);
    },

    injectRequiredClasses() {
        ['paragraphContainer', 'conversationContainer'].forEach(id => {
            const el = this.getEl(id); if (el) el.classList.add('content-area');
        });
    }
};

setTimeout(() => ShadowGame.init(), 1000);