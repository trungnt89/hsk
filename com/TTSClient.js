// ../com/TTSClient.js - Shared Audio Logic (Global Script Version)
(function() {
    const DB_NAME = "TTS";
    const DB_STORE = "MP3";
    let ttsDb;
    let globalAudio = null;

    // Khởi tạo IndexedDB
    const ttsDbReq = indexedDB.open(DB_NAME, 2);
    ttsDbReq.onupgradeneeded = (e) => {
        if (!e.target.result.objectStoreNames.contains(DB_STORE)) {
            e.target.result.createObjectStore(DB_STORE);
        }
    };
    ttsDbReq.onsuccess = (e) => { 
        ttsDb = e.target.result; 
        console.log("[TTS Log] IndexedDB Connected");
    };

    async function saveToCache(key, blob) {
        if (!ttsDb) return;
        try {
            const txn = ttsDb.transaction(DB_STORE, "readwrite");
            txn.objectStore(DB_STORE).put(blob, key);
            console.log(`[TTS Save] Cache stored for: ${key}`);
        } catch (e) { console.warn("[TTS Cache Save Error]", e); }
    }

    function playAudio(url, audioControl, loop = false) {
        return new Promise(res => {
            console.log(`[TTS Log] Playing audio (loop: ${loop})...`);
            // Dừng mọi âm thanh đang phát trước khi chạy âm thanh mới
            audioControl.pause();
            audioControl.currentTime = 0;
            
            // Thiết lập chế độ lặp lại của HTML5 Audio
            audioControl.loop = loop;
            
            audioControl.src = url;
            audioControl.onended = () => {
                console.log(`[TTS Log] Playback ended (was loop: ${audioControl.loop})`);
                res();
            };
            audioControl.play().catch(err => {
                console.warn("[Audio Playback Interrupted]", err);
                res();
            });
        });
    }

    /**
     * Hàm dừng âm thanh chủ động từ bên ngoài
     */
    window.stopSpeak = function() {
        if (globalAudio) {
            globalAudio.pause();
            globalAudio.currentTime = 0;
            globalAudio.loop = false; // Reset loop khi stop chủ động
            console.log("[TTS Log] Audio stopped manually and loop disabled");
        }
    };

    const artworkCache = new Map();

    function wrapText(text, maxChars = 6) {
        const lines = [];
        if (!text.includes(' ')) {
            for (let i = 0; i < text.length; i += maxChars) {
                lines.push(text.substring(i, i + maxChars));
            }
            return lines;
        }
        const words = text.split(/\s+/);
        let currentLine = "";
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const nextLine = currentLine ? (currentLine + " " + word) : word;
            if (nextLine.length <= maxChars) {
                currentLine = nextLine;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                }
                if (word.length > maxChars) {
                    for (let j = 0; j < word.length; j += maxChars) {
                        lines.push(word.substring(j, j + maxChars));
                    }
                    currentLine = "";
                } else {
                    currentLine = word;
                }
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        return lines;
    }

    function createTextArtwork(text) {
        if (!text) return '';
        
        let meaningText = "";
        const info = window.currentWordInfo;
        if (info) {
            const isFlipped = !!info.isFlipped;
            if (isFlipped) {
                meaningText = info.exVn || info.meaning || "";
            } else {
                meaningText = info.meaning || "";
            }
        }

        const cacheKey = `${text}_${meaningText}`;
        if (artworkCache.has(cacheKey)) {
            return artworkCache.get(cacheKey);
        }
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 300;
            const ctx = canvas.getContext('2d');

            // Fill canvas with a solid background color matching the iOS lock screen background
            ctx.fillStyle = '#949494';
            ctx.fillRect(0, 0, 300, 300);

            // Phân chia dòng chữ tối đa 6 ký tự mỗi dòng
            const lines = wrapText(text, 6);
            const lineCount = lines.length;

            // Tính kích cỡ font tối ưu dựa vào chiều dài từ dài nhất trong các dòng
            let maxLineLen = 0;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].length > maxLineLen) {
                    maxLineLen = lines[i].length;
                }
            }

            let fontSize = 80;
            if (maxLineLen > 2) fontSize = 52;
            if (maxLineLen > 4) fontSize = 38;
            if (maxLineLen > 6) fontSize = 32;

            if (lineCount > 3) fontSize = Math.min(fontSize, 24);
            if (lineCount > 5) fontSize = Math.min(fontSize, 18);

            ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const lineHeight = fontSize * 1.3;
            const totalHeight = (lineCount - 1) * lineHeight;
            
            // Adjust vertical centering of Chinese text if we have subtext meaning below
            const startY = meaningText ? (110 - (totalHeight / 2)) : (150 - (totalHeight / 2));

            for (let i = 0; i < lineCount; i++) {
                const lineY = startY + i * lineHeight;

                // Bóng đổ phẳng nhẹ
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.fillText(lines[i], 152, lineY + 2);

                // Chữ chính màu trắng tinh
                ctx.fillStyle = '#ffffff';
                ctx.fillText(lines[i], 150, lineY);
            }

            // Draw Vietnamese meaning if available in the last two lines
            if (meaningText) {
                const meaningLines = wrapText(meaningText, 18).slice(0, 2);
                if (meaningLines.length > 0) {
                    ctx.font = `bold 16px "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    const meaningLineHeight = 22;
                    const mTotalHeight = (meaningLines.length - 1) * meaningLineHeight;
                    const mStartY = 245 - (mTotalHeight / 2);

                    for (let i = 0; i < meaningLines.length; i++) {
                        const mLineY = mStartY + i * meaningLineHeight;

                        // Soft shadow
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                        ctx.fillText(meaningLines[i], 151, mLineY + 1);

                        // Soft light gray color
                        ctx.fillStyle = '#e2e8f0';
                        ctx.fillText(meaningLines[i], 150, mLineY);
                    }
                }
            }

            const dataUrl = canvas.toDataURL('image/png');
            artworkCache.set(cacheKey, dataUrl);
            return dataUrl;
        } catch (e) {
            console.warn('[TTS Log] Error creating text artwork canvas, falling back to icon:', e);
            const fallback = 'https://cdn-icons-png.flaticon.com/128/9973/9973171.png';
            artworkCache.set(cacheKey, fallback);
            return fallback;
        }
    }

    /**
     * Hàm gọi chính - Xuất ra phạm vi toàn cục (window)
     */
    window.speakCommon = async function(config = {}) {
        const { 
            text = "", 
            voice = "zh-CN-XiaoxiaoNeural", 
            rate = "1.0", 
            filename = "hsk_data",
            loop = false // Nhận thêm tham số loop
        } = config;
        
        const lang = config.lang || (voice.includes('-') ? voice.substring(0, 5) : "zh-CN");

        let audioControl = config.audioControl;
        
        if (!audioControl) {
            if (!globalAudio) {
                globalAudio = document.createElement('audio');
                globalAudio.id = "tts-auto-audio";
                globalAudio.controls = true;
                globalAudio.style.cssText = "position:fixed; bottom:-100px; right:10px; z-index:9999; width:300px; height:35px; background:#fff; border-radius:50px; box-shadow:0 4px 15px rgba(0,0,0,0.3);";
                document.body.appendChild(globalAudio);
                console.log("[TTS Log] Visible Audio Player Created");
            }
            audioControl = globalAudio;
        }

        if (!text) {
            console.log("[TTS Log] No text provided to speak");
            return;
        }
		
        let pin = "HSK Master";
        const info = window.currentWordInfo;
        if (info) {
            const isFlipped = !!info.isFlipped;
            if (isFlipped) {
                pin = info.exPy || info.pinyin || "HSK Master";
            } else {
                pin = info.pinyin || "HSK Master";
            }
        }

        // Cấu hình MediaSession
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: text,
                artist: pin,
                album: filename,
                artwork: [{ src: createTextArtwork(text), sizes: '300x300', type: 'image/png' }]
            });
            navigator.mediaSession.setActionHandler('pause', () => { window.stopSpeak(); });
            navigator.mediaSession.setActionHandler('stop', () => { window.stopSpeak(); });
        }

        const cacheKey = `${voice}_${rate}_${text}`;

        // 1. Kiểm tra Cache
        const cachedBlob = await new Promise(res => {
            if (!ttsDb) return res(null);
            try {
                const req = ttsDb.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(cacheKey);
                req.onsuccess = () => res(req.result);
                req.onerror = () => res(null);
            } catch (e) { res(null); }
        });

        if (cachedBlob) {
            console.log("[TTS Log] Using cached audio for loop processing");
            return playAudio(URL.createObjectURL(cachedBlob), audioControl, loop);
        }

        // 2. Gọi API TTS
        const url = `https://hsk-gilt.vercel.app/api/tts?text=${encodeURIComponent(text)}&lang=${lang}&voice=${voice}&rate=${rate}&token=${sessionStorage.getItem('token')}`;
        try {
            console.log("[TTS Log] Fetching from API...");
			const res = await fetch(url, {
			  method: 'GET',
			  headers: {
				'Content-Type': 'application/json',
				'Authorization':  sessionStorage.getItem('token')
			  }
			});
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const blob = await res.blob();
            saveToCache(cacheKey, blob); 
            return playAudio(URL.createObjectURL(blob), audioControl, loop);
        } catch (e) {
            console.error("[TTS API Error]", e);
        }
    };
})();