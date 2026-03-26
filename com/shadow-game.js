export const ShadowGame = {
    isListening: false,
    history: [],
    
    toggle() {
        console.log("LOG: [ShadowGame] Nút bấm luyện tập được nhấn.");
        if (!this.isListening) this.start();
        else this.stop();
    },

    start() {
        this.isListening = true;
        this.history = [];
        document.getElementById('gamePanel').style.display = 'flex';
        document.getElementById('btnMic').innerHTML = '🛑 Dừng';
        document.getElementById('gameInterim').innerText = "Đang đợi dữ liệu...";

        if (window.VoiceRecorder) {
            window.VoiceRecorder.start((text, isFinal) => {
                // LOG KIỂM TRA TEXT CÓ VỀ HAY KHÔNG
                console.log(`LOG: [ShadowGame] Dữ liệu Mic: "${text}" | Final: ${isFinal}`);
                this.handleVoiceInput(text, isFinal);
            });
        } else {
            console.error("LOG: [ShadowGame] Không tìm thấy window.VoiceRecorder");
        }
    },

    stop() {
        this.isListening = false;
        document.getElementById('btnMic').innerHTML = '🎤 Luyện';
        if (window.VoiceRecorder) window.VoiceRecorder.stop();
    },

    handleVoiceInput(text, isFinal) {
        const input = text ? text.trim() : "";
        if (!input) return;

        const lastItem = this.history[this.history.length - 1];

        // LOGIC "BẤT BIẾN" ĐỂ KHÔNG BỊ LẶP TỪ (Sửa lỗi trong ảnh bạn gửi)
        if (lastItem && (input.startsWith(lastItem) || lastItem.startsWith(input))) {
            if (input.length > lastItem.length) {
                this.history[this.history.length - 1] = input; // Cập nhật câu dài hơn
            }
        } else {
            if (lastItem !== input) this.history.push(input);
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
        const target = document.getElementById('content-text').textContent.trim();
        const spoken = this.history.join("");
        // Giữ nguyên logic tính điểm đơn giản của bạn
        const score = Math.min(100, Math.round((spoken.length / target.length) * 100));
        document.getElementById('gameScore').innerText = `${score}%`;
    }
};