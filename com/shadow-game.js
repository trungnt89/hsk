/**
 * ShadowGame Module - Fixed Display Issue
 */
export const ShadowGame = {
    isListening: false,
    history: [],
    
    // Helper để lấy Element nhanh và chính xác
    getEl(id) { return document.getElementById(id); },

    toggle() {
        console.log("ShadowGame: Toggle clicked, current state:", this.isListening);
        if (!this.isListening) this.start();
        else this.stop();
    },

    start() {
        this.isListening = true;
        this.history = [];
        
        const panel = this.getEl('gamePanel');
        const btn = this.getEl('btnMic');
        const interim = this.getEl('gameInterim');

        // HIỂN THỊ UI
        if (panel) panel.style.display = 'flex';
        if (btn) {
            btn.classList.add('listening');
            btn.innerHTML = '🛑 Dừng';
        }
        if (interim) interim.innerText = "Đang lắng nghe...";

        console.log("ShadowGame: UI initialized, calling VoiceRecorder");

        if (window.VoiceRecorder) {
            window.VoiceRecorder.start((text, isFinal) => {
                this.handleVoiceInput(text, isFinal);
            });
        } else {
            console.error("ShadowGame: VoiceRecorder module not found!");
        }
    },

    stop() {
        this.isListening = false;
        const btn = this.getEl('btnMic');
        if (btn) {
            btn.classList.remove('listening');
            btn.innerHTML = '🎤 Luyện';
        }
        
        if (window.VoiceRecorder) window.VoiceRecorder.stop();
        console.log("ShadowGame: Stopped");
    },

    handleVoiceInput(text, isFinal) {
        const input = text ? text.trim() : "";
        if (!input) return;

        console.log(`ShadowGame: Received input [${isFinal ? 'Final' : 'Interim'}]:`, input);

        const lastItem = this.history[this.history.length - 1];

        // LOGIC LỌC TRÙNG & BỒI ĐẮP
        if (lastItem && (input.startsWith(lastItem) || lastItem.startsWith(input))) {
            if (input.length > lastItem.length) {
                this.history[this.history.length - 1] = input;
            }
        } else {
            if (lastItem !== input) {
                this.history.push(input);
            }
        }

        this.updateUI();
        if (isFinal) this.calculateScore();
    },

    updateUI() {
        const interim = this.getEl('gameInterim');
        if (interim) {
            // Nối các câu bằng dấu → để tránh cảm giác lặp từ
            interim.innerText = this.history.join(" → ");
            interim.scrollTop = interim.scrollHeight;
        }
    },

    resetUI() {
        this.history = [];
        const interim = this.getEl('gameInterim');
        const score = this.getEl('gameScore');
        const panel = this.getEl('gamePanel');
        
        if (interim) interim.innerText = "";
        if (score) score.innerText = "0%";
        if (panel) panel.style.display = 'none';
    },

    calculateScore() {
        const contentEl = this.getEl('content-text');
        const scoreEl = this.getEl('gameScore');
        if (!contentEl || !scoreEl) return;

        const target = contentEl.textContent.trim();
        const spoken = this.history.join("");
        
        const score = this.simpleMatch(target, spoken);
        scoreEl.innerText = `${score}%`;
        console.log(`ShadowGame: Score calculated: ${score}%`);
    },

    simpleMatch(target, speech) {
        const clean = (s) => s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()？、。]/g, "").replace(/\s/g, "");
        const t = clean(target);
        const s = clean(speech);
        if (!t) return 0;
        
        let matches = 0;
        for (let i = 0; i < s.length; i++) {
            if (t.includes(s[i])) matches++;
        }
        const result = Math.round((matches / t.length) * 100);
        return result > 100 ? 100 : result;
    }
};