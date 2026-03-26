/**
 * ShadowGame Module - Compact UI Edition
 * Nút bấm dạng icon tròn, cỡ chữ nhỏ tối ưu diện tích.
 */
export const ShadowGame = {
    isListening: false,
    history: [],
    recognition: null,
    anchor: null,

    getEl(id) { return document.getElementById(id); },

    findBestAnchor() {
        return document.querySelector('#content-text h3') || 
               document.querySelector('.display-box') || 
               document.querySelector('.compact-toolbar');
    },

    buildUI() {
        if (this.getEl('btnMic')) return;

        const target = this.findBestAnchor();
        if (!target) {
            setTimeout(() => this.buildUI(), 500);
            return;
        }

        this.anchor = target;
        const wrapper = document.createElement('div');
        wrapper.id = "shadow-game-wrapper";
        wrapper.style.cssText = "display: flex; align-items: center; gap: 8px; margin: 5px 0;";
        
        wrapper.innerHTML = `
            <button id="btnMic" title="Bắt đầu Shadowing" style="width: 34px; height: 34px; border-radius: 50%; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.2s; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                🎤
            </button>
            <div id="gamePanel" style="display:none; flex-grow: 1; background:#1e293b; color:#f1f5f9; padding: 6px 10px; border-radius: 20px; align-items: center; gap: 8px;">
                <div id="gameInterim" style="flex-grow: 1; font-size: 12px; line-height: 1.2; max-height: 28px; overflow-y: auto; color:#cbd5e1; white-space: nowrap; overflow-x: auto; scrollbar-width: none;"></div>
                <div style="border-left: 1px solid #334155; padding-left: 8px; display: flex; align-items: center;">
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
        console.log("LOG: [ShadowGame] Compact UI injected.");
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
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    this.handleVoiceInput(transcript, true);
                } else {
                    interimTranscript += transcript;
                    this.handleVoiceInput(interimTranscript, false);
                }
            }
        };

        this.recognition.onend = () => {
            if (this.isListening) this.recognition.start();
        };

        window.addEventListener('renderFinished', () => this.resetUI());
    },

    toggle() {
        this.isListening ? this.stop() : this.start();
    },

    start() {
        this.isListening = true;
        this.history = [];
        const panel = this.getEl('gamePanel');
        const btn = this.getEl('btnMic');
        if (panel) panel.style.display = 'flex'; // Dùng flex để nằm ngang với nút
        if (btn) {
            btn.style.background = '#fee2e2';
            btn.style.borderColor = '#ef4444';
            btn.innerHTML = '🛑';
        }
        this.getEl('gameInterim').innerText = "Listening...";
        this.recognition.start();
    },

    stop() {
        this.isListening = false;
        const btn = this.getEl('btnMic');
        const panel = this.getEl('gamePanel');
        if (btn) {
            btn.style.background = '#fff';
            btn.style.borderColor = '#cbd5e1';
            btn.innerHTML = '🎤';
        }
        // Giữ panel hiển thị kết quả cuối cùng một lát hoặc có thể ẩn tùy ý
        if (this.recognition) this.recognition.stop();
    },

    resetUI() {
        this.history = [];
        const interim = this.getEl('gameInterim');
        const score = this.getEl('gameScore');
        if (interim) interim.innerText = "";
        if (score) score.innerText = "0%";
        if (!this.getEl('btnMic')) this.buildUI();
    },

    handleVoiceInput(text, isFinal) {
        const input = text.trim();
        if (!input) return;
        const lastIdx = this.history.length - 1;
        if (this.history[lastIdx] && (input.includes(this.history[lastIdx]))) {
            this.history[lastIdx] = input;
        } else {
            this.history.push(input);
        }
        this.updateUI();
        if (isFinal) this.calculateScore();
    },

    updateUI() {
        const el = this.getEl('gameInterim');
        if (el) {
            el.innerText = this.history.join(" ");
            // Cuộn ngang để xem text mới nhất trong không gian hẹp
            el.scrollLeft = el.scrollWidth;
        }
    },

    calculateScore() {
        const targetEl = document.querySelector('.content-area.active');
        // Loại bỏ text của module khỏi mục tiêu tính điểm
        const targetText = targetEl ? targetEl.textContent.split('🎤')[0].trim() : "";
        const spoken = this.history.join("");
        if (!targetText) return;

        const score = Math.min(100, Math.round((spoken.length / targetText.length) * 100));
        this.getEl('gameScore').innerText = `${score}%`;
    }
};

ShadowGame.init();