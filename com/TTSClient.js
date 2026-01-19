/**
 * TTS Client Module - Xử lý Cache IndexedDB & API Azure
 * Logic: Local Cache -> API Azure -> Save Local
 */

const TTS_CONFIG = {
    DB_NAME: "TTS_OFFLINE_DB",
    STORE_NAME: "audio_store",
    VERSION: 1
};

// --- KHỞI TẠO DATABASE ---
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(TTS_CONFIG.DB_NAME, TTS_CONFIG.VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(TTS_CONFIG.STORE_NAME)) {
                db.createObjectStore(TTS_CONFIG.STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject("Không thể khởi tạo IndexedDB");
    });
}

// --- CÁC HÀM CƠ SỞ DỮ LIỆU ---
const storage = {
    async get(key) {
        const db = await initDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(TTS_CONFIG.STORE_NAME, "readonly");
            const req = transaction.objectStore(TTS_CONFIG.STORE_NAME).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    },
    async save(key, blob) {
        const db = await initDB();
        const transaction = db.transaction(TTS_CONFIG.STORE_NAME, "readwrite");
        transaction.objectStore(TTS_CONFIG.STORE_NAME).put(blob, key);
        console.log(`[LOG] Đã lưu cache local: ${key}`);
    }
};

// --- HÀM XỬ LÝ CHÍNH ---
const TTSClient = {
    async play(options) {
        const { 
            text, 
            filename, 
            lang = 'vi-VN', 
            voice = 'vi-VN-HoaiMyNeural', 
            rate = '1.0' 
        } = options;

        if (!filename) throw new Error("Cần cung cấp mã định danh (filename)");

        try {
            // 1. Kiểm tra cache local (IndexedDB)
            const cachedBlob = await storage.get(filename);
            
            if (cachedBlob) {
                console.log("%c[LOCAL] Phát từ IndexedDB", "color: #ffc107");
                this._executePlay(cachedBlob);
                return { source: 'local' };
            }

            // 2. Gọi API Vercel nếu không có cache
            console.log("%c[CLOUD] Đang tải từ Azure...", "color: #007bff");
            const query = new URLSearchParams({ text, lang, voice, rate, filename });
            const response = await fetch(`/api/tts?${query.toString()}`);

            if (!response.ok) throw new Error("Lỗi kết nối API Azure");

            const audioBlob = await response.blob();

            // 3. Lưu vào IndexedDB để dùng lần sau
            await storage.save(filename, audioBlob);

            // 4. Phát âm thanh
            this._executePlay(audioBlob);
            return { source: 'cloud' };

        } catch (error) {
            console.error("[TTS Error]", error);
            throw error;
        }
    },

    // Hàm nội bộ để phát âm thanh từ Blob
    _executePlay(blob) {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
        audio.onended = () => URL.revokeObjectURL(url);
    }
};

// Xuất module (Dành cho trình duyệt)
window.TTSClient = TTSClient;