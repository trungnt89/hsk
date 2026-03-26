/**
 * ShadowGame Module - Fix Lỗi Lặp Từ & Tự nạp Window
 * Giải quyết lỗi: Hiện tại -> Hiện tại xã hội
 */
export const ShadowGame = {
    isListening: false,
    history: [],
    recognition: null,

    init() {
        if (this.recognition) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("LOG: [ShadowGame] Trình duyệt không hỗ trợ Speech API.");
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

        this.recognition.onerror = (e) => {
            if (e.error !== 'aborted') console.error("LOG: [Speech Error]", e.error);
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                try { this.recognition.start(); } catch(e) {}
            }
        };
    },

    toggle() {
        console.log("LOG: [ShadowGame] Toggle. Trạng thái hiện tại:", this.isListening);
        if (!this.isListening) this.start();
        else this.stop();
    },

    start() {
        this.init();
        this.isListening = true;
        this.history = []; 
        
        const panel = document.getElementById('gamePanel');
        const btn = document.getElementById('btnMic');
        const interim = document.getElementById('gameInterim');

        if (panel) panel.style.display = 'flex';
        if (btn) {
            btn.innerHTML = '🛑 Dừng';
            btn.classList.add('listening');
        }
        if (interim) interim.innerText = "Đang lắng nghe...";
        
        try { this.recognition.start(); } catch(e) {
            console.warn("LOG: Recognition đã chạy.");
        }
    },

    stop() {
        this.isListening = false;
        const btn = document.getElementById('btnMic');
        if (btn) {
            btn.innerHTML = '🎤 Luyện';
            btn.classList.remove('listening');
        }
        if (this.recognition) this.recognition.stop();
        console.log("LOG: [ShadowGame] Đã dừng.");
    },

    /**
     * LOGIC FIX LẶP TỪ
     */
    handleVoiceInput(text, isFinal) {
        const input = text ? text.trim() : "";
        if (!input) return;

        let lastIdx = this.history.length - 1;
        let lastItem = lastIdx >= 0 ? this.history[lastIdx] : null;

        // Kiểm tra nếu input mới là bản bồi đắp của câu cũ
        // Ví dụ: lastItem = "Hiện tại", input = "Hiện tại xã hội"
        if (lastItem && (input.startsWith(lastItem) || lastItem.startsWith(input))) {
            if (input.length > lastItem.length) {
                this.history[lastIdx] = input; // Ghi đè câu cũ bằng bản dài hơn
            }
        } else {
            // Nếu là cụm từ mới hoàn toàn hoặc quãng nghỉ mới
            if (lastItem !== input) {
                this.history.push(input);
            }
        }

        this.updateUI();
        if (isFinal) this.calculateScore();
    },

    updateUI() {
        const el = document.getElementById('gameInterim');
        if (el) {
            el.innerText = this.history.join(" → ");
            el.scrollTop = el.scrollHeight;
        }
    },

    calculateScore() {
        const targetEl = document.getElementById('content-text');
        const scoreEl = document.getElementById('gameScore');
        if (!targetEl || !scoreEl) return;

        const target = targetEl.textContent.trim();
        const spoken = this.history.join("");
        
        const clean = (s) => s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()？、。]/g, "").replace(/\s/g, "");
        const t = clean(target);
        const s = clean(spoken);
        
        if (!t) return;
        let matches = 0;
        for (let char of s) { if (t.includes(char)) matches++; }
        
        const result = Math.min(100, Math.round((matches / t.length) * 100));
        scoreEl.innerText = `${result}%`;
    }
};

// ĐƯA VÀO WINDOW ĐỂ HTML GỌI ĐƯỢC NGAY
if (typeof window !== 'undefined') {
    window.ShadowGame = ShadowGame;
}