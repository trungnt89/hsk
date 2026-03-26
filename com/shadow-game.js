/**
 * ShadowGame Module - Fix Lỗi Lặp Từ
 */
export const ShadowGame = {
    isListening: false,
    history: [],
    recognition: null,

    // ... (Giữ nguyên các hàm init, toggle, start, stop như bản trước) ...

    handleVoiceInput(text, isFinal) {
        const input = text ? text.trim() : "";
        if (!input) return;

        // Lấy câu cuối cùng trong lịch sử để so sánh
        let lastIdx = this.history.length - 1;
        let lastItem = lastIdx >= 0 ? this.history[lastIdx] : null;

        /**
         * LOGIC TRIỆT TIÊU LẶP TỪ:
         * 1. Nếu câu mới (input) bắt đầu bằng câu cũ (lastItem), nghĩa là API đang bồi đắp thêm từ.
         * => Ghi đè câu cũ bằng câu mới dài hơn.
         * 2. Nếu không, đây mới là một cụm từ mới hoàn toàn.
         * => Thêm mới vào history.
         */
        if (lastItem && input.startsWith(lastItem)) {
            // Cập nhật câu dài nhất hiện tại vào vị trí cuối
            this.history[lastIdx] = input;
            console.log(`LOG: [Update] ${lastItem} -> ${input}`);
        } else {
            // Chỉ thêm mới nếu nó không trùng lặp tuyệt đối với câu cũ
            if (lastItem !== input) {
                this.history.push(input);
                console.log(`LOG: [New] ${input}`);
            }
        }

        this.updateUI();
        if (isFinal) this.calculateScore();
    },

    updateUI() {
        const el = document.getElementById('gameInterim');
        if (el) {
            // Nối các cụm bằng mũi tên để dễ nhìn luồng đọc
            el.innerText = this.history.join(" → ");
            el.scrollTop = el.scrollHeight;
        }
    },

    calculateScore() {
        const target = document.getElementById('content-text').textContent.trim();
        // Nối toàn bộ lịch sử sạch (đã lọc trùng) để so sánh
        const spoken = this.history.join("");
        
        // Logic tính điểm cơ bản (có thể cải tiến thêm)
        const score = this.simpleMatch(target, spoken);
        document.getElementById('gameScore').innerText = `${score}%`;
    },

    simpleMatch(target, speech) {
        const clean = (s) => s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()？、。]/g, "").replace(/\s/g, "");
        const t = clean(target);
        const s = clean(speech);
        if (!t) return 0;
        
        let matches = 0;
        for (let char of s) {
            if (t.includes(char)) matches++;
        }
        return Math.min(100, Math.round((matches / t.length) * 100));
    }
};