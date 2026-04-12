/**
 * ShadowGame Module - Full Auto-Injection & Audio Upload
 */

const RECORD_GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";

export const ShadowGame = {
    isListening: false,
    history: [],
    currentInterim: "",
    recognition: null,
    mediaRecorder: null,
    audioChunks: [],

    getEl(id) { return document.getElementById(id); },

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
            <div id="voiceListPanel" style="display:none; position:absolute; bottom:70px; left:10px; right:10px; background:white; border:1px solid #ccc; border-radius:12px; padding:10px; max-height:300px; overflow-y:auto; box-shadow:0 -5px 15px rgba(0,0,0,0.1);">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                    <b style="font-size:14px;">Danh sách ghi âm</b>
                    <span id="closeList" style="cursor:pointer; padding:0 5px;">✕</span>
                </div>
                <div id="voiceItems" style="font-size:12px; color:#333;"></div>
            </div>
        `;

        document.body.appendChild(wrapper);
        document.body.style.paddingBottom = "80px";
        this.getEl('btnMic').onclick = () => this.toggle();
        this.getEl('btnList').onclick = () => this.toggleVoiceList();
        this.getEl('closeList').onclick = () => { this.getEl('voiceListPanel').style.display = 'none'; };
    },

    init() {
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
                this.uploadToDrive(blob);
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
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            
            const urlParams = new URLSearchParams(window.location.search);
            const lessonId = urlParams.get('id') || "unknown";
            const fileName = `Shadow_${lessonId}_${Date.now()}.webm`;

            try {
                const response = await fetch(RECORD_GAS_URL, {
                    method: "POST",
                    body: JSON.stringify({ action: "uploadVoice", base64, fileName })
                });
                
                if (response.ok) {
                    this.showToast("✅ Đã lưu ghi âm thành công!");
                }
                console.log("[ShadowGame] Log: File saved for ID", lessonId);
            } catch (err) { 
                this.showToast("❌ Lỗi khi lưu ghi âm");
                console.error("Upload failed", err); 
            }
        };
    },

    async toggleVoiceList() {
        const panel = this.getEl('voiceListPanel');
        if (panel.style.display === 'block') {
            panel.style.display = 'none';
            return;
        }
        panel.style.display = 'block';
        this.getEl('voiceItems').innerHTML = '<p style="text-align:center;padding:20px;">Đang tải danh sách...</p>';

        const urlParams = new URLSearchParams(window.location.search);
        const lessonId = urlParams.get('id');
        if (!lessonId) {
            this.getEl('voiceItems').innerHTML = '<p style="text-align:center;padding:20px;">Không tìm thấy ID bài học.</p>';
            return;
        }

        try {
            // Sử dụng type=listVoice để khớp với code GAS bạn vừa sửa
            const res = await fetch(`${RECORD_GAS_URL}?type=listVoice&lessonId=${lessonId}`);
            const data = await res.json();
            
            const voiceFiles = data.data || data.files || [];
            if (data.status === 'success' && voiceFiles.length > 0) {
                this.getEl('voiceItems').innerHTML = voiceFiles.map(f => `
                    <div style="display:flex; align-items:center; gap:10px; padding:8px; border-bottom:1px solid #f0f0f0;">
                        <span style="flex-grow:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f.formattedDate || f.name.split('_').pop()}</span>
                        <audio controls style="height:24px; width:150px; outline:none;"><source src="${f.url}" type="audio/webm"></audio>
                    </div>
                `).join('');
            } else {
                this.getEl('voiceItems').innerHTML = '<p style="text-align:center;padding:20px;">Chưa có bản ghi âm nào.</p>';
            }
        } catch (e) {
            this.getEl('voiceItems').innerHTML = '<p style="text-align:center;padding:20px;color:red;">Lỗi tải dữ liệu.</p>';
        }
    },

    showToast(msg) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.8); color: white; padding: 10px 20px;
            border-radius: 20px; font-size: 13px; z-index: 10000;
            transition: opacity 0.5s; pointer-events: none;
        `;
        toast.innerText = msg;
        document.body.appendChild(toast);
        setTimeout(() => { 
            toast.style.opacity = '0'; 
            setTimeout(() => toast.remove(), 500); 
        }, 2000);
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
        this.getEl('gameHistory').innerText = "";
        this.getEl('gameCurrent').innerText = "";
        this.getEl('gameScore').innerText = "0%";
    }
};

setTimeout(() => ShadowGame.init(), 1000);