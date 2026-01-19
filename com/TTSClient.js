/**
 * TTS ENGINE MODULE - FULLY ENCAPSULATED
 */
const TTSClient = (function() {
    const CONFIG = {
        DB_NAME: "TTS_SYSTEM_STORAGE",
        STORE_NAME: "audio_cache",
        API_ENDPOINT: "/api/tts"
    };

    const _getDB = () => new Promise((resolve, reject) => {
        const req = indexedDB.open(CONFIG.DB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(CONFIG.STORE_NAME);
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => reject("IndexedDB failed");
    });

    // Tự động tạo mã định danh duy nhất dựa trên các tham số
    const _generateKey = (p) => {
        const str = `${p.text}_${p.voice}_${p.lang}_${p.rate}_${p.format}`;
        // Tạo mã đơn giản (Base64 của chuỗi tham số) để làm filename hợp lệ
        return btoa(unescape(encodeURIComponent(str))).substring(0, 100);
    };

    const _play = (blob) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play().catch(console.error);
        audio.onended = () => URL.revokeObjectURL(url);
    };

    return {
        async play(params, logger = () => {}) {
            try {
                // TỰ ĐỘNG SET FILENAME NẾU TRỐNG
                const key = params.filename || _generateKey(params);
                console.log(`[TTS] Unique Key: ${key}`);

                const db = await _getDB();
                
                // 1. Check Cache
                const cached = await new Promise(r => {
                    const req = db.transaction(CONFIG.STORE_NAME, "readonly").objectStore(CONFIG.STORE_NAME).get(key);
                    req.onsuccess = () => r(req.result);
                });

                if (cached) {
                    logger("🚀 Phát từ bộ nhớ máy (Tức thì)");
                    _play(cached);
                    return { source: 'cache', key };
                }

                // 2. Gọi API
                logger("🌐 Đang tải từ Azure Cloud...");
                const query = new URLSearchParams(params);
                const response = await fetch(`${CONFIG.API_ENDPOINT}?${query.toString()}`);

                if (!response.ok) throw new Error(`Server error: ${response.status}`);

                const audioBlob = await response.blob();

                // 3. Lưu cache & Phát
                const tx = db.transaction(CONFIG.STORE_NAME, "readwrite");
                tx.objectStore(CONFIG.STORE_NAME).put(audioBlob, key);
                
                _play(audioBlob);
                logger("✅ Đã tải và lưu thành công");
                return { source: 'api', key };

            } catch (err) {
                logger(`❌ Lỗi: ${err.message}`);
                throw err;
            }
        }
    };
})();