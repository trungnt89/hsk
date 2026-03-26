/**
 * ShadowGame Module - Standalone Version
 * Tích hợp trực tiếp Speech Recognition, không dùng module ngoài.
 */
export const ShadowGame = {
    isListening: false,
    history: [],
    recognition: null,
    
    getEl(id) { return document.getElementById(id); },

    // Khởi tạo engine nhận diện giọng nói
    init() {
        if (this.recognition) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.");
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

        this.recognition.onerror = (e) => console.error("LOG: [Recognition Error]", e.error);
        this.recognition.onend = () => {
            if (this.isListening) this.recognition.start(); // Tự động restart nếu chưa bấm dừng
        };
    },

    toggle() {
        console.log("LOG: [ShadowGame] Toggle. State:", this.isListening);
        if (!this.isListening) this.start();
        else this.stop();
    },

    start() {
        this.init();
        if (!this.recognition) return;

        this.isListening = true;
        this.history = [];
        this.getEl('gamePanel').style.display = 'flex';
        this.getEl('btnMic').innerHTML = '🛑 Dừng';
        this.getEl('gameInterim').innerText = "Đang lắng nghe...";

        this.recognition.start();
        console.log("LOG: [ShadowGame] Đã bắt đầu nhận diện.");
    },

    stop() {
        this.isListening = false;
        this.getEl('btnMic').innerHTML = '🎤 Luyện';
        if (this.recognition) this.recognition.stop();
        console.log("LOG: [ShadowGame] Đã dừng.");
    },

    handleVoiceInput(text, isFinal) {
        const input = text ? text.trim() : "";
        if (!input) return;

        const lastItem = this.history[this.history.length - 1];

        // LOGIC LỌC TRÙNG (Sửa lỗi lặp từ trong ảnh bạn gửi)
        if (lastItem && (input.startsWith(lastItem) || lastItem.startsWith(input))) {
            if (input.length > lastItem.length) {
                this.history[this.history.length - 1] = input;
            }
        } else {
            if (lastItem !== input) this.history.push(input);
        }

        this.updateUI();
        if (isFinal) this.calculateScore();
    },

    updateUI() {
        const el = this.getEl('gameInterim');
        if (el) {
            el.innerText = this.history.join(" → ");
            el.scrollTop = el.scrollHeight;
        }
    },

    calculateScore() {
        const target = this.getEl('content-text').textContent.trim();
        const spoken = this.history.join("");
        const score = Math.min(100, Math.round((spoken.length / target.length) * 100));
        this.getEl('gameScore').innerText = `${score}%`;
    }
};