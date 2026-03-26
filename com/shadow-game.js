/**
 * ShadowGame Module - Compact UI Edition
 * Tối ưu hiển thị 2 dòng: Lịch sử và Nội dung hiện tại.
 */
export const ShadowGame = {
    isListening: false,
    history: [],
    currentInterim: "",
    recognition: null,
    anchor: null,

    getEl(id) { return document.getElementById(id); },

    findBestAnchor() {
        const activeContent = document.querySelector('.content-area.active');
        if (activeContent) {
            return activeContent.querySelector('h3') || activeContent;
        }
        return document.querySelector('#content-text h3') || 
               document.querySelector('.display-box') || 
               document.querySelector('.compact-toolbar');
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
        wrapper.style.cssText = "display: flex; align-items: center; gap: 8px; margin: 8px 0; min-height: 40px; width: 100%;";
        
        wrapper.innerHTML = `
            <button id="btnMic" title="Bắt đầu Shadowing" style="width: 36px; height: 36px; border-radius: 50%; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.2s; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 0;">
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

        if (target.tagName === 'H3') {
            target.insertAdjacentElement('afterend', wrapper);
        } else {
            target.prepend(wrapper);
        }
        
        this.getEl('btnMic').onclick = () => this.toggle();
        console.log("LOG: [ShadowGame] 2-line UI injected.");
    },

    init() {
        this.buildUI();
        if (this.recognition) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'ja-JP';

        this.recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    this.handleVoiceInput(transcript, true);
                } else {
                    interim += transcript;
                }
            }
            if (interim) this.handleVoiceInput(interim, false);
        };

        this.recognition.onend = () => {
            if (this.isListening) try { this.recognition.start(); } catch(e) {}
        };

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
        const hist = this.getEl('gameHistory');
        const curr = this.getEl('gameCurrent');
        const score = this.getEl('gameScore');
        if (hist) hist.innerText = "";
        if (curr) curr.innerText = "";
        if (score) score.innerText = "0%";
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
        const histEl = this.getEl('gameHistory');
        const currEl = this.getEl('gameCurrent');
        
        if (histEl) {
            histEl.innerText = this.history.join(" ");
            histEl.scrollLeft = histEl.scrollWidth;
        }
        
        if (currEl) {
            currEl.innerText = this.currentInterim;
            currEl.scrollLeft = currEl.scrollWidth;
        }
    },

    calculateScore() {
        const targetEl = document.querySelector('.content-area.active');
        const rawText = targetEl ? targetEl.textContent : "";
        const targetText = rawText.split('🎤')[0].trim();
        const spoken = this.history.join("");
        if (!targetText || !spoken) return;

        const score = Math.min(100, Math.round((spoken.length / targetText.length) * 100));
        const scoreEl = this.getEl('gameScore');
        if (scoreEl) score