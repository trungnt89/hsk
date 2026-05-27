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

        // Cấu hình MediaSession
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: text,
                artist: 'HSK Master',
                album: filename,
                artwork: [{ src: 'https://cdn-icons-png.flaticon.com/512/3039/3039387.png', sizes: '512x512', type: 'image/png' }]
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
        const url = `https://hsk-gilt.vercel.app/api/tts?text=${encodeURIComponent(text)}&lang=${lang}&voice=${voice}&rate=${rate}`;
        
        try {
            console.log("[TTS Log] Fetching from API...");
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const blob = await res.blob();
            saveToCache(cacheKey, blob); 
            return playAudio(URL.createObjectURL(blob), audioControl, loop);
        } catch (e) {
            console.error("[TTS API Error]", e);
        }
    };
})();