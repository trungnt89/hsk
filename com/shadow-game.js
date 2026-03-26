/**
 * ShadowGame Module - Full Standalone Version
 * Tích hợp nhận diện giọng nói và logic lọc trùng văn bản.
 */
const ShadowGame = {
    isListening: false,
    history: [],
    recognition: null,

    // Khởi tạo Speech Recognition
    init() {
        if (this.recognition) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("LOG: [ShadowGame] Trình duyệt không hỗ trợ Web Speech API.");
            alert("Trình duyệt không hỗ trợ nhận diện giọng nói.");
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
                    console.log("LOG: [Final Result]", transcript);
                    this.handleVoiceInput(transcript, true);
                } else {
                    interimTranscript += transcript;
                    this.handleVoiceInput(interimTranscript, false);
                }
            }
        };

        this.recognition.onerror = (e) => {
            console.error("LOG: [Speech Error]", e.error);
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                console.log("LOG: [ShadowGame] Tự động khởi động lại nhận diện...");
                this.recognition.start();
            }
        };
    },

    // Hàm điều khiển chính
    toggle() {
        console.log("LOG: [ShadowGame] Nút Luyện được bấm. Trạng thái:", this.isListening);
        if (!this.isListening) {
            this.start();
        } else {
            this.stop();
        }
    },

    start() {
        this.init();
        if (!this.recognition) return;

        this.isListening = true;
        this.history = []; // Reset lịch sử mỗi lần bắt đầu mới
        
        // Hiển thị UI
        const panel = document.getElementById('gamePanel');
        const btn = document.getElementById('btnMic');
        const interim = document.getElementById('gameInterim');
        const score = document.getElementById('gameScore');

        if (panel) panel.style.display = 'flex';
        if (btn) {
            btn.innerHTML = '🛑 Dừng';
            btn.classList.add('listening');
        }
        if (interim) interim.innerText = "Đang lắng nghe...";
        if (score) score.innerText = "0%";

        try {
            this.recognition.start();
            console.log("LOG: [ShadowGame] Hệ thống đã sẵn sàng nhận diện.");
        } catch (e) {
            console.warn("LOG: [ShadowGame] Recognition đã chạy từ trước.");
        }
    },

    stop() {
        this.isListening = false;
        const btn = document.getElementById('btnMic');
        if (btn) {
            btn.innerHTML = '🎤 Luyện';
            btn.classList.remove('listening');
        }
        
        if (this.recognition) {
            this.recognition.stop();
            console.log("LOG: [ShadowGame] Đã dừng nhận diện.");
        }
    },

    /**
     * LOGIC QUAN TRỌNG: Lọc trùng và bồi đắp văn bản
     * Giải quyết lỗi lặp từ: Hiện tại xã hội -> Hiện tại xã hộiにおいて
     */
    handleVoiceInput(text, isFinal) {
        const input = text ? text.trim() : "";
        if (!input) return;

        console.log(`LOG: [Input] ${isFinal ? 'Final' : 'Interim'}: "${input}"`);

        let lastIdx = this.history.length - 1;
        let lastItem = lastIdx >= 0 ? this.history[lastIdx] : null;

        // Nếu câu mới bắt đầu bằng câu cũ (đang bồi đắp thêm từ)
        if (lastItem && (input.startsWith(lastItem) || lastItem.startsWith(input))) {
            if (input.length > lastItem.length) {
                this.history[lastIdx] = input; // Ghi đè câu cũ bằng bản dài hơn
            }
        } else {
            // Nếu là cụm từ mới hoàn toàn, thêm vào history
            if (lastItem !== input) {
                this.history.push(input);
            }
        }

        this.updateUI();
        if (isFinal) {
            this.calculateScore();
        }
    },

    updateUI() {
        const el = document.getElementById('gameInterim');
        if (el) {
            // Nối các cụm từ bằng mũi tên
            el.innerText = this.history.join(" → ");
            el.scrollTop = el.scrollHeight;
        }
    },

    calculateScore() {
        const targetEl = document.getElementById('content-text');
        const scoreEl = document.getElementById('gameScore');
        if (!targetEl || !scoreEl) return;

        const target = targetEl.textContent.trim();
        const spoken = this.history.join(""); // Lấy toàn bộ text đã lọc trùng
        
        // Làm sạch văn bản để so sánh chính xác hơn
        const clean = (s) => s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()？、。]/g, "").replace(/\s/g, "");
        const t = clean(target);
        const s = clean(spoken);
        
        if (t.length === 0) return;

        let matches = 0;
        // Kiểm tra xem các ký tự trong chuỗi đọc có nằm trong chuỗi gốc không
        for (let char of s) {
            if (t.includes(char)) matches++;
        }
        
        const result = Math.min(100, Math.round((matches / t.length) * 100));
        scoreEl.innerText = `${result}%`;
        console.log(`LOG: [Score] Accuracy: ${result}%`);
    }
};

// Đưa ra window để HTML có thể gọi trực tiếp qua onclick
window.ShadowGame = ShadowGame;