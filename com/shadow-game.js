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

    // Tìm vị trí chèn UI: Ưu tiên thẻ h3 trong nội dung, nếu không thấy chèn vào display-box
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
        // Tránh tạo trùng lặp UI
        if (this.getEl('shadow-game-wrapper')) return;

        const target = this.findBestAnchor();
        if (!target) {
            // Thử lại sau nếu nội dung chưa kịp render
            setTimeout(() => this.buildUI(), 500);
            return;
        }

        this.anchor = target;
        const wrapper = document.createElement('div');
        wrapper.id = "shadow-game-wrapper";
        // Giao diện hàng ngang (flex) để tiết kiệm chiều cao
        wrapper.style.cssText = "display: flex; align-items: center; gap: 8px; margin: 8px 0; min-height: 36px; width: 100%;";
        
        wrapper.innerHTML = `
            <button id="btnMic" title="Bắt đầu Shadowing" style="width: 34px; height: 34px; border-radius: 50%; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.2s; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 0;">
                🎤
            </button>
            <div id="gamePanel" style="display:none; flex-grow: 1; background:#1e293b; color:#f1f5f9; padding: 4px 12px; border-radius: 20px; align-items: center; gap: 8px; overflow: hidden; border: 1px solid #334155;">
                <div id="gameInterim" style="flex-grow: 1; font-size: 12px; line-height: 1.2; max-height: 24px; color:#cbd5e1; white-space: nowrap; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none;"></div>
                <div style="border-left: 1px solid #334155; padding-left: 8px; display: flex; align-items: center; flex-shrink: 0;">
                    <span id="gameScore" style="font-weight:bold; color:#4ade80; font-size: 13px;">0%</span>
                </div>
            </div>
        `;

        // Chèn vào trang
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
        if (!SpeechRecognition) {
            console.error("LOG: [ShadowGame] Speech API not supported.");
            return;
        }

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
            if (this.isListening) {
                try { this.recognition.start(); } catch(e) {}
            }
        };

        // Lắng nghe sự kiện render xong từ HTML để reset hoặc vẽ lại UI
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
        if (panel) panel.style.display = 'flex';
        if (btn) {
            btn.style.background = '#fee2e2';
            btn.style.borderColor = '#ef4444';
            btn.innerHTML = '🛑';
        }
        const interim = this.getEl('gameInterim');
        if (interim) interim.innerText = "Listening...";
        
        try {
            this.recognition.start();
        } catch(e) { console.warn("LOG: [ShadowGame] Already started."); }
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
        const interim = this.getEl('gameInterim');
        const score = this.getEl('gameScore');
        const panel = this.getEl('gamePanel');
        
        if (interim) interim.innerText = "";
        if (score) score.innerText = "0% ";
        if (panel && !this.isListening) panel.style.display = 'none';
        
        // Nếu UI bị bay mất (do innerHTML trang cha), thực hiện chèn lại
        if (!this.getEl('shadow-game-wrapper')) this.buildUI();
    },

    handleVoiceInput(text, isFinal) {
        const input = text.trim();
        if (!input) return;

        const lastIdx = this.history.length - 1;
        // Chống trùng lặp từ interim kết quả
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
            // Tự động cuộn sang phải nếu text quá dài (cho white-space: nowrap)
            el.scrollLeft = el.scrollWidth;
        }
    },

    calculateScore() {
        const targetEl = document.querySelector('.content-area.active');
        // Lấy text thuần, loại bỏ các ký tự đặc biệt của nút bấm nếu bị dính vào
        const rawText = targetEl ? targetEl.textContent : "";
        const targetText = rawText.split('🎤')[0].trim();
        
        const spoken = this.history.join("");
        if (!targetText || !spoken) return;

        // Tính toán tỉ lệ độ dài cơ bản
        const score = Math.min(100, Math.round((spoken.length / targetText.length) * 100));
        const scoreEl = this.getEl('gameScore');
        if (scoreEl) scoreEl.innerText = `${score}%`;
    }
};

// Tự khởi chạy khi module được load
ShadowGame.init();