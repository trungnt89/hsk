/**
 * ShadowGame Module - Bản hoàn chỉnh Fix Lặp Từ & Đồng Bộ
 * Nguyên tắc: Bất biến logic hiển thị, chỉ sửa cơ chế lọc chuỗi.
 */
const ShadowGame = {
    isListening: false,
    history: [],
    recognition: null,

    init() {
        if (this.recognition) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("LOG: Trình duyệt không hỗ trợ Speech API");
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
                    console.log("LOG: [Final]", transcript);
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
    },

    toggle() {
        console.log("LOG: [ShadowGame] Toggle clicked. Current state:", this.isListening);
        if (!this.isListening) this.start();
        else this.stop();
    },

    start() {
        this.init();
        this.isListening = true;
        this.history = [];
        document.getElementById('gamePanel').style.display = 'flex';
        document.getElementById('btnMic').innerHTML = '🛑 Dừng';
        document.getElementById('btnMic').classList.add('listening');
        document.getElementById('gameInterim').innerText = "Đang lắng nghe...";
        this.recognition.start();
    },

    stop() {
        this.isListening = false;
        document.getElementById('btnMic').innerHTML = '🎤 Luyện';
        document.getElementById('btnMic').classList.remove('listening');
        if (this.recognition) this.recognition.stop();
    },

    handleVoiceInput(text, isFinal) {
        const input = text ? text.trim() : "";
        if (!input) return;

        let lastIdx = this.history.length - 1;
        let lastItem = lastIdx >= 0 ? this.history[lastIdx] : null;

        // LOGIC SỬA LỖI LẶP TỪ (Triệt tiêu bồi đắp văn bản)
        if (lastItem && (input.startsWith(lastItem) || lastItem.startsWith(input))) {
            if (input.length > lastItem.length) {
                this.history[lastIdx] = input; // Ghi đè câu dài hơn
            }
        } else {
            if (lastItem !== input) {
                this.history.push(input); // Thêm câu mới hoàn toàn
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
        
        // Tính điểm dựa trên số ký tự khớp
        const clean = (s) => s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()？、。]/g, "").replace(/\s/g, "");
        const t = clean(target);
        const s = clean(spoken);
        
        let matches = 0;
        for (let char of s) { if (t.includes(char)) matches++; }
        const result = t.length > 0 ? Math.min(100, Math.round((matches / t.length) * 100)) : 0;
        
        scoreEl.innerText = `${result}%`;
        console.log(`LOG: Accuracy ${result}%`);
    }
};

// Xuất ra window để HTML gọi được ngay lập tức
window.ShadowGame = ShadowGame;