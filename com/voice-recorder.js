/**
 * Voice Recorder Module - Final Version (iOS & CORS Optimized)
 * Nguyên tắc: Ghi log đầy đủ, Không sửa logic ngoài phạm vi.
 */
const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
const DB_NAME = "VoiceRecorderDB";
const DB_STORE = "audios";

let mediaRecorder;
let audioChunks = [];

// Lấy ID bài học từ giao diện
const getContextId = () => {
    const pageInfoEl = document.getElementById('pageInfo');
    return pageInfoEl ? pageInfoEl.innerText.replace(/\s+/g, '').replace(/\//g, '_') : "default";
};

// Chuyển Blob sang DataURL để Safari không chặn phát
const blobToDataURL = (blob) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
};

const VoiceRecorder = {
    db: null,

    // Khởi tạo IndexedDB
    initDB: () => {
        return new Promise((resolve) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE);
            req.onsuccess = e => { VoiceRecorder.db = e.target.result; resolve(); };
        });
    },

    saveToDB: (id, blob) => {
        const tx = VoiceRecorder.db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put(blob, id);
        console.log(`[VR Log] Cached to DB: ${id}`);
    },

    getFromDB: (id) => {
        return new Promise((resolve) => {
            const tx = VoiceRecorder.db.transaction(DB_STORE, "readonly");
            const req = tx.objectStore(DB_STORE).get(id);
            req.onsuccess = () => resolve(req.result);
        });
    },

    removeFromDB: (id) => {
        const tx = VoiceRecorder.db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).delete(id);
    },

    start: async () => {
        try {
            audioChunks = [];
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Ưu tiên mp4 cho iOS, webm cho các máy khác
            const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
            mediaRecorder = new MediaRecorder(stream, { mimeType });
            
            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = VoiceRecorder.upload;
            mediaRecorder.start();
            
            document.getElementById('vr-start').classList.add('active');
            document.getElementById('vr-start').disabled = true;
            document.getElementById('vr-stop').disabled = false;
            console.log("[VR Log] Recording started...");
        } catch (e) { alert("Không thể truy cập Micro!"); }
    },

    stop: () => {
        if (mediaRecorder) mediaRecorder.stop();
        document.getElementById('vr-start').classList.remove('active');
        document.getElementById('vr-start').disabled = false;
        document.getElementById('vr-stop').disabled = true;
    },

    upload: async () => {
        const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        const pid = getContextId();
        const stopBtn = document.getElementById('vr-stop');
        stopBtn.innerHTML = '⏳';

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            console.log("[VR Log] Uploading to Drive...");
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ 
                    action: "uploadVoice", 
                    base64: base64, 
                    fileName: `Speak_${pid}_${Date.now()}.webm`, 
                    lessonId: pid 
                })
            });
            setTimeout(() => { 
                VoiceRecorder.load(false); 
                stopBtn.innerHTML = '⏹'; 
            }, 1500);
        };
    },

    load: async (silent = false) => {
        const pid = getContextId();
        const listEl = document.getElementById('vr-list');
        try {
            const res = await fetch(`${GAS_URL}?type=listVoice&lessonId=${pid}&_t=${Date.now()}`);
            const data = await res.json();
            document.getElementById('vr-count').innerText = data.length;
            
            if (!silent) {
                listEl.innerHTML = data.length ? "" : '<div style="text-align:center;padding:20px;color:#94a3b8;">Chưa có bản ghi nào</div>';
                data.forEach(f => {
                    const item = document.createElement('div');
                    item.className = 'vr-item';
                    item.id = `vr-item-${f.id}`;
                    item.innerHTML = `
                        <div class="vr-audio-wrap" id="audio-container-${f.id}">
                            <div class="vr-loading">⏳ Đang tải...</div>
                        </div>
                        <button class="vr-item-del" onclick="VoiceRecorder.delete('${f.id}')">✕</button>
                    `;
                    listEl.appendChild(item);
                    VoiceRecorder.prepareAudio(f.id);
                });
            }
        } catch (e) { console.error("[VR Log] Load failed", e); }
    },

    prepareAudio: async (id) => {
        const container = document.getElementById(`audio-container-${id}`);
        let blob = await VoiceRecorder.getFromDB(id);
        
        if (blob) {
            const dataUrl = await blobToDataURL(blob);
            container.innerHTML = `<audio controls playsinline src="${dataUrl}"></audio>`;
            console.log(`[VR Log] Played from Cache: ${id}`);
        } else {
            try {
                // Fetch qua Proxy GAS để vượt lỗi 403/CORS
                const res = await fetch(`${GAS_URL}?type=getFileBlob&fileId=${id}`);
                const json = await res.json();
                
                if (json.status === "success") {
                    const byteChars = atob(json.data);
                    const byteNums = new Array(byteChars.length);
                    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
                    const newBlob = new Blob([new Uint8Array(byteNums)], {type: json.contentType});
                    
                    VoiceRecorder.saveToDB(id, newBlob);
                    const dataUrl = await blobToDataURL(newBlob);
                    container.innerHTML = `<audio controls playsinline src="${dataUrl}"></audio>`;
                }
            } catch (e) {
                container.innerHTML = `<div style="color:#ef4444;font-size:12px;">Lỗi tải file</div>`;
            }
        }
    },

    delete: async (id) => {
        if (!confirm("Bạn muốn xóa bản ghi này?")) return;
        const itemEl = document.getElementById(`vr-item-${id}`);
        const btnDel = itemEl.querySelector('.vr-item-del');
        
        btnDel.innerHTML = '⏳';
        btnDel.style.pointerEvents = 'none';

        try {
            // Gửi lệnh xóa (không cần đợi kết quả để tránh cảm giác treo)
            fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "deleteVoice", fileId: id }) });
            
            // Xóa UI và Cache ngay lập tức
            await VoiceRecorder.removeFromDB(id);
            itemEl.style.opacity = '0';
            setTimeout(() => {
                itemEl.remove();
                const countEl = document.getElementById('vr-count');
                countEl.innerText = Math.max(0, parseInt(countEl.innerText) - 1);
                console.log(`[VR Log] Deleted UI: ${id}`);
            }, 300);
        } catch (err) {
            alert("Lỗi khi xóa!");
            VoiceRecorder.load(false);
        }
    }
};

// Khởi tạo Module
(async () => {
    await VoiceRecorder.initDB();
    window.VoiceRecorder = VoiceRecorder; // Để gọi từ HTML (onclick)
    // inject UI code ở đây...
})();