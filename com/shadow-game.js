/**
 * ShadowGame Module - Standalone & Auto-UI
 * Chỉ cần 1 thẻ H3, module tự xử lý Button, Panel, 3 dòng text & Scroll.
 */
export const ShadowGame = {
    isListening: false,
    history: [],
    recognition: null,
    anchor: null,

    getEl(id) { return document.getElementById(id); },

    // Tự động xây dựng UI ngay sau thẻ h3
    buildUI(anchorEl) {
        if (this.getEl('gamePanel')) return;
        this.anchor = anchorEl;
        
        const wrapper = document.createElement('div');
        wrapper.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        wrapper.innerHTML = `
            <button id="btnMic" style="margin-top:12px; padding:10px 20px; border-radius:8px; border:1px solid #d1d5db; background:#ffffff; cursor:pointer; font-size:15px; transition: all 0.2s;">🎤 Luyện Shadowing</button>
            <div id="gamePanel" style="display:none; background:#f9fafb; border:1px solid #e5e7eb; padding:15px; margin-top:12px; border-radius:10px;">
                <div id="gameInterim" style="max-height:4.5em; line-height:1.5em; overflow-y:auto; font-size:16px; color:#374151; white-space:pre-wrap; word-break: break-all;"></div>
                <div style="text-align:right; margin-top:10px; font-size:14px; color:#4b5563;">
                    Tiến độ: <span id="gameScore" style="font-weight:bold; color:#1d4ed8; font-size:18px;">0%</span>
                </div>
            </div>
        `;
        anchorEl.insertAdjacentElement('afterend', wrapper);
        
        this.getEl('btnMic').onclick = () => this.toggle();
        console.log("LOG: [ShadowGame] UI components created.");
    },

    init(anchorEl) {
        if (anchorEl) this.buildUI(anchorEl);
        if (this.recognition) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("LOG: [Error] Web Speech API not supported.");
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
                    console.log("LOG: [Recognition Final]", transcript);
                    this.handleVoiceInput(transcript, true);
                } else {
                    interimTranscript += transcript;
                    this.handleVoiceInput(interimTranscript, false);
                }
            }
        };

        this.recognition.onerror = (e) => console.error("LOG: [Recognition Error]", e.error);
        this.recognition.onend = () => {
            if (this.isListening) {
                console.log("LOG: [ShadowGame] Restarting recognition...");
                this.recognition.start();
            }
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
        this.getEl('btnMic').style.borderColor = '#ef4444';
        this.getEl('gameInterim').innerText = "Đang lắng nghe...";
        this.getEl('gameScore').innerText = "0%";

        if (!this.recognition) this.init();
        try {
            this.recognition.start();
            console.log("LOG: [ShadowGame] Started listening.");
        } catch (e) {
            console.warn("LOG: [ShadowGame] Already started.");
        }
    },

    stop() {
        this.isListening = false;
        this.getEl('btnMic').innerHTML = '🎤 Luyện Shadowing';
        this.getEl('btnMic').style.borderColor = '#d1d5db';
        if (this.recognition) this.recognition.stop();
        console.log("LOG: [ShadowGame] Stopped.");
    },

    handleVoiceInput(text, isFinal) {
        const input = text ? text.trim() : "";
        if (!input) return;

        const lastIdx = this.history.length - 1;
        const lastItem = this.history[lastIdx];

        // Lọc trùng lắp do interimResults của Chrome
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
            el.scrollTop = el.scrollHeight; // Tự động cuộn xuống khi vượt quá 3 dòng
        }
    },

    calculateScore() {
        // Lấy text từ chính thẻ anchor (h3)
        const targetText = this.anchor ? this.anchor.textContent.trim() : "";
        const spoken = this.history.join("");
        if (!targetText) return;

        const score = Math.min(100, Math.round((spoken.length / targetText.length) * 100));
        this.getEl('gameScore').innerText = `${score}%`;
        console.log(`LOG: [ShadowGame] Progress: ${score}%`);
    }
};