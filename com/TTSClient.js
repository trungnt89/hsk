// ../com/TTSClient.js - Shared Audio Logic (Global Script Version)
(function() {
    const DB_NAME = "AUDIO_DATA_CACHE";
    const DB_STORE = "AUDIO";
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

    function playAudio(url, audioControl) {
        return new Promise(res => {
            console.log("[TTS Log] Playing audio...");
            // Dừng mọi âm thanh đang phát trước khi chạy âm thanh mới
            audioControl.pause();
            audioControl.currentTime = 0;
            
            audioControl.src = url;
            audioControl.onended = () => {
                console.log("[TTS Log] Playback ended");
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
            console.log("[TTS Log] Audio stopped manually via stopSpeak()");
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
            filename = "hsk_data" 
        } = config;
        
        const lang = config.lang || (voice.includes('-') ? voice.substring(0, 5) : "zh-CN");

        let audioControl = config.audioControl;
        
        if (!audioControl) {
            if (!globalAudio) {
                globalAudio = document.createElement('audio');
                globalAudio.id = "tts-auto-audio";
                globalAudio.controls = true;
                globalAudio.style.cssText = "position:fixed; bottom:10px; right:10px; z-index:9999; width:300px; height:35px; background:#fff; border-radius:50px; box-shadow:0 4px 15px rgba(0,0,0,0.3);";
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
            console.log("[TTS Log] Using cached audio");
            return playAudio(URL.createObjectURL(cachedBlob), audioControl);
        }

        // 2. Gọi API TTS
        const url = `https://hsk-gilt.vercel.app/api/tts_test?text=${encodeURIComponent(text)}&lang=${lang}&voice=${voice}&rate=${rate}`;
        
        try {
            console.log("[TTS Log] Fetching from API...");
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const blob = await res.blob();
            saveToCache(cacheKey, blob); 
            return playAudio(URL.createObjectURL(blob), audioControl);
        } catch (e) {
            console.error("[TTS API Error]", e);
        }
    };
})();