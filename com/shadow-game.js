/**
 * ShadowGame Module - Sử dụng link audio trực tiếp
 */

if (typeof marked === 'undefined') {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
    document.head.appendChild(script);
}

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
        console.log("[LOG] Initializing IndexedDB");
        return new Promise(res => {
            const req = indexedDB.open("ShadowVoiceDB", 1);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("voices")) {
                    db.createObjectStore("voices", { keyPath: "fileId" });
                }
                if (!db.objectStoreNames.contains("SCORE")) {
                    db.createObjectStore("SCORE", { keyPath: "id" });
                }
            };
            req.onsuccess = e => { this.db = e.target.result; res(); };
        });
    },

    async dbOp(mode, storeName, action, data) {
        console.log(`[LOG] DB Op: ${action} on ${storeName}`, data ? "with data" : "");
        const tx = this.db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        return new Promise((res, rej) => {
            let req;
            if (action === 'put') req = store.put(data);
            else if (action === 'get') req = store.get(data);
            else if (action === 'clear') req = store.clear();
            else if (action === 'delete') req = store.delete(data);
            else req = store.getAll();
            
            req.onsuccess = () => res(req.result);
            req.onerror = () => {
                console.error(`[ERR] DB Op Fail: ${action} on ${storeName}`);
                rej(req.error);
            };
        });
    },

    injectCSS() {
        const style = document.createElement('style');
        style.textContent = `
            #shadow-game-wrapper { display: flex; align-items: center; gap: 10px; padding: 8px 12px; min-height: 60px; width: 100%; position: fixed; bottom: 0; left: 0; background: #fff; z-index: 999; border-top: 2px solid #cbd5e1; box-sizing: border-box; }
            .sg-btn { width: 44px; height: 44px; border-radius: 50%; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink:0; user-select: none; }
            #gamePanel { display:none; flex-grow: 1; background:#1e293b; color:#f1f5f9; padding: 6px 14px; border-radius: 12px; align-items: center; gap: 10px; overflow: hidden; }
            .sg-panel { display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:90%; max-width:450px; background:white; border-radius:16px; padding:15px; box-shadow:0 10px 40px rgba(0,0,0,0.3); z-index:10001; }
            
            #iframeScorePanel { display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:white; z-index:20000; flex-direction:column; }
            .iframe-header { height:50px; display:flex; align-items:center; padding:0 15px; background:#f8f9fa; border-bottom:1px solid #ddd; }
            .back-btn { padding:8px 15px; background:#1e293b; color:white; border-radius:6px; border:none; cursor:pointer; font-size:14px; font-weight:bold; }
            #scoreIframe { flex-grow:1; border:none; width:100%; height:calc(100% - 50px); }
            .list-action-btn { cursor:pointer; font-size:13px; user-select:none; -webkit-user-select:none; padding: 2px 4px; }

            .content-area mark { background: #fef08a; font-weight: bold; }
            .ai-score-btn { background: #0ea5e9; color: white; padding: 4px 10px; border-radius: 6px; font-size: 10px; cursor: pointer; border: none; white-space: nowrap; font-weight: 600; }
            .ai-comment-btn { background: #64748b; color: white; padding: 4px 10px; border-radius: 6px; font-size: 10px; cursor: pointer; border: none; white-space: nowrap; }
            .voice-item-actions { display: flex; gap: 4px; align-items: center; }
            
            #aiReport { font-size:13px; line-height:1.6; color:#334155; }
            #aiReport h1, #aiReport h2, #aiReport h3 { color: #1e3799; margin-top: 15px; margin-bottom: 5px; }
            #aiReport ul, #aiReport ol { padding-left: 20px; }
            #aiReport table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 12px; }
            #aiReport table, #aiReport th, #aiReport td { border: 1px solid #ddd; padding: 6px; }
            #aiReport th { background-color: #f8f9fa; }
            #aiReport blockquote { border-left: 4px solid #cbd5e1; padding-left: 10px; font-style: italic; color: #64748b; }
            
            .full-screen-panel { width: 100vw !important; height: 100vh !important; max-width: 100vw !important; top: 0 !important; left: 0 !important; transform: none !important; border-radius: 0 !important; display: flex !important; flex-direction: column; }
            .full-screen-panel #scoreReasoning { flex-grow: 1; max-height: unset !important; }
            .score-badge { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 6px; font-weight: 800; font-size: 14px; border: 1px solid #bbf7d0; display: inline-block; min-width: 35px; text-align: center; }
            .voice-item { padding: 8px; border-bottom: 1px solid #f1f5f9; position: relative; }
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
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom: 5px;">
                    <span id="closeList" style="cursor:pointer; font-size:13px; color:#64748b; user-select:none;">✕ Đóng</span>
                    <b style="font-size:14px;">🎙️ List</b>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <span id="clearAndRefresh" class="list-action-btn" style="color:#ef4444;">🔥 Xóa & Tải</span>
                        <span id="refreshList" class="list-action-btn" style="color:#0ea5e9;">🔄 Tải lại</span>
                    </div>
                </div>
                <div id="voiceItems" style="max-height:65vh; overflow-y:auto;"></div>
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
            </div>
            <div id="iframeScorePanel">
                <div class="iframe-header">
                    <button id="btnBackFromIframe" class="back-btn">⬅ Trở về</button>
                    <span style="margin-left:auto; font-weight:bold; font-size:14px; color:#334155;">Phân tích & Chấm điểm</span>
                </div>
                <iframe id="scoreIframe"></iframe>
            </div>`;
        document.body.appendChild(wrap);
        document.body.style.paddingBottom = "80px";

        this.getEl('btnMic').onclick = () => this.toggle();
        this.getEl('btnList').onclick = () => this.toggleVoiceList();
        this.getEl('refreshList').onclick = () => this.toggleVoiceList(true);
        this.getEl('clearAndRefresh').onclick = () => this.clearAndRefresh();
        this.getEl('closeList').onclick = () => this.getEl('voiceListPanel').style.display = 'none';
        
        this.getEl('btnBackFromIframe').onclick = () => {
            this.getEl('iframeScorePanel').style.display = 'none';
            this.getEl('scoreIframe').src = 'about:blank';
        };

        this.getEl('cancelScore').onclick = () => {
            this.getEl('scoreResultPanel').style.display = 'none';
            this.getEl('scoreResultPanel').classList.remove('full-screen-panel');
        };
        this.getEl('saveScore').onclick = async () => {
            const area = document.querySelector('.content-area.active') || Array.from(document.querySelectorAll('.content-area')).find(el => getComputedStyle(el).display !== 'none');
            const script = area ? area.innerText.trim() : "";
            
            await this.dbOp('readwrite', 'SCORE', 'put', { 
                id: "SCORE-CHECK-INPUT",
                script: script,
                browserScript: this.history.join(" "),
                blob: this._tempBlob,
                lessonId: this.lessonId,
                date: Date.now()
            });

            await this.uploadToDrive(this._tempBlob);
            this.getEl('scoreResultPanel').style.display = 'none';
        };
    },

    async aiScoreVoice(fileId) {
        if (!fileId) return this.showToast("❌ Không có ID file.");
        const panel = this.getEl('iframeScorePanel');
        const iframe = this.getEl('scoreIframe');
        try {
            const currentData = await this.dbOp('readonly', 'voices', 'get', fileId);
            if (currentData) {
                await this.dbOp('readwrite', 'SCORE', 'put', { ...currentData, id: "SCORE-CHECK-INPUT" });
            }
            iframe.src = `checker.html?fileId=${encodeURIComponent(fileId)}`;
            panel.style.display = 'flex';
        } catch (err) {
            this.showToast("❌ Lỗi dữ liệu");
        }
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
        } catch (e) { console.error(e); }
    },

    async init() {
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
        setTimeout(() => this.updateBadgeCounts(), 3000);
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
            this.recognition.onend = () => { this.isListening && this.recognition.start(); };
        }
    },

    toggle() { this.isListening ? this.stop() : this.start(); },

    async start() {
        try {
            this.isListening = true; this.history = []; this.audioChunks = []; this._tempBlob = null;
            this.getEl('gamePanel').style.display = 'flex';
            this.getEl('btnMic').innerHTML = '🛑';
            this.recognition?.start();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) this.audioChunks.push(e.data); };
            this.mediaRecorder.onstop = async () => {
                const blob = new Blob(this.audioChunks, { type: 'audio/mp4' });
                this._tempBlob = blob;
                stream.getTracks().forEach(t => t.stop());
            };
            this.mediaRecorder.start();
        } catch (err) {
            this.showToast(`❌ Lỗi mic: ${err.message}`);
            this.stop();
        }
    },

    stop() {
        this.isListening = false; this.getEl('btnMic').innerHTML = '🎤';
        this.recognition?.stop(); this.showFinalResult(); this.mediaRecorder?.stop();
    },

    async clearAndRefresh() {
        if (!confirm("Xóa cache local bài học này?")) return;
        const allLocal = await this.dbOp('readonly', 'voices', 'getAll');
        const toDelete = allLocal.filter(v => String(v.lessonId) === String(this.lessonId));
        for (const item of toDelete) await this.dbOp('readwrite', 'voices', 'delete', item.fileId);
        this.toggleVoiceList(true);
    },

    async uploadToDrive(blob) {
        if (!blob || blob.size === 0) return;
        const reader = new FileReader(); reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            const browserScript = this.history.join(" ");
            let area = document.querySelector('.content-area.active') || Array.from(document.querySelectorAll('.content-area')).find(el => getComputedStyle(el).display !== 'none');
            const script = area ? area.innerText.trim() : "";
            const fileName = `Shadow_${this.lessonId}_${Date.now()}.mp4`;
            
            const res = await this.api({}, "POST", { 
                action: "uploadVoice", base64, fileName, lessonId: this.lessonId, 
                score: "N/A", script, browserScript 
            });
            if (res.status === 'success') {
                await this.dbOp('readwrite', 'voices', 'put', { 
                    fileId: res.id, blob, name: fileName, date: Date.now(), 
                    formattedDate: res.formattedDate, lessonId: this.lessonId, 
                    score: "N/A", script, browserScript, downloadUrl: res.downloadUrl
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
        itemsWrap.innerHTML = `<div style="padding:20px; text-align:center; color:#64748b; font-size:12px;">🔄 Đang tải...</div>`;
        
        const res = await this.api({ type: 'listVoice', lessonId: this.lessonId });
        const serverFiles = res.data || [];

        for (const f of serverFiles) {
            const existing = await this.dbOp('readonly', 'voices', 'get', f.fileId);
            await this.dbOp('readwrite', 'voices', 'put', { ...f, blob: existing?.blob || null, lessonId: this.lessonId });
        }
        
        let localFiles = await this.dbOp('readonly', 'voices', 'getAll');
        localFiles = localFiles.filter(v => String(v.lessonId) === String(this.lessonId));
        localFiles.sort((a, b) => (b.formattedDate || "").localeCompare(a.formattedDate || ""));

        itemsWrap.innerHTML = localFiles.length === 0 ? `<div style="padding:20px; text-align:center; color:#94a3b8; font-size:12px;">Chưa có bản ghi nào.</div>` : "";
        
        for (const f of localFiles) {
            const item = document.createElement('div');
            item.className = "voice-item";
            item.id = `voice-item-${f.fileId}`;
            let audioSrc = (f.blob && f.blob instanceof Blob) ? URL.createObjectURL(f.blob) : "";
            let scoreDisplay = (f.score && f.score !== "N/A" && f.score !== 0) ? `<span class="score-badge">${f.score}</span>` : `<span style="color:#94a3b8; font-size:10px;">---</span>`;
            
            const directAudioUrl = f.downloadUrl || `https://docs.google.com/uc?export=download&id=${f.fileId}`;

            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <div style="font-size:10px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:60%;">📄 ${f.name || 'Ghi âm mới'}</div>
                    <div class="load-status" style="font-size:9px; color:#f59e0b;">${f.blob ? '' : '⏳ Chờ tải...'}</div>
                    <span class="del-btn" style="color:#ef4444; cursor:pointer; font-size:12px; user-select:none;">🗑️</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <div style="flex-shrink:0;">${scoreDisplay}</div>
                    <div style="flex-grow:1; font-size:10px; color:#475569; line-height:1.2;">🕒 ${f.formattedDate}</div>
                    <div class="voice-item-actions" style="display:flex; gap:6px; align-items:center;">
                        ${f.aiFeedback ? `<button class="ai-comment-btn" title="Nhận xét">💬</button>` : ''}
                        <button class="ai-score-btn">🤖 Chấm</button>
                    </div>
                </div>
				<audio controls playsinline webkit-playsinline preload="none" style="width:100%; height:28px;">
                    <source src="${audioSrc}" type="audio/mpeg">
                </audio>
                <audio controls playsinline webkit-playsinline preload="none" style="width:100%; height:28px;">
                    <source src="${directAudioUrl}" type="audio/mpeg">
                </audio>`;
            
            item.querySelector('.ai-score-btn').onclick = () => this.aiScoreVoice(f.fileId);
            const commentBtn = item.querySelector('.ai-comment-btn');
            if (commentBtn) {
                commentBtn.onclick = () => {
                    const raw = f.aiFeedback || "(Chưa có nhận xét)";
                    this.getEl('aiReport').innerHTML = typeof marked !== 'undefined' ? marked.parse(raw) : raw;
                    this.getEl('scoreResultPanel').classList.add('full-screen-panel');
                    this.getEl('scoreResultPanel').style.display = 'block';
                    this.getEl('saveScore').style.display = 'none';
                };
            }
            item.querySelector('.del-btn').onclick = () => this.deleteVoice(f.fileId, item);
            itemsWrap.appendChild(item);

            if (!f.blob && f.fileId) {
                const statusEl = item.querySelector('.load-status');
                statusEl.innerText = "⏳ Đang tải...";
                try {
                    const resData = await this.api({ type: 'getFileBlob', fileId: f.fileId });
                    if (resData.data) {
                        const cleanBase64 = resData.data.replace(/\s/g, '');
                        const byteCharacters = atob(cleanBase64);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                        const b = new Blob([new Uint8Array(byteNumbers)], { type: "audio/mpeg" });
                        const aud = item.querySelector('audio');
                        if (aud) {
                            const source = aud.querySelector('source');
                            if(source) source.src = URL.createObjectURL(b);
                            aud.load(); 
                        }
                        await this.dbOp('readwrite', 'voices', 'put', { ...f, blob: b });
                        statusEl.innerText = "";
                    }
                } catch (e) {
                    statusEl.innerText = "❌ Lỗi";
                }
            }
        }
    },

    async deleteVoice(fileId, el) {
        if (!confirm("Xóa bản ghi này?")) return;
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
        const t = document.createElement('div'); t.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#fff; padding:6px 16px; border-radius:20px; z-index:10002; font-size:12px; backdrop-filter: blur(4px);";
        t.innerText = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2000);
    },

    injectRequiredClasses() {
        ['paragraphContainer', 'conversationContainer'].forEach(id => {
            const el = this.getEl(id); if (el) el.classList.add('content-area');
        });
    }
};

setTimeout(() => ShadowGame.init(), 1000);