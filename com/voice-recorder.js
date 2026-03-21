/**
 * Voice Recorder Module - Auto Inject V1
 * Tự động tìm vị trí và hiển thị, không cần sửa HTML chính
 */
const VoiceRecorder = (() => {
    const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
    let mediaRecorder;
    let audioChunks = [];

    const style = document.createElement('style');
    style.textContent = `
        .vr-box { 
            margin-top: 25px; padding: 15px; border: 1px dashed #cbd5e1; 
            border-radius: 12px; background: #f8fafc; clear: both;
        }
        .vr-header { font-weight: bold; margin-bottom: 10px; font-size: 14px; color: #475569; display: flex; justify-content: space-between; }
        .vr-controls { display: flex; gap: 8px; margin-bottom: 12px; }
        .vr-btn { border: 1px solid #ddd; padding: 6px 15px; border-radius: 8px; cursor: pointer; font-size: 13px; background: #fff; transition: 0.2s; display: flex; align-items: center; gap: 5px; }
        .vr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .vr-btn-rec { color: #dc2626; border-color: #fecaca; }
        .vr-btn-rec.active { background: #fee2e2; border-color: #dc2626; animation: vr-pulse 1.5s infinite; }
        .vr-list { max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
        .vr-item { display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; }
        .vr-item audio { height: 28px; width: 150px; }
        .vr-del { color: #ef4444; border: none; background: none; cursor: pointer; padding: 4px; font-size: 16px; }
        @keyframes vr-pulse { 0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); } 70% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); } 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); } }
    `;
    document.head.appendChild(style);

    const autoInjectUI = () => {
        // Tìm vị trí: ưu tiên sau vi-text hoặc cuối display-box
        const anchor = document.querySelector('.vi-text') || document.querySelector('.display-box');
        if (!anchor) return console.error("Không tìm thấy vị trí để chèn Module Ghi âm");

        const wrapper = document.createElement('div');
        wrapper.id = "vr-auto-wrapper";
        wrapper.innerHTML = `
            <div class="vr-box">
                <div class="vr-header"><span>🎤 Luyện phát âm</span> <span id="vr-status"></span></div>
                <div class="vr-controls">
                    <button id="vr-start" class="vr-btn vr-btn-rec">🔴 Ghi âm</button>
                    <button id="vr-stop" class="vr-btn" disabled>⏹ Dừng</button>
                </div>
                <div id="vr-list" class="vr-list">Đang tải danh sách...</div>
            </div>
        `;
        
        // Chèn vào sau phần tiếng Việt
        anchor.parentNode.insertBefore(wrapper, anchor.nextSibling);

        document.getElementById('vr-start').onclick = startRec;
        document.getElementById('vr-stop').onclick = stopRec;
        loadList();
    };

    async function startRec() {
        try {
            audioChunks = [];
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = saveToDrive;
            mediaRecorder.start();
            
            document.getElementById('vr-start').classList.add('active');
            document.getElementById('vr-start').disabled = true;
            document.getElementById('vr-stop').disabled = false;
            document.getElementById('vr-status').innerText = "🔴 Đang thu...";
        } catch (err) {
            alert("Lỗi Micro: " + err.message);
        }
    }

    function stopRec() {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
            document.getElementById('vr-start').classList.remove('active');
            document.getElementById('vr-start').disabled = false;
            document.getElementById('vr-stop').disabled = true;
            document.getElementById('vr-status').innerText = "⌛ Đang tải lên...";
        }
    }

    function saveToDrive() {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            const fileName = `Speak_${new Date().getTime()}.webm`;
            
            // Gửi ngầm, không block UI
            fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "uploadVoice", base64, fileName })
            });
            
            document.getElementById('vr-status').innerText = "✅ Đã gửi";
            setTimeout(() => { 
                document.getElementById('vr-status').innerText = ""; 
                loadList(); 
            }, 1200);
        };
    }

    async function loadList() {
        const listContainer = document.getElementById('vr-list');
        try {
            const res = await fetch(`${GAS_URL}?type=listVoice&_t=${Date.now()}`);
            const data = await res.json();
            listContainer.innerHTML = data.map(f => `
                <div class="vr-item" id="vr-${f.id}">
                    <div style="flex:1">
                        <div style="font-weight:500">${new Date(f.date).toLocaleTimeString('vi-VN')}</div>
                    </div>
                    <audio src="${f.url}" controls controlsList="nodownload"></audio>
                    <button class="vr-del" onclick="VoiceRecorder.delete('${f.id}')">🗑</button>
                </div>
            `).join('') || "Chưa có bản ghi nào.";
        } catch (e) { listContainer.innerHTML = "Không thể tải danh sách."; }
    }

    window.VoiceRecorder = {
        delete: async (id) => {
            const item = document.getElementById(`vr-${id}`);
            if (item) {
                item.style.transition = "0.3s";
                item.style.opacity = "0";
                item.style.transform = "scale(0.9)";
                setTimeout(() => item.remove(), 300);
            }
            fetch(GAS_URL, { 
                method: "POST", 
                mode: "no-cors", 
                body: JSON.stringify({ action: "deleteVoice", fileId: id }) 
            });
        }
    };

    // Tự động khởi chạy khi script được load
    if (document.readyState === 'complete') autoInjectUI();
    else window.addEventListener('load', autoInjectUI);

    return { render: loadList };
})();

export default VoiceRecorder;