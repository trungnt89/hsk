/**
 * ShadowGame Module - Top-Aligned 2-Line UI
 */
export const ShadowGame = {
    isListening: false,
    history: [],
    currentInterim: "",
    recognition: null,
    anchor: null,

    getEl(id) { return document.getElementById(id); },

    // Luôn nhắm tới đầu display-box để nằm trên top
    findBestAnchor() {
        return document.querySelector('.display-box');
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
        wrapper.style.cssText = "display: flex; align-items: center; gap: 8px; margin-bottom: 10px; min-height: 42px; width: 100%; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;";
        
        wrapper.innerHTML = `
            <button id="btnMic" title="Bắt đầu Shadowing" style="width: 38px; height: 38px; border-radius: 50%; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 0;">
                🎤
            </button>
            <div id="gamePanel" style="display:none; flex-grow: 1; background:#1e293b; color:#f1f5f9; padding: 4px 12px; border-radius: 12px; align-items: center; gap: 8px; overflow: hidden; border: 1px solid #334155;">
                <div style="flex-grow: 1; display: flex; flex-direction: column; overflow: hidden;">
                    <div id="gameHistory" style="font-size: 10px; color:#94a3b8; white-space: nowrap; overflow-x: auto; scrollbar-width: none; min-height: 12px;"></div>
                    <div id="gameCurrent" style="font-size: 13px; font-weight: 500; color:#4ade80; white-space: nowrap; overflow-x: auto; scrollbar-width: none; min-height: 16px;"></div>
                </div>
                <div style="border-left: 1px solid #334155; padding-left: 8px; display: flex; align-items: center; flex-shrink: 0;">
                    <span id="gameScore" style="font-weight:bold; color:#4ade80; font-size: 13px;">0%</span>
                </div>
            </div>
        `;

        target.prepend(wrapper);
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
        this.getEl('gamePanel').style.display = 'flex';
        const btn = this.getEl('btnMic');
        if (btn) {
            btn.style.background = '#fee2e2';
            btn.style.borderColor = '#ef4444';
            btn.innerHTML = '🛑';
        }
        this.getEl('gameCurrent').innerText = "Listening...";
        this.getEl('gameHistory').innerText = "";
        try { this.recognition.start(); } catch(e) {}
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