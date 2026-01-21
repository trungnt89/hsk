// ../com/TTSClient.js - Shared Audio Logic (Global Script Version)
(function() {
    const DB_NAME = "AUDIO_DATA_CACHE";
    const DB_STORE = "AUDIO";
    let ttsDb;
    let globalAudio = null;

    // Khởi tạo IndexedDB ngay khi nạp file
    const ttsDbReq = indexedDB.open(DB_NAME, 2);
    ttsDbReq.onupgradeneeded = (e) => {
        if (!e.target.result.objectStoreNames.contains(DB_STORE)) {
            e.target.result.createObjectStore(DB_STORE);
        }
    };
    ttsDbReq.onsuccess = (e) => { ttsDb = e.target.result; };

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
            audioControl.src = url;
            audioControl.onended = res;
            audioControl.play().catch(err => {
                console.warn("[Audio Playback Interrupted]", err);
                res();
            });
        });
    }

    /**
     * Hàm gọi chính - Xuất ra phạm vi toàn cục (window)
     * config: { text, voice, lang, rate, audioControl, filename }
     */
    window.speakCommon = async function(config = {}) {
        const { 
            text = "", 
            voice = "zh-CN-XiaoxiaoNeural", 
            rate = "1.0", 
            filename = "hsk_data" 
        } = config;
        
        const lang = config.lang || (voice.includes('-') ? voice.substring(0, 5) : "zh-CN");

        // Logic tự động quản lý thẻ Audio nếu đầu vào trống
        let audioControl = config.audioControl;
		console.log(`[TTS Request] ${new Date().toLocaleTimeString()} | Text: ${config}`);
        if (!audioControl) {
            if (!globalAudio) {
                globalAudio = document.createElement('audio');
                globalAudio.id = "tts-auto-audio";
                globalAudio.style.cssText = "position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;bottom:0;left:0;";
                document.body.appendChild(globalAudio);
                console.log("[TTS Log] Auto Audio Element Created (1px)");
            }
            audioControl = globalAudio;
        }

        if (!text) return;
        console.log(`[TTS Request] ${new Date().toLocaleTimeString()} | Text: ${text}`);

        // Tích hợp MediaSession hiển thị thông tin khi tắt màn hình
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: text,
                artist: 'HSK Master',
                album: filename,
                artwork: [{ src: 'https://cdn-icons-png.flaticon.com/512/3039/3039387.png', sizes: '512x512', type: 'image/png' }]
            });
        }

        const cacheKey = `${voice}_${rate}_${text}`;

        // 1. Kiểm tra Cache trong IndexedDB
        const cachedBlob = await new Promise(res => {
            if (!ttsDb) return res(null);
            try {
                const req = ttsDb.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(cacheKey);
                req.onsuccess = () => res(req.result);
                req.onerror = () => res(null);
            } catch (e) { res(null); }
        });

        if (cachedBlob) {
            console.log(`[TTS Local] Play Audio cache: ${text}`);
            return playAudio(URL.createObjectURL(cachedBlob), audioControl);
        }

        // 2. Gọi API TTS
        const url = `https://hsk-gilt.vercel.app/api/tts_test?text=${encodeURIComponent(text)}&lang=${lang}&voice=${voice}&rate=${rate}`;
        
        try {
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