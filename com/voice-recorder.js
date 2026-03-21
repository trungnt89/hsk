/**
 * Voice Recorder Module - Google Drive Iframe Version
 * Giải quyết triệt để lỗi 0:00 và lỗi không phát được audio.
 */
const VoiceRecorder = (() => {
    const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
    let mediaRecorder;
    let audioChunks = [];

    // 1. CSS Giao diện
    const style = document.createElement('style');
    style.textContent = `
        .vr-box { margin-top: 20px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .vr-header { font-weight: bold; margin-bottom: 12px; font-size: 14px; color: #1e293b; display: flex; justify-content: space-between; }
        .vr-controls { display: flex; gap: 10px; margin-bottom: 15px; }
        .vr-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; cursor: pointer; font-size: 13px; font-weight: 500; background: #fff; }
        .vr-btn-rec { color: #dc2626; border-color: #fecaca; }
        .vr-btn-rec.active { background: #fee2e2; border-color: #dc2626; animation: vr-pulse 1.5s infinite; }
        .vr-list { display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; padding-top: 10px; }
        .vr-item { position: relative; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; padding-bottom: 5px; }
        .vr-item iframe { width: 100%; height: 60px; border: none; display: block; background: transparent; }
        .vr-del { position: absolute; top: 5px; right: 5px; color: #94a3b8; border: none; background: rgba(255,255,255,0.8); cursor: pointer; font-size: 16px; width: 24px; height: 24px; border-radius: 50%; z-index: 10; display: flex; align-items: center; justify-content: center; }
        .vr-del:hover { color: #ef4444; background: #fff; }
        @keyframes vr-pulse { 0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); } 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); } }
    `;
    document.head.appendChild(style);

    const injectUI = () => {
        const anchor = document.querySelector('.vi-text') || document.body;
        const div = document.createElement('div');
        div.id = "vr-container";
        div.innerHTML = `
            <div class="vr-box">
                <div class="vr-header">🎤 Luyện nói & Check âm <span id="vr-status" style="font-weight:normal; font-size:11px"></span></div>
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
            document.getElementById('vr-status').innerText = "🔴 Đang thu...";
        } catch (e) { alert("Lỗi: Không thể truy cập Micro!"); }
    }

    function stopRec() {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
            document.getElementById('vr-start').classList.remove('active');
            document.getElementById('vr-start').disabled = false;
            document.getElementById('vr-stop').disabled = true;
            document.getElementById('vr-status').innerText = "⌛ Đang xử lý...";
        }
    }

    function uploadFile() {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "uploadVoice", base64, fileName: `Speak_${Date.now()}.webm` })
            });
            document.getElementById('vr-status').innerText = "✅ Đã lưu";
            setTimeout(() => { document.getElementById('vr-status').innerText = ""; loadList(); }, 1500);
        };
    }

    async function loadList() {
        const container = document.getElementById('vr-list');
        try {
            const res = await fetch(`${GAS_URL}?type=listVoice&_t=${Date.now()}`);
            const data = await res.json();
            
            // THAY ĐỔI CHÍNH: Sử dụng iframe preview thay vì thẻ audio
            container.innerHTML = data.map(f => `
                <div class="vr-item" id="vr-${f.id}">
                    <button class="vr-del" onclick="VoiceRecorder.delete('${f.id}')" title="Xóa">✕</button>
                    <iframe src="https://drive.google.com/file/d/${f.id}/preview"></iframe>
                </div>
            `).join('') || '<div style="font-size:12px;color:gray">Chưa có bản ghi nào.</div>';
        } catch (e) { container.innerHTML = "Lỗi tải danh sách âm thanh."; }
    }

    window.VoiceRecorder = {
        delete: async (id) => {
            if (!confirm("Xóa bản ghi này?")) return;
            const el = document.getElementById(`vr-${id}`);
            if (el) el.style.opacity = "0.3";
            fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "deleteVoice", fileId: id }) });
            setTimeout(() => el && el.remove(), 500);
        }
    };

    if (document.readyState === 'complete') injectUI();
    else window.addEventListener('load', injectUI);

    return { refresh: loadList };
})();

export default VoiceRecorder;