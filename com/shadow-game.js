/**
 * ShadowGame Module - Autonomous UI Injection
 * Tự động tìm vị trí chèn UI mà không cần can thiệp vào HTML chính.
 */
export const ShadowGame = {
    isListening: false,
    history: [],
    recognition: null,
    anchor: null,

    getEl(id) { return document.getElementById(id); },

    // Tự động tìm điểm chèn tốt nhất trên trang
    findBestAnchor() {
        // Ưu tiên 1: Thẻ h3 trong vùng nội dung
        // Ưu tiên 2: Vùng hiển thị văn bản chính
        // Ưu tiên 3: Cuối thanh toolbar
        return document.querySelector('#content-text h3') || 
               document.querySelector('.display-box') || 
               document.querySelector('.compact-toolbar');
    },

    buildUI() {
        if (this.getEl('btnMic')) return; // Tránh chèn trùng lặp

        const target = this.findBestAnchor();
        if (!target) {
            console.warn("LOG: [ShadowGame] Chưa tìm thấy điểm neo, đang thử lại...");
            setTimeout(() => this.buildUI(), 500);
            return;
        }

        this.anchor = target;
        const wrapper = document.createElement('div');
        wrapper.id = "shadow-game-wrapper";
        wrapper.style.margin = "10px 0";
        wrapper.innerHTML = `
            <button id="btnMic" style="padding:8px 16px; border-radius:6px; border:1px solid #cbd5e1; background:#fff; cursor:pointer; font-size:13px; font-weight:600; display:flex; align-items:center; gap:5px;">
                <span>🎤</span> Luyện Shadowing
            </button>
            <div id="gamePanel" style="display:none; background:#1e293b; color:#f1f5f9; padding:12px; margin-top:8px; border-radius:8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                <div id="gameInterim" style="max-height:80px; overflow-y:auto; font-size:15px; line-height:1.5; margin-bottom:8px; color:#cbd5e1;"></div>
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #334155; pt-8">
                    <span style="font-size:11px; color:#94a3b8;">Tiến độ nhận diện:</span>
                    <span id="gameScore" style="font-weight:bold; color:#4ade80; font-size:16px;">0%</span>
                </div>
            </div>
        `;

        // Chèn vào trang: Nếu là h3 thì chèn sau, nếu là box thì chèn vào đầu
        if (target.tagName === 'H3') {
            target.insertAdjacentElement('afterend', wrapper);
        } else {
            target.prepend(wrapper);
        }
        
        this.getEl('btnMic').onclick = () => this.toggle();
        console.log("LOG: [ShadowGame] UI injected successfully.");
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

        // Lắng nghe sự kiện đổi trang để xóa dữ liệu cũ
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
        if (panel) panel.style.display = 'block';
        if (btn) {
            btn.style.background = '#fee2e2';
            btn.style.borderColor = '#ef4444';
            btn.innerHTML = '🛑 Dừng nhận diện';
        }
        this.getEl('gameInterim').innerText = "Đang lắng nghe...";
        this.recognition.start();
    },

    stop() {
        this.isListening = false;
        const btn = this.getEl('btnMic');
        if (btn) {
            btn.style.background = '#fff';
            btn.style.borderColor = '#cbd5e1';
            btn.innerHTML = '<span>🎤</span> Luyện Shadowing';
        }
        if (this.recognition) this.recognition.stop();
    },

    resetUI() {
        this.history = [];
        const interim = this.getEl('gameInterim');
        const score = this.getEl('gameScore');
        if (interim) interim.innerText = "";
        if (score) score.innerText = "0%";
        // Nếu chuyển trang mà UI bị mất (do innerHTML của cha), tự vẽ lại
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
            el.scrollTop = el.scrollHeight;
        }
    },

    calculateScore() {
        // Tự động tìm text mục tiêu từ vùng hiển thị
        const targetEl = document.querySelector('.content-area.active');
        const targetText = targetEl ? targetEl.textContent.replace(/🎤 Luyện Shadowing.*/s, '').trim() : "";
        const spoken = this.history.join("");
        if (!targetText) return;

        const score = Math.min(100, Math.round((spoken.length / targetText.length) * 100));
        this.getEl('gameScore').innerText = `${score}%`;
    }
};

// Tự kích hoạt khi module được import
ShadowGame.init();