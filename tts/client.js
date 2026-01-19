/**
 * TTS ENGINE MODULE - FULLY ENCAPSULATED
 * Đã đóng gói: IndexedDB, Fetch API, Audio Playback, Error Handling
 */
const TTSClient = (function() {
    const CONFIG = {
        DB_NAME: "TTS_SYSTEM_STORAGE",
        STORE_NAME: "audio_cache",
        API_ENDPOINT: "/api/tts"
    };

    // Khởi tạo DB nội bộ
    const _getDB = () => new Promise((resolve, reject) => {
        const req = indexedDB.open(CONFIG.DB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(CONFIG.STORE_NAME);
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => reject("IndexedDB failed");
    });

    // Phát âm thanh nội bộ
    const _play = (blob) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play().catch(console.error);
        audio.onended = () => URL.revokeObjectURL(url);
    };

    return {
        /**
         * @param {Object} params - { text, filename, voice, lang, rate }
         * @param {Function} logger - Callback để nhận thông báo trạng thái
         */
        async execute(params, logger = () => {}) {
            try {
                const { filename } = params;
                if (!filename) throw new Error("Missing filename/ID");

                const db = await _getDB();
                
                // 1. Kiểm tra cache
                const cached = await new Promise(r => {
                    const req = db.transaction(CONFIG.STORE_NAME, "readonly").objectStore(CONFIG.STORE_NAME).get(filename);
                    req.onsuccess = () => r(req.result);
                });

                if (cached) {
                    logger("🚀 Phát từ bộ nhớ máy (Tức thì)");
                    _play(cached);
                    return { source: 'cache' };
                }

                // 2. Gọi API nếu không có cache
                logger("🌐 Đang tải từ Azure Cloud...");
                const query = new URLSearchParams(params);
                const response = await fetch(`${CONFIG.API_ENDPOINT}?${query.toString()}`);

                if (!response.ok) throw new Error(`Server error: ${response.status}`);

                const audioBlob = await response.blob();

                // 3. Lưu cache & Phát
                const tx = db.transaction(CONFIG.STORE_NAME, "readwrite");
                tx.objectStore(CONFIG.STORE_NAME).put(audioBlob, filename);
                
                _play(audioBlob);
                logger("✅ Đã tải và lưu thành công");
                return { source: 'api' };

            } catch (err) {
                logger(`❌ Lỗi: ${err.message}`);
                throw err;
            }
        },

        async clearAll() {
            const db = await _getDB();
            db.transaction(CONFIG.STORE_NAME, "readwrite").objectStore(CONFIG.STORE_NAME).clear();
            console.warn("TTS Cache cleared");
        }
    };
})();