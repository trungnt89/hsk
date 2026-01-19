// Cấu hình URL GAS của bạn
const GAS_URL = "https://script.google.com/macros/s/AKfycbxUcnkzBAkguAxlZx3Z3R6dcaYapY46FeXAjxqfrweqPFiBsiUvShZp-BnfPyEpzf0/exec";
const DB_NAME = "TTS_SMART_CACHE";
const STORE_NAME = "audios";

// --- KHỞI TẠO INDEXEDDB ---
async function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e);
    });
}

// --- TIỆN ÍCH CACHE ---
const cache = {
    async get(key) {
        const db = await initDB();
        return new Promise((r) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => r(req.result);
            req.onerror = () => r(null);
        });
    },
    async set(key, blob) {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(blob, key);
    }
};

// --- CHUYỂN ĐỔI & PHÁT ---
function b64ToBlob(b64) {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return new Blob([bytes], { type: 'audio/mpeg' });
}

function playBlob(blob) {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play().catch(e => console.error("[AUDIO] Play error:", e));
    audio.onended = () => URL.revokeObjectURL(url);
}

// --- QUY TRÌNH CHÍNH (Hàm này phải khớp với HTML) ---
async function processTTS(text, filename, voice = "vi-VN-HoaiMyNeural") {
    console.log(`[TTS] Đang xử lý: ${filename}...`);
    
    try {
        // Tầng 1: IndexedDB
        const localBlob = await cache.get(filename);
        if (localBlob) {
            console.log("%c[LOCAL] Phát từ IndexedDB (Tốc độ tối đa)", "color: yellow");
            return playBlob(localBlob);
        }

        // Tầng 2: Google Drive / Azure (Gọi qua Vercel)
        const vercelUrl = `/api/tts?text=${encodeURIComponent(text)}&filename=${filename}&voice=${voice}`;
        const res = await fetch(vercelUrl);
        const data = await res.json();

        if (data.source === 'driver') {
            console.log("%c[DRIVE] Lấy từ Google Drive", "color: cyan");
            const proxyRes = await fetch(data.proxyUrl);
            const b64 = await proxyRes.text();
            const blob = b64ToBlob(b64);
            await cache.set(filename, blob);
            playBlob(blob);
        } else {
            console.log("%c[AZURE] Lấy từ Azure Cloud", "color: magenta");
            const blob = b64ToBlob(data.audioData);
            
            playBlob(blob);
            await cache.set(filename, blob);
            
            // Đồng bộ ngầm lên Drive
            const bytes = Uint8Array.from(atob(data.audioData), c => c.charCodeAt(0));
            fetch(`${GAS_URL}?fileKey=${encodeURIComponent(data.fileKey)}`, {
                method: 'POST',
                body: JSON.stringify(Array.from(bytes)),
                mode: 'no-cors'
            }).then(() => console.log("[SYNC] Đã đồng bộ lên Drive."));
        }
    } catch (error) {
        console.error("[ERROR]", error);
    }
}