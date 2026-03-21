/**
 * Voice Recorder Module - Phiên bản ổn định phát Audio
 */
const VoiceRecorder = (() => {
    const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
    let mediaRecorder;
    let audioChunks = [];

    // CSS
    const style = document.createElement('style');
    style.textContent = `
        .vr-box { margin-top: 20px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        .vr-header { font-weight: bold; margin-bottom: 12px; font-size: 14px; color: #1e293b; display: flex; justify-content: space-between; }
        .vr-controls { display: flex; gap: 10px; margin-bottom: 15px; }
        .vr-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; cursor: pointer; font-size: 13px; font-weight: 500; background: #fff; }
        .vr-btn-rec { color: #dc2626; }
        .vr-btn-rec.active { background: #fee2e2; border-color: #dc2626; animation: vr-pulse 1.5s infinite; }
        .vr-list { display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; padding-right: 4px; }
        .vr-item { display: flex; align-items: center; gap: 10px; padding: 8px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
        .vr-item audio { height: 32px; flex: 1; }
        .vr-del { color: #94a3b8; border: none; background: none; cursor: pointer; font-size: 18px; line-height: 1; }
        .vr-del:hover { color: #ef4444; }
        @keyframes vr-pulse { 0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); } 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); } }
    `;
    document.head.appendChild(style);

    const injectUI = () => {
        // Tự động chèn sau phần nghĩa tiếng Việt
        const anchor = document.querySelector('.vi-text') || document.body;
        const div = document.createElement('div');
        div.id = "vr-module-container";
        div.innerHTML = `
            <div class="vr-box">
                <div class="vr-header">🎤 Luyện nói & Ghi âm <span id="vr-status" style="font-weight:normal; font-size:12px"></span></div>
                <div class="vr-controls">
                    <button id="vr-start" class="vr-btn vr-btn-rec">🔴 Ghi âm</button>
                    <button id="vr-stop" class="vr-btn" disabled>⏹ Dừng</button>
                </div>
                <div id="vr-list" class="vr-list">Đang tải danh sách...</div>
            </div>
        `;
        anchor.parentNode.insertBefore(div, anchor.nextSibling);
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
            mediaRecorder.onstop = uploadFile;
            mediaRecorder.start();
            
            document.getElementById('vr-start').classList.add('active');
            document.getElementById('vr-start').disabled = true;
            document.getElementById('vr-stop').disabled = false;
            document.getElementById('vr-status').innerText = "Đang ghi...";
        } catch (e) { alert("Lỗi mở Micro!"); }
    }

    function stopRec() {
        mediaRecorder.stop();
        document.getElementById('vr-start').classList.remove('active');
        document.getElementById('vr-start').disabled = false;
        document.getElementById('vr-stop').disabled = true;
        document.getElementById('vr-status').innerText = "Đang xử lý...";
    }

    function uploadFile() {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            const fileName = `Speak_${new Date().getTime()}.webm`;
            
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "uploadVoice", base64, fileName })
            });
            
            document.getElementById('vr-status').innerText = "✅ Đã lưu";
            setTimeout(() => { document.getElementById('vr-status').innerText = ""; loadList(); }, 1200);
        };
    }

    async function loadList() {
        const container = document.getElementById('vr-list');
        try {
            const res = await fetch(`${GAS_URL}?type=listVoice&_t=${Date.now()}`);
            const data = await res.json();
            container.innerHTML = data.map(f => `
                <div class="vr-item" id="vr-${f.id}">
                    <audio src="${f.url}" controls crossorigin="anonymous" preload="none"></audio>
                    <button class="vr-del" onclick="VoiceRecorder.delete('${f.id}')">✕</button>
                </div>
            `).join('') || "Chưa có bản ghi âm.";
        } catch (e) { container.innerHTML = "Lỗi tải danh sách."; }
    }

    window.VoiceRecorder = {
        delete: async (id) => {
            const el = document.getElementById(`vr-${id}`);
            if (el && confirm("Xóa bản ghi?")) {
                el.style.opacity = "0.3";
                fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "deleteVoice", fileId: id }) });
                setTimeout(() => el.remove(), 400);
            }
        }
    };

    if (document.readyState === 'complete') injectUI();
    else window.addEventListener('load', injectUI);

    return { refresh: loadList };
})();

export default VoiceRecorder;