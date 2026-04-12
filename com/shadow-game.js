/**
 * ShadowGame Module - Full Optimized & Fixed Audio Source
 */
const RECORD_GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";

export const ShadowGame = {
    isListening: false, history: [], currentInterim: "", recognition: null,
    mediaRecorder: null, audioChunks: [], db: null,
    lessonId: new URLSearchParams(window.location.search).get('id') || "unknown",

    getEl: (id) => document.getElementById(id),

    async api(params = {}, method = 'GET', body = null) {
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
            const req = action === 'put' ? store.put(data) : (action === 'get' ? store.get(data) : store.getAll());
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
                    <div id="gameCurrent" style="font-size: 13px; color:#4ade80; font-weight:600;"></div>
                </div>
                <div id="gameScore" style="font-weight:bold; color:#4ade80;">0/1000</div>
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
                <h3 style="text-align:center">Kết quả luyện tập</h3>
                <div id="finalScoreDisplay" style="font-size:32px; text-align:center; color:#10b981; font-weight:bold;">0/1000</div>
                <div id="scoreReasoning" style="font-size:14px; margin:15px 0; max-height:200px; overflow:auto; word-break:break-word;"></div>
                <button id="closeScore" style="width:100%; padding:10px; background:#1e293b; color:#fff; border-radius:8px; cursor:pointer;">Lưu & Đóng</button>
            </div>`;
        document.body.appendChild(wrap);
        document.body.style.paddingBottom = "80px";

        this.getEl('btnMic').onclick = () => this.toggle();
        this.getEl('btnList').onclick = () => this.toggleVoiceList();
        this.getEl('refreshList').onclick = () => this.toggleVoiceList(true);
        this.getEl('closeList').onclick = () => this.getEl('voiceListPanel').style.display = 'none';
        this.getEl('closeScore').onclick = () => this.getEl('scoreResultPanel').style.display = 'none';
    },

    async updateBadgeCounts() {
        try {
            const res = await this.api({ type: 'listVoice' });
            if (res.status === "success") {
                document.querySelectorAll("div.diary-date > span").forEach(el => el.innerText = "0");
                res.data.forEach(file => {
                    const lid = file.name.match(/Shadow_([^_]+)_/)?.[1];
                    const span = document.querySelector(`#item-${lid} div.diary-date span`);
                    if (span) span.innerText = (parseInt(span.innerText) || 0) + 1;
                });
            }
        } catch (e) { console.error("Badge update fail", e); }
    },

    async init() {
        await this.initDB(); 
        this.buildUI(); 
        this.injectRequiredClasses();

        // Load list counts sau 5s để đợi AJAX chính load xong
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
        this.isListening = true; this.history = []; this.audioChunks = [];
        this.getEl('gamePanel').style.display = 'flex';
        this.getEl('btnMic').innerHTML = '🛑';
        this.recognition?.start();

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
        this.mediaRecorder.onstop = async () => {
            const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
            await this.uploadToDrive(blob, this.getEl('gameScore').innerText);
            this.updateBadgeCounts();
            stream.getTracks().forEach(t => t.stop());
        };
        this.mediaRecorder.start();
    },

    stop() {
        this.isListening = false; this.getEl('btnMic').innerHTML = '🎤';
        this.recognition?.stop(); this.showFinalResult(); this.mediaRecorder?.stop();
    },

    async uploadToDrive(blob, score) {
        const reader = new FileReader(); reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            const browserScript = this.history.join(" ");
            
            let area = document.querySelector('.content-area.active');
            if (!area) {
                area = Array.from(document.querySelectorAll('.content-area')).find(el => getComputedStyle(el).display !== 'none');
            }
            const script = area ? area.innerText.trim() : "";
            
            const fileName = `Shadow_${this.lessonId}_${Date.now()}_${score.replace('/', '-')}.webm`;
            const res = await this.api({}, "POST", { 
                action: "uploadVoice", 
                base64, 
                fileName, 
                lessonId: this.lessonId, 
                score, 
                script: script, 
                browserScript: browserScript 
            });

            if (res.status === 'success') {
                await this.dbOp('readwrite', 'voices', 'put', { 
                    id: res.id, blob, name: fileName, 
                    date: Date.now(), 
                    formattedDate: new Date().toLocaleString(), 
                    lessonId: this.lessonId, 
                    score, 
                    script, 
                    browserScript 
                });
                this.showToast("✅ Đã lưu!");
            }
        };
    },

    async toggleVoiceList(sync = false) {
        const panel = this.getEl('voiceListPanel');
        if (!sync && panel.style.display === 'block') return panel.style.display = 'none';
        panel.style.display = 'block';
        const itemsWrap = this.getEl('voiceItems'); itemsWrap.innerHTML = "Đang tải...";

        // Lọc theo đúng lessonId hiện tại
        let files = sync ? [] : (await this.dbOp('readonly', 'voices', 'getAll')).filter(v => String(v.lessonId) === String(this.lessonId));
        if (sync || files.length === 0) {
            const res = await this.api({ type: 'listVoice', lessonId: this.lessonId });
            files = (res.data || []).filter(v => v.name?.includes(`Shadow_${this.lessonId}_`));
        }

        itemsWrap.innerHTML = "";
        files.sort((a,b) => (b.date || 0) - (a.date || 0)).forEach(async f => {
            const item = document.createElement('div');
            item.style.padding = "10px"; item.style.borderBottom = "1px solid #eee";
            let audioSrc = f.blob ? URL.createObjectURL(f.blob) : "";
            item.innerHTML = `
                <div style="font-size:11px; color:#64748b; margin-bottom:4px; word-break:break-all;">📄 ${f.name || 'Ghi âm mới'}</div>
                <div style="font-size:12px; display:flex; justify-content:space-between"><span>🕒 ${f.formattedDate || new Date(f.date).toLocaleString()}</span><b>${f.score || '0/1000'}</b></div>
                <audio controls src="${audioSrc}" style="width:100%; height:32px; margin-top:5px"></audio>
                <div style="text-align:right; margin-top:5px; display:flex; justify-content:space-between; align-items:center;">
                    <button class="ai-btn" style="font-size:10px; padding:2px 8px; border-radius:4px; border:1px solid #10b981; color:#10b981; background:#fff; cursor:pointer">🤖 AI Chấm</button>
                    <span class="del-btn" style="color:red; cursor:pointer; font-size:11px">🗑️ Xóa</span>
                </div>`;
            
            if (!audioSrc && f.id) {
                this.api({ type: 'getFileBlob', fileId: f.id }).then(res => {
                    if (res.data) {
                        const b = new Blob([new Uint8Array(atob(res.data).split("").map(c => c.charCodeAt(0)))], { type: "audio/webm" });
                        item.querySelector('audio').src = URL.createObjectURL(b);
                        this.dbOp('readwrite', 'voices', 'put', { ...f, blob: b, lessonId: this.lessonId });
                    }
                });
            }

            item.querySelector('.del-btn').onclick = () => this.deleteVoice(f.id, item);
            item.querySelector('.ai-btn').onclick = async (e) => {
                const btn = e.target;
                btn.disabled = true;
                btn.innerText = "Đang chấm...";
                
                const res = await this.api({}, "POST", { 
                    action: "assessVoice", 
                    fileId: f.id, 
                    script: f.script 
                });

                if (res.status === 'success') {
                    this.getEl('finalScoreDisplay').innerText = `${res.data.score}/1000`;
                    this.getEl('scoreReasoning').innerHTML = `
                        <p style="color:#1e293b; margin-bottom:10px"><b>AI Transcript:</b><br>${res.data.transcript}</p>
                        <p style="color:#1e293b"><b>Nhận xét:</b><br>${res.data.feedback}</p>
                    `;
                    this.getEl('scoreResultPanel').style.display = 'block';
                    btn.innerText = "Đã chấm";
                } else {
                    alert("Lỗi AI: " + res.message);
                    btn.disabled = false;
                    btn.innerText = "🤖 AI Chấm";
                }
            };

            itemsWrap.appendChild(item);
        });
    },

    async deleteVoice(id, el) {
        if (!confirm("Xóa bản ghi?")) return;
        const res = await this.api({}, "POST", { action: "deleteVoice", fileId: id });
        if (res.status === 'success') {
            const tx = this.db.transaction("voices", "readwrite"); tx.objectStore("voices").delete(id);
            el.remove(); this.updateBadgeCounts();
        }
    },

    handleVoiceInput(text, isFinal) {
        if (isFinal) { this.highlightInBody(text); this.history.push(text); }
        this.currentInterim = text;
        this.getEl('gameHistory').innerText = this.history.join(" ");
        this.getEl('gameCurrent').innerText = text;
    },

    highlightInBody(text) {
        let area = document.querySelector('.content-area.active');
        if (!area) area = Array.from(document.querySelectorAll('.content-area')).find(el => getComputedStyle(el).display !== 'none');
        if (!area) return;

        const walk = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
        let n; while(n = walk.nextNode()) {
            if (n.textContent.includes(text)) {
                const s = document.createElement('mark'); s.innerText = text;
                n.replaceWith(n.textContent.split(text)[0], s, n.textContent.split(text)[1]);
            }
        }
    },

    showFinalResult() {
        let area = document.querySelector('.content-area.active');
        if (!area) area = Array.from(document.querySelectorAll('.content-area')).find(el => getComputedStyle(el).display !== 'none');
        
        const targetWords = area?.innerText.trim().split(/[\s,.;:!?、。]+/).filter(w => w) || [];
        const spoken = this.history.join(" ").toLowerCase();
        let matches = 0;
        let html = targetWords.map(w => {
            const ok = spoken.includes(w.toLowerCase()); if (ok) matches++;
            return `<span style="color:${ok ? '#10b981' : '#ef4444'}">${w} </span>`;
        }).join("");
        const score = targetWords.length ? Math.round((matches / targetWords.length) * 1000) : 0;
        this.getEl('finalScoreDisplay').innerText = `${score}/1000`;
        this.getEl('scoreReasoning').innerHTML = html;
        this.getEl('scoreResultPanel').style.display = 'block';
        this.getEl('gameScore').innerText = `${score}/1000`;
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