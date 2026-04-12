/**
 * ShadowGame Module - Bottom Navigation Edition
 * Tự động chèn xuống cuối trang và đẩy nội dung lên để tránh che khuất.
 */
export const ShadowGame = {
    isListening: false,
    history: [],
    currentInterim: "",
    recognition: null,

    getEl(id) { return document.getElementById(id); },

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

    buildUI() {
        if (this.getEl('shadow-game-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.id = "shadow-game-wrapper";
        // Chuyển position thành fixed và bottom: 0
        wrapper.style.cssText = `
            display: flex; align-items: center; gap: 10px; padding: 8px 12px; 
            min-height: 60px; width: 100%; position: fixed; bottom: 0; left: 0;
            background: #ffffff; z-index: 9999; border-top: 2px solid #cbd5e1;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1); box-sizing: border-box;
        `;
        
        wrapper.innerHTML = `
            <button id="btnMic" title="Bắt đầu Shadowing" style="width: 42px; height: 42px; border-radius: 50%; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; padding: 0; transition: all 0.2s;">
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

        // Tự động đẩy padding cho body để không bị che nội dung
        document.body.style.paddingBottom = "70px";

        this.getEl('btnMic').onclick = () => this.toggle();
        console.log("[ShadowGame] UI Built at Bottom with auto-padding.");
    },

    init() {
        this.buildUI();
        this.injectRequiredClasses();

        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                setTimeout(() => {
                    this.injectRequiredClasses();
                    this.resetUI();
                }, 100);
            });
        });

        if (this.recognition) return;
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;

        this.recognition = new SR();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'ja-JP';

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    this.handleVoiceInput(event.results[i][0].transcript, true);
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            if (interimTranscript) this.handleVoiceInput(interimTranscript, false);
        };

        this.recognition.onend = () => { if (this.isListening) try { this.recognition.start(); } catch(e) {} };
    },

    toggle() { this.isListening ? this.stop() : this.start(); },

    start() {
        this.isListening = true;
        this.history = [];
        this.currentInterim = "";
        this.getEl('gamePanel').style.display = 'flex';
        const btn = this.getEl('btnMic');
        btn.style.background = '#fee2e2';
        btn.style.borderColor = '#ef4444';
        btn.innerHTML = '🛑';
        this.getEl('gameCurrent').innerText = "Đang lắng nghe...";
        try { this.recognition.start(); } catch(e) {}
    },

    stop() {
        this.isListening = false;
        const btn = this.getEl('btnMic');
        btn.style.background = '#fff';
        btn.style.borderColor = '#cbd5e1';
        btn.innerHTML = '🎤';
        if (this.recognition) this.recognition.stop();
    },

    resetUI() {
        this.history = [];
        this.currentInterim = "";
        if (this.getEl('gameHistory')) this.getEl('gameHistory').innerText = "";
        if (this.getEl('gameCurrent')) this.getEl('gameCurrent').innerText = "";
        if (this.getEl('gameScore')) this.getEl('gameScore').innerText = "0%";
        const active = document.querySelector('.content-area.active');
        if (active) active.querySelectorAll('.shadow-highlight').forEach(el => el.replaceWith(el.innerText));
    },

    handleVoiceInput(text, isFinal) {
        const input = text.trim();
        if (!input) return;
        if (isFinal) {
            this.highlightInBody(input);
            this.history.push(input);
            this.calculateScore();
        }
        this.currentInterim = input;
        this.updateUI();
    },

    highlightInBody(text) {
        const targetArea = document.querySelector('.content-area.active');
        if (!targetArea || !text) return;
        targetArea.querySelectorAll('.shadow-highlight').forEach(el => el.replaceWith(el.innerText));
        const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedText})`, 'gi');
        const walk = document.createTreeWalker(targetArea, NodeFilter.SHOW_TEXT, null, false);
        let node;
        const nodesToReplace = [];
        while(node = walk.nextNode()) { if (regex.test(node.textContent)) nodesToReplace.push(node); }
        nodesToReplace.forEach(node => {
            const span = document.createElement('span');
            span.innerHTML = node.textContent.replace(regex, '<span class="shadow-highlight" style="background-color: #fef08a; color: #1e293b; padding: 0 2px; border-radius: 2px; font-weight: bold;">$1</span>');
            node.replaceWith(span);
        });
    },

    updateUI() {
        const h = this.getEl('gameHistory');
        const c = this.getEl('gameCurrent');
        if (h) { h.innerText = this.history.join(" "); h.scrollLeft = h.scrollWidth; }
        if (c) { c.innerText = this.currentInterim; c.scrollLeft = c.scrollWidth; }
    },

    calculateScore() {
        const targetEl = document.querySelector('.content-area.active');
        if (!targetEl) return;
        const targetText = targetEl.textContent.trim();
        const spoken = this.history.join("");
        const score = Math.min(100, Math.round((spoken.length / targetText.length) * 100));
        if (this.getEl('gameScore')) this.getEl('gameScore').innerText = `${score}%`;
    }
};

setTimeout(() => ShadowGame.init(), 1000);