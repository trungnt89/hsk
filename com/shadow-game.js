/**
 * ShadowGame Module - Fixed Top Navigation Edition
 * Cố định tại vùng khoanh đỏ, không bị trôi khi cuộn.
 */
export const ShadowGame = {
    isListening: false,
    history: [],
    currentInterim: "",
    recognition: null,
    anchor: null,

    getEl(id) { return document.getElementById(id); },

    // Tìm vùng điều hướng trên cùng
    findBestAnchor() {
        return document.querySelector('.compact-toolbar') || 
               document.querySelector('.nav-header') || 
               document.querySelector('.display-box');
    },

    buildUI() {
        if (this.getEl('shadow-game-wrapper')) return;

        const target = this.findBestAnchor();
        if (!target) {
            setTimeout(() => this.buildUI(), 500);
            return;
        }

        this.anchor = target;
        const wrapper = document.createElement('div');
        wrapper.id = "shadow-game-wrapper";
        // position: sticky và top: 0 để luôn dính chặt ở đỉnh vùng khoanh đỏ
        wrapper.style.cssText = `
            display: flex; 
            align-items: center; 
            gap: 10px; 
            padding: 6px 12px; 
            min-height: 48px; 
            width: 100%; 
            position: sticky; 
            top: 0; 
            background: #ffffff; 
            z-index: 9999; 
            border-bottom: 2px solid #cbd5e1;
            box-shadow: 0 2px 5px rgba(0,0,0,0.08);
            box-sizing: border-box;
        `;
        
        wrapper.innerHTML = `
            <button id="btnMic" title="Bắt đầu Shadowing" style="width: 38px; height: 38px; border-radius: 50%; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 0; transition: all 0.2s;">
                🎤
            </button>
            <div id="gamePanel" style="display:none; flex-grow: 1; background:#1e293b; color:#f1f5f9; padding: 4px 14px; border-radius: 10px; align-items: center; gap: 10px; overflow: hidden; border: 1px solid #334155;">
                <div style="flex-grow: 1; display: flex; flex-direction: column; overflow: hidden;">
                    <div id="gameHistory" style="font-size: 10px; color:#94a3b8; white-space: nowrap; overflow-x: auto; scrollbar-width: none; min-height: 12px; opacity: 0.8;"></div>
                    <div id="gameCurrent" style="font-size: 13px; font-weight: 600; color:#4ade80; white-space: nowrap; overflow-x: auto; scrollbar-width: none; min-height: 18px;"></div>
                </div>
                <div style="border-left: 1px solid #475569; padding-left: 10px; display: flex; align-items: center; flex-shrink: 0;">
                    <span id="gameScore" style="font-weight:bold; color:#4ade80; font-size: 14px;">0%</span>
                </div>
            </div>
        `;

        // Chèn vào đầu trang (phía trên toolbar hiện tại)
        target.parentElement.prepend(wrapper);

        this.getEl('btnMic').onclick = () => this.toggle();
    },

    init() {
        this.buildUI();
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
        window.addEventListener('renderFinished', () => this.resetUI());
    },

    toggle() { this.isListening ? this.stop() : this.start(); },

    start() {
        this.isListening = true;
        this.history = [];
        this.currentInterim = "";
        const panel = this.getEl('gamePanel');
        const btn = this.getEl('btnMic');
        if (panel) panel.style.display = 'flex';
        if (btn) {
            btn.style.background = '#fee2e2';
            btn.style.borderColor = '#ef4444';
            btn.innerHTML = '🛑';
        }
        this.getEl('gameCurrent').innerText = "Đang lắng nghe...";
        this.getEl('gameHistory').innerText = "";
        try { this.recognition.start(); } catch(e) { console.error("Mic error:", e); }
    },

    stop() {
        this.isListening = false;
        const btn = this.getEl('btnMic');
        if (btn) {
            btn.style.background = '#fff';
            btn.style.borderColor = '#cbd5e1';
            btn.innerHTML = '🎤';
        }
        if (this.recognition) this.recognition.stop();
    },

    resetUI() {
        this.history = [];
        this.currentInterim = "";
        if (this.getEl('gameHistory')) this.getEl('gameHistory').innerText = "";
        if (this.getEl('gameCurrent')) this.getEl('gameCurrent').innerText = "";
        if (this.getEl('gameScore')) this.getEl('gameScore').innerText = "0%";
        if (this.getEl('gamePanel') && !this.isListening) this.getEl('gamePanel').style.display = 'none';
        if (!this.getEl('shadow-game-wrapper')) this.buildUI();
    },

    handleVoiceInput(text, isFinal) {
        const input = text.trim();
        if (!input) return;
        if (isFinal) {
            this.history.push(input);
            this.calculateScore();
        }
        this.currentInterim = input;
        this.updateUI();
    },

    updateUI() {
        const h = this.getEl('gameHistory');
        const c = this.getEl('gameCurrent');
        if (h) { h.innerText = this.history.join(" "); h.scrollLeft = h.scrollWidth; }
        if (c) { c.innerText = this.currentInterim; c.scrollLeft = c.scrollWidth; }
    },

    calculateScore() {
        const targetEl = document.querySelector('.content-area.active');
        const targetText = targetEl ? targetEl.textContent.split('🎤')[0].trim() : "";
        const spoken = this.history.join("");
        if (!targetText || !spoken) return;
        const score = Math.min(100, Math.round((spoken.length / targetText.length) * 100));
        if (this.getEl('gameScore')) this.getEl('gameScore').innerText = `${score}%`;
    }
};

ShadowGame.init();