/**
 * Voice Recorder Module - iPhone Fix (Simulating TTS Server behavior)
 */
const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
const DB_NAME = "VoiceRecorderDB";
const DB_STORE = "audios";

let mediaRecorder;
let audioChunks = [];

const VoiceRecorder = {
    db: null,

    initDB: () => new Promise(res => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE);
        req.onsuccess = e => { VoiceRecorder.db = e.target.result; res(); };
    }),

    // GIẢ LẬP SERVER: Chuyển dữ liệu sang Base64 giống như cách Server gửi Buffer
    prepareAudio: async (id) => {
        const container = document.getElementById(`audio-container-${id}`);
        
        // 1. Kiểm tra Cache IndexedDB
        const tx = VoiceRecorder.db.transaction(DB_STORE, "readonly");
        const cachedBlob = await new Promise(r => {
            const req = tx.objectStore(DB_STORE).get(id);
            req.onsuccess = () => r(req.result);
        });

        const playFromBlob = (blob) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob); // Chuyển sang DataURL (Base64)
            reader.onloadend = () => {
                const base64data = reader.result;
                // iPhone thích DataURL vì nó chứa toàn bộ dữ liệu, không lo bị Revoke URL
                container.innerHTML = `<audio controls playsinline preload="auto" src="${base64data}"></audio>`;
                console.log(`[VR Log] iPhone Success: Played via DataURL for ID: ${id}`);
            };
        };

        if (cachedBlob) {
            playFromBlob(cachedBlob);
        } else {
            // 2. Nếu không có cache, lấy từ GAS (Sử dụng cơ chế y hệt TTS Server)
            try {
                const res = await fetch(`${GAS_URL}?type=getFileBlob&fileId=${id}`);
                const json = await res.json();
                
                if (json.status === "success") {
                    // Chuyển Base64 từ GAS thành Blob
                    const bChars = atob(json.data);
                    const bNums = new Array(bChars.length);
                    for (let i = 0; i < bChars.length; i++) bNums[i] = bChars.charCodeAt(i);
                    const newBlob = new Blob([new Uint8Array(bNums)], {type: 'audio/mpeg'});
                    
                    // Lưu vào DB để lần sau không cần tải
                    const wrTx = VoiceRecorder.db.transaction(DB_STORE, "readwrite");
                    wrTx.objectStore(DB_STORE).put(newBlob, id);

                    playFromBlob(newBlob);
                }
            } catch (e) {
                container.innerHTML = `<small style="color:red">Lỗi tải âm thanh</small>`;
            }
        }
    },

    // Các hàm Start/Stop/Upload giữ nguyên logic Base64 của bạn...
    start: async () => {
        audioChunks = [];
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // iPhone/Safari hỗ trợ tốt nhất là audio/mp4 hoặc audio/mpeg
        const mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
        mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = VoiceRecorder.upload;
        mediaRecorder.start();
        document.getElementById('vr-start').classList.add('active');
    },

    upload: async () => {
        const blob = new Blob(audioChunks, { type: 'audio/mpeg' }); // Giả lập MIME của TTS Server
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "uploadVoice", base64, fileName: `REC_${Date.now()}.mp3` })
            });
            console.log("[VR Log] Uploaded as MP3 style");
            VoiceRecorder.load(true);
        };
    }
};

export default VoiceRecorder;