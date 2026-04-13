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
            audioControl.pause();
            audioControl.currentTime = 0;
            
            // Duy trì luồng phát nhạc nền mỗi khi bắt đầu câu mới (quan trọng cho Repeat)
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "playing";
            }
            
            audioControl.src = url;
            audioControl.onended = () => {
                console.log("[TTS Log] Playback ended");
                res();
            };
            audioControl.play().catch(err => {
                console.warn("[Audio Playback Interrupted]", err);
                setTimeout(() => audioControl.play(), 100);
                res();
            });
        });
    }

    window.stopSpeak = function() {
        if (globalAudio) {
            globalAudio.pause();
            globalAudio.currentTime = 0;
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "paused";
            }
            console.log("[TTS Log] Audio stopped");
        }
    };

    window.speakCommon = async function(config = {}) {
        const { text = "", voice = "zh-CN-XiaoxiaoNeural", rate = "1.0", filename = "hsk_data" } = config;
        const lang = config.lang || (voice.includes('-') ? voice.substring(0, 5) : "zh-CN");
        let audioControl = config.audioControl;
        
        if (!audioControl) {
            if (!globalAudio) {
                globalAudio = document.createElement('audio');
                globalAudio.id = "tts-auto-audio";
                globalAudio.controls = true;
                globalAudio.preload = "auto";
                globalAudio.playsInline = true; 
                globalAudio.style.cssText = "position:fixed; bottom:-100px; right:10px; z-index:9999; width:220px; height:35px; background:#fff; border-radius:50px; box-shadow:0 4px 15px rgba(0,0,0,0.3);";
                document.body.appendChild(globalAudio);
                console.log("[TTS Log] Background-ready Player Created");
            }
            audioControl = globalAudio;
        }

        if (!text) return;

        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: text.length > 40 ? text.substring(0, 40) + "..." : text,
                artist: 'Learning Master Hub',
                album: filename,
                artwork: [{ src: 'https://cdn-icons-png.flaticon.com/512/3039/3039387.png', sizes: '512x512', type: 'image/png' }]
            });
            navigator.mediaSession.setActionHandler('play', () => audioControl.play());
            navigator.mediaSession.setActionHandler('pause', () => window.stopSpeak());
            navigator.mediaSession.setActionHandler('stop', () => window.stopSpeak());
        }

        const cacheKey = `${voice}_${rate}_${text}`;
        const cachedBlob = await new Promise(res => {
            if (!ttsDb) return res(null);
            try {
                const req = ttsDb.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(cacheKey);
                req.onsuccess = () => res(req.result);
                req.onerror = () => res(null);
            } catch (e) { res(null); }
        });

        if (cachedBlob) {
            return playAudio(URL.createObjectURL(cachedBlob), audioControl);
        }

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