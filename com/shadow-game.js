/**
 * ShadowGame Module - Standalone & Auto-UI Version
 * Tự động tạo Button và Panel hiển thị bên dưới thẻ chỉ định.
 */
export const ShadowGame = {
    isListening: false,
    history: [],
    recognition: null,

    getEl(id) { return document.getElementById(id); },

    // Tạo cấu trúc HTML động để HTML chính sạch nhất có thể
    buildUI(anchorEl) {
        if (this.getEl('gamePanel')) return;
        const container = document.createElement('div');
        container.innerHTML = `
            <button id="btnMic" style="margin-top:10px; padding:8px 16px; border-radius:6px; border:1px solid #ccc; cursor:pointer;">🎤 Luyện Shadowing</button>
            <div id="gamePanel" style="display:none; background:#f8fafc; border:1px solid #e2e8f0; padding:12px; margin-top:10px; border-radius:8px; font-family:sans-serif;">
                <div id="gameInterim" style="max-height:4.5em; line-height:1.5em; overflow-y:auto; font-size:15px; color:#334155; white-space:pre-wrap;"></div>
                <div style="text-align:right; margin-top:8px; font-size:14px;">Độ chính xác: <span id="gameScore" style="font-weight:bold; color:#2563eb;">0%</span></div>
            </div>
        `;
        anchorEl.parentNode.insertBefore(container, anchorEl.nextSibling);
        this.getEl('btnMic').onclick = () => this.toggle();
        console.log("LOG: [ShadowGame] UI Injection hoàn tất.");
    },

    init(anchorEl) {
        if (anchorEl) this.buildUI(anchorEl);
        if (this.recognition) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
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
        if (!this.isListening) this.start();
        else this.stop();
    },

    start() {
        this.isListening = true;
        this.history = [];
        this.getEl('gamePanel').style.display = 'block';
        this.getEl('btnMic').innerHTML = '🛑 Dừng';
        this.getEl('gameInterim').innerText = "Đang lắng nghe...";
        
        if (!this.recognition) this.init();
        this.recognition.start();
        console.log("LOG: [ShadowGame] Started.");
    },

    stop() {
        this.isListening = false;
        this.getEl('btnMic').innerHTML = '🎤 Luyện Shadowing';
        if (this.recognition) this.recognition.stop();
        console.log("LOG: [ShadowGame] Stopped.");
    },

    handleVoiceInput(text, isFinal) {
        const input = text ? text.trim() : "";
        if (!input) return;

        const lastIdx = this.history.length - 1;
        const lastItem = this.history[lastIdx];

        if (lastItem && (input.includes(lastItem) || lastItem.includes(input))) {
            if (input.length > lastItem.length) this.history[lastIdx] = input;
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
        const targetEl = document.querySelector('h3');
        if (!targetEl) return;
        const target = targetEl.textContent.trim();
        const spoken = this.history.join("");
        const score = Math.min(100, Math.round((spoken.length / target.length) * 100));
        this.getEl('gameScore').innerText = `${score}%`;
        console.log(`LOG: [ShadowGame] Score: ${score}%`);
    }
};