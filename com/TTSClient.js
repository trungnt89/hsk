// ../com/TTSClient.js - Shared Audio Logic (Global Script Version)
(function() {
    const DB_NAME = "AUDIO_DATA_CACHE";
    const DB_STORE = "AUDIO";
    let ttsDb;

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
            console.log(`[TTS Cache Save] Key: ${key}`);
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
     * config: { text, voice, lang, rate, audioControl }
     */
    window.speakCommon = async function(config = {}) {
        const text = config.text || "";
        const voice = config.voice || "zh-CN-XiaoxiaoNeural";
        const lang = config.lang || (voice.includes('-') ? voice.substring(0, 5) : "zh-CN");
        const rate = config.rate || "1.0";
        const audioControl = config.audioControl || new Audio();

        if (!text) return;

        // Xử lý giọng đọc trình duyệt (Local)
        if (voice === "browser") {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = lang;
            u.rate = parseFloat(rate);
            window.speechSynthesis.speak(u);
            return new Promise(res => { u.onend = res; });
        }

        // CẤU TRÚC KEY LƯU TRỮ: lang_voice_rate_text
        const cacheKey = `${lang}_${voice}_${rate}_${text}`;

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
            console.log(`[TTS Local] ${cacheKey}`);
            return playAudio(URL.createObjectURL(cachedBlob), audioControl);
        }

        // 2. Gọi API TTS (Sử dụng endpoint tts_test theo yêu cầu)
        
        const url = `https://hsk-gilt.vercel.app/api/tts_test?text=${encodeURIComponent(text)}&lang=${lang}&voice=${voice}&rate=${rate}`;
		console.log(`[TTS API] ${text} -> ${url}`);
        
		try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            
            const blob = await res.blob();
            saveToCache(cacheKey, blob); 
            return playAudio(URL.createObjectURL(blob), audioControl);
        } catch (e) {
            console.error("[TTS API Error]", e);
        }
    };
})();