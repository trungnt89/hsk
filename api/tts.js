const GAS_URL = "https://script.google.com/macros/s/AKfycbxUcnkzBAkguAxlZx3Z3R6dcaYapY46FeXAjxqfrweqPFiBsiUvShZp-BnfPyEpzf0/exec";
const DB_NAME = "TTS_SMART_CACHE";
const STORE_NAME = "audios";

// Khởi tạo IndexedDB
async function initDB() {
    return new Promise((resolve) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE_NAME);
        req.onsuccess = (e) => resolve(e.target.result);
    });
}

// Thao tác với DB
const cache = {
    async get(key) {
        const db = await initDB();
        return new Promise((r) => {
            const req = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(key);
            req.onsuccess = () => r(req.result);
        });
    },
    async set(key, blob) {
        const db = await initDB();
        db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(blob, key);
    }
};

async function processTTS(text, filename, voice = "vi-VN-HoaiMyNeural") {
    console.log(`[TTS] Đang xử lý: ${filename}`);
    
    // 1. KIỂM TRA INDEXEDDB (Tốc độ < 10ms)
    const localBlob = await cache.get(filename);
    if (localBlob) {
        console.log("%c[LOCAL] Lấy từ IndexedDB", "color: yellow");
        return playBlob(localBlob);
    }

    // 2. KIỂM TRA DRIVE & AZURE (Qua Vercel API)
    const vercelUrl = `/api/tts?text=${encodeURIComponent(text)}&filename=${filename}&voice=${voice}`;
    const res = await fetch(vercelUrl);
    const data = await res.json();

    if (data.source === 'driver') {
        console.log("%c[DRIVE] Lấy từ Google Drive", "color: cyan");
        const proxyRes = await fetch(data.proxyUrl);
        const b64 = await proxyRes.text();
        const blob = b64ToBlob(b64);
        await cache.set(filename, blob);
        return playBlob(blob);
    } else {
        console.log("%c[AZURE] Lấy từ Azure Cloud", "color: magenta");
        const blob = b64ToBlob(data.audioData);
        
        // Phát ngay
        playBlob(blob);
        // Lưu cache cục bộ
        await cache.set(filename, blob);
        // Lưu Drive ngầm
        syncToDrive(data.audioData, data.fileKey);
    }
}

function b64ToBlob(b64) {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return new Blob([bytes], { type: 'audio/mpeg' });
}

function playBlob(blob) {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
    audio.onended = () => URL.revokeObjectURL(url);
}

function syncToDrive(b64, fileKey) {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    fetch(`${GAS_URL}?fileKey=${encodeURIComponent(fileKey)}`, {
        method: 'POST',
        body: JSON.stringify(Array.from(bytes)),
        mode: 'no-cors'
    }).then(() => console.log("[SYNC] Đã lưu lên Drive thành công"));
}