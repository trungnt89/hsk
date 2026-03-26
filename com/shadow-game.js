/**
 * ShadowGame Module - Debug Version
 * Luôn ghi log đầy đủ theo yêu cầu người dùng
 */
export const ShadowGame = {
    isListening: false,
    history: [],
    
    getEl(id) { return document.getElementById(id); },

    toggle() {
        console.log("LOG: [ShadowGame] Toggle. Trạng thái hiện tại:", this.isListening);
        if (!this.isListening) this.start();
        else this.stop();
    },

    start() {
        this.isListening = true;
        this.history = [];
        
        const panel = this.getEl('gamePanel');
        const btn = this.getEl('btnMic');
        const interim = this.getEl('gameInterim');

        if (panel) panel.style.display = 'flex';
        if (btn) {
            btn.classList.add('listening');
            btn.innerHTML = '🛑 Dừng';
        }
        if (interim) interim.innerText = "Hệ thống đang chờ giọng nói...";

        console.log("LOG: [ShadowGame] Bắt đầu phiên luyện tập.");

        if (window.VoiceRecorder) {
            console.log("LOG: [ShadowGame] Gọi VoiceRecorder.start()");
            window.VoiceRecorder.start((text, isFinal) => {
                // ĐÂY LÀ DÒNG QUAN TRỌNG NHẤT ĐỂ KIỂM TRA TEXT
                console.log(`LOG: [ShadowGame] Nhận text từ Mic: "${text}" | isFinal: ${isFinal}`);
                this.handleVoiceInput(text, isFinal);
            });
        } else {
            console.error("LOG: [ShadowGame] THẤT BẠI: window.VoiceRecorder không tồn tại.");
        }
    },

    stop() {
        this.isListening = false;
        const btn = this.getEl('btnMic');
        if (btn) {
            btn.classList.remove('listening');
            btn.innerHTML = '🎤 Luyện';
        }
        if (window.VoiceRecorder) {
            window.VoiceRecorder.stop();
            console.log("LOG: [ShadowGame] Đã dừng VoiceRecorder.");
        }
    },

    handleVoiceInput(text, isFinal) {
        const input = text ? text.trim() : "";
        if (!input) {
            console.log("LOG: [ShadowGame] Nhận text rỗng, bỏ qua.");
            return;
        }

        const lastItem = this.history[this.history.length - 1];

        // Xử lý lọc trùng thông minh
        if (lastItem && (input.startsWith(lastItem) || lastItem.startsWith(input))) {
            if (input.length > lastItem.length) {
                console.log(`LOG: [ShadowGame] Bồi đắp câu: "${lastItem}" -> "${input}"`);
                this.history[this.history.length - 1] = input;
            } else {
                console.log("LOG: [ShadowGame] Text mới ngắn hơn hoặc bằng text cũ, bỏ qua.");
            }
        } else {
            if (lastItem !== input) {
                console.log(`LOG: [ShadowGame] Thêm câu mới vào lịch sử: "${input}"`);
                this.history.push(input);
            }
        }

        this.updateUI();
        if (isFinal) {
            console.log("LOG: [ShadowGame] Câu đã hoàn tất (isFinal=true), tính điểm...");
            this.calculateScore();
        }
    },

    updateUI() {
        const interim = this.getEl('gameInterim');
        if (interim) {
            const displayStr = this.history.join(" → ");
            interim.innerText = displayStr;
            interim.scrollTop = interim.scrollHeight;
            console.log("LOG: [ShadowGame] Cập nhật giao diện:", displayStr);
        }
    },

    resetUI() {
        console.log("LOG: [ShadowGame] Reset UI.");
        this.history = [];
        const interim = this.getEl('gameInterim');
        const score = this.getEl('gameScore');
        if (interim) interim.innerText = "";
        if (score) score.innerText = "0%";
    },

    calculateScore() {
        const contentEl = this.getEl('content-text');
        const scoreEl = this.getEl('gameScore');
        if (!contentEl || !scoreEl) return;

        const target = contentEl.textContent.trim();
        const spoken = this.history.join("");
        
        const score = this.simpleMatch(target, spoken);
        scoreEl.innerText = `${score}%`;
        console.log(`LOG: [ShadowGame] Độ chính xác: ${score}% | Spoken: ${spoken}`);
    },

    simpleMatch(target, speech) {
        const clean = (s) => s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()？、。]/g, "").replace(/\s/g, "");
        const t = clean(target);
        const s = clean(speech);
        if (!t) return 0;
        
        let matches = 0;
        const setT = new Set(t.split(''));
        for (let char of s) {
            if (setT.has(char)) matches++;
        }
        return Math.min(100, Math.round((matches / t.length) * 100));
    }
};