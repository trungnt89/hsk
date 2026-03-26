/**
 * ShadowGame Module - Xử lý luyện đọc Shadowing
 * Tự động lọc trùng văn bản và tính toán độ chính xác
 */
export const ShadowGame = {
    isListening: false,
    history: [],
    
    // Khởi tạo các phần tử UI
    get elPanel() { return document.getElementById('gamePanel'); },
    get elInterim() { return document.getElementById('gameInterim'); },
    get elScore() { return document.getElementById('gameScore'); },
    get elBtnMic() { return document.getElementById('btnMic'); },

    /**
     * Bật/Tắt chế độ luyện tập
     */
    toggle() {
        if (!this.isListening) {
            this.start();
        } else {
            this.stop();
        }
    },

    start() {
        console.log("Shadowing Mode: Started");
        this.isListening = true;
        this.history = [];
        this.resetUI();
        
        this.elPanel.style.display = 'flex';
        this.elBtnMic.classList.add('listening');
        this.elBtnMic.innerHTML = '🛑 Dừng';

        // Gọi module ghi âm/nhận diện (VoiceRecorder)
        if (window.VoiceRecorder) {
            window.VoiceRecorder.start((text, isFinal) => {
                this.handleVoiceInput(text, isFinal);
            });
        }
    },

    stop() {
        console.log("Shadowing Mode: Stopped");
        this.isListening = false;
        this.elBtnMic.classList.remove('listening');
        this.elBtnMic.innerHTML = '🎤 Luyện';
        
        if (window.VoiceRecorder) {
            window.VoiceRecorder.stop();
        }
    },

    /**
     * Xử lý văn bản nhận diện từ microphone
     * @param {string} text - Văn bản nhận được
     * @param {boolean} isFinal - Trạng thái câu hoàn tất
     */
    handleVoiceInput(text, isFinal) {
        const input = text ? text.trim() : "";
        if (!input) return;

        const lastItem = this.history[this.history.length - 1];

        // LOGIC LỌC TRÙNG & BỒI ĐẮP (Triệt tiêu lỗi lặp như trong ảnh)
        if (lastItem && (input.startsWith(lastItem) || lastItem.startsWith(input))) {
            // Nếu câu mới dài hơn (đang bồi đắp), cập nhật câu cũ
            if (input.length > lastItem.length) {
                this.history[this.history.length - 1] = input;
            }
        } else {
            // Nếu là câu mới hoàn toàn, kiểm tra trùng lặp tuyệt đối trước khi push
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
        if (this.elInterim) {
            // Hiển thị các câu nối tiếp bằng dấu mũi tên
            this.elInterim.innerText = this.history.join(" → ");
            this.elInterim.scrollTop = this.elInterim.scrollHeight;
        }
    },

    resetUI() {
        this.history = [];
        if (this.elInterim) this.elInterim.innerText = "Sẵn sàng...";
        if (this.elScore) this.elScore.innerText = "0%";
    },

    /**
     * So sánh văn bản đọc được với văn bản mẫu để tính % chính xác
     */
    calculateScore() {
        const targetText = document.getElementById('content-text').textContent.trim();
        const currentSpeech = this.history.join("");
        
        if (!targetText || !currentSpeech) return;

        // Tính toán độ tương đồng cơ bản (Levenshtein hoặc so khớp từ)
        const score = this.simpleMatch(targetText, currentSpeech);
        if (this.elScore) {
            this.elScore.innerText = `${score}%`;
        }
    },

    simpleMatch(target, speech) {
        // Làm sạch văn bản (xóa dấu câu, khoảng trắng)
        const clean = (s) => s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()？、。]/g, "").replace(/\s/g, "");
        const t = clean(target);
        const s = clean(speech);

        if (t.length === 0) return 0;
        
        let matches = 0;
        for (let i = 0; i < s.length; i++) {
            if (t.includes(s[i])) matches++;
        }
        
        const result = Math.round((matches / t.length) * 100);
        return result > 100 ? 100 : result;
    }
};