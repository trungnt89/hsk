/**
 * ShadowGame Module - Full Integration (Recorder + Recognition + Auto-Injection)
 * Tác giả: Gemini BrSE Assistant
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";

export const ShadowGame = {
    isListening: false,
    history: [],
    currentInterim: "",
    recognition: null,
    mediaRecorder: null,
    audioChunks: [],

    getEl(id) { return document.getElementById(id); },

    // 1. Tự động tiêm các class cần thiết vào HTML hiện có
    injectRequiredClasses() {
        const containers = ['paragraphContainer', 'conversationContainer'];
        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.classList.contains('content-area')) {
                el.classList.add('content-area');
            }
        });
        
        const activeTab = document.querySelector('.tab-content.active .content-area');
        if (activeTab) {
            document.querySelectorAll('.content-area').forEach(a => a.classList.remove('active'));
            activeTab.classList.add('active');
        }
    },

    // 2. Tạo UI ở Bottom và đẩy Body Padding
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
            <button id="btnMic" title="Bắt đầu Shadowing" style="width: 44px; height: 44px; border-radius: 50%; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; padding: 0;">
                🎤
            </button>
            <div id="gamePanel" style="display:none; flex-grow: 1; background:#1e293b; color:#f1f5f9; padding: 6px 14px; border-radius: 12px; align-items: center; gap: 10px; overflow: hidden; border: 1px solid #334155;">
                <div style="flex-grow: 1; display: flex; flex-direction: column; overflow: hidden;">
                    <div id="gameHistory" style="font-size: 10px; color:#94a3b8; white-space: nowrap; overflow-x: auto; scrollbar-width: none; min-height: 12px;"></div>
                    <div id="gameCurrent" style="font-size: 13px; font-weight: 600; color:#4ade80; white-space: nowrap; overflow-x: auto; scrollbar-width: none; min-height: 18px;"></div>
                </div>
                <div style="border-left: 1px solid #475569; padding-left: 10px; display: flex; align-items: center; flex-shrink: 0;">
                    <span id="gameScore" style="font-weight:bold; color:#4ade80; font-size: 14px;">0%</span>
                </div>
            </div>
        `;

        document.body.appendChild(wrapper);
        document.body.style.paddingBottom = "80px"; // Đảm bảo không che nội dung chính

        this.getEl('btnMic').onclick = () => this.toggle();
        console.log("[ShadowGame] UI & Padding initialized.");
    },

    init() {
        this.buildUI();
        this.injectRequiredClasses();

        // Theo dõi chuyển tab
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                setTimeout(() => { this.injectRequiredClasses(); this.resetUI(); }, 150);
            });
        });

        // Setup Speech Recognition
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
        console.log("[ShadowGame] Starting Session...");
        this.isListening = true;
        this.history = [];
        this.audioChunks = [];
        this.getEl('gamePanel').style.display = 'flex';
        this.getEl('btnMic').innerHTML = '🛑';
        this.getEl('btnMic').style.borderColor = '#ef4444';

        // Khởi động Recognition
        try { this.recognition.start(); } catch(e) {}

        // Khởi động Recorder
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this.audioChunks.push(e.data); };
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.uploadToDrive(blob);
                stream.getTracks().forEach(t => t.stop());
            };
            this.mediaRecorder.start();
        } catch (err) {
            console.error("Mic access denied or error:", err);
        }
    },

    stop() {
        this.isListening = false;
        this.getEl('btnMic').innerHTML = '🎤';
        this.getEl('btnMic').style.borderColor = '#cbd5e1';
        if (this.recognition) this.recognition.stop();
        if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") this.mediaRecorder.stop();
    },

    async uploadToDrive(blob) {
        console.log("[ShadowGame] Uploading audio...");
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            // Lấy ID bài học từ localStorage hoặc tiêu đề
            const lessonId = localStorage.getItem("diary_selected_id") || "unknown";
            const fileName = `Shadow_${lessonId}_${new Date().getTime()}.webm`;

            try {
                const resp = await fetch(GAS_URL, {
                    method: "POST",
                    body: JSON.stringify({ action: "uploadVoice", base64: base64, fileName: fileName })
                });
                const result = await resp.json();
                console.log("[ShadowGame] Drive ID:", result.id);
            } catch (err) {
                console.error("[ShadowGame] Upload failed:", err);
            }
        };
    },

    handleVoiceInput(text, isFinal) {
        if (isFinal) {
            this.highlightInBody(text);
            this.history.push(text);
            this.calculateScore();
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
            s.innerHTML = n.textContent.replace(regex, '<span class="shadow-highlight" style="background:#fef08a;color:#1e293b;border-radius:2px;font-weight:bold;">$1</span>');
            n.replaceWith(s);
        });
    },

    updateUI() {
        this.getEl('gameHistory').innerText = this.history.join(" ");
        this.getEl('gameCurrent').innerText = this.currentInterim;
        this.getEl('gameHistory').scrollLeft = 9999;
        this.getEl('gameCurrent').scrollLeft = 9999;
    },

    calculateScore() {
        const area = document.querySelector('.content-area.active');
        if (!area) return;
        const score = Math.min(100, Math.round((this.history.join("").length / area.textContent.trim().length) * 100));
        this.getEl('gameScore').innerText = `${score}%`;
    },

    resetUI() {
        this.history = [];
        this.currentInterim = "";
        this.getEl('gameScore').innerText = "0%";
        this.getEl('gameHistory').innerText = "";
        this.getEl('gameCurrent').innerText = "";
    }
};

// Khởi chạy sau khi DOM ổn định
setTimeout(() => ShadowGame.init(), 1000);