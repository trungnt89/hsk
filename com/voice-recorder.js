/**
 * Voice Recorder Module - Toggle & Date Version
 */
const VoiceRecorder = (() => {
    const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
    let mediaRecorder;
    let audioChunks = [];

    // 1. CSS Giao diện
    const style = document.createElement('style');
    style.textContent = `
        .vr-box { margin-top: 15px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .vr-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .vr-btn { padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; cursor: pointer; font-size: 13px; font-weight: 500; background: #fff; transition: all 0.2s; }
        .vr-btn-rec { color: #dc2626; border-color: #fecaca; }
        .vr-btn-rec.active { background: #fee2e2; border-color: #dc2626; animation: vr-pulse 1.5s infinite; }
        .vr-btn-toggle { color: #475569; background: #f8fafc; }
        
        .vr-list { display: none; margin-top: 15px; flex-direction: column; gap: 10px; max-height: 350px; overflow-y: auto; border-top: 1px dashed #e2e8f0; padding-top: 10px; }
        .vr-list.show { display: flex; }
        
        .vr-item { position: relative; background: #fff; border-radius: 6px; border: 1px solid #f1f5f9; padding: 4px; }
        .vr-info { font-size: 11px; color: #94a3b8; margin-bottom: 2px; padding-left: 5px; display: flex; justify-content: space-between; padding-right: 30px; }
        .vr-item iframe { width: 100%; height: 60px; border: none; display: block; }
        
        .vr-del { position: absolute; top: 4px; right: 4px; color: #cbd5e1; border: none; background: none; cursor: pointer; font-size: 14px; z-index: 5; }
        .vr-del:hover { color: #ef4444; }
        
        @keyframes vr-pulse { 0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); } 70% { box-shadow: 0 0 0 5px rgba(220, 38, 38, 0); } 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); } }
    `;
    document.head.appendChild(style);

    const injectUI = () => {
        const anchor = document.querySelector('.vi-text') || document.body;
        const div = document.createElement('div');
        div.id = "vr-container";
        div.innerHTML = `
            <div class="vr-box">
                <div class="vr-controls">
                    <button id="vr-start" class="vr-btn vr-btn-rec">🔴 Ghi âm</button>
                    <button id="vr-stop" class="vr-btn" disabled>⏹ Dừng</button>
                    <button id="vr-toggle" class="vr-btn vr-btn-toggle">📂 Lịch sử (<span id="vr-count">0</span>)</button>
                    <span id="vr-status" style="font-size:11px; color:#64748b; margin-left:auto"></span>
                </div>
                <div id="vr-list" class="vr-list"></div>
            </div>
        `;
        anchor.parentNode.insertBefore(div, anchor.nextSibling);
        
        document.getElementById('vr-start').onclick = startRec;
        document.getElementById('vr-stop').onclick = stopRec;
        document.getElementById('vr-toggle').onclick = () => {
            const list = document.getElementById('vr-list');
            list.classList.toggle('show');
            if(list.classList.contains('show')) loadList();
        };
        
        loadList(true); // Load ngầm để lấy số lượng bản ghi
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
            document.getElementById('vr-status').innerText = "Đang thu...";
        } catch (e) { alert("Không thể truy cập Micro!"); }
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
            await fetch(GAS_URL, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "uploadVoice", base64, fileName: `Speak_${Date.now()}.webm` })
            });
            document.getElementById('vr-status').innerText = "✅ Đã lưu";
            setTimeout(() => { 
                document.getElementById('vr-status').innerText = ""; 
                loadList(); 
            }, 1000);
        };
    }

    async function loadList(silent = false) {
        const container = document.getElementById('vr-list');
        const countSpan = document.getElementById('vr-count');
        try {
            const res = await fetch(`${GAS_URL}?type=listVoice&_t=${Date.now()}`);
            const data = await res.json();
            
            countSpan.innerText = data.length;
            
            if (!silent) {
                container.innerHTML = data.map(f => {
                    const dateObj = new Date(f.date);
                    const dateStr = `${dateObj.getDate()}/${dateObj.getMonth()+1} ${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                    
                    return `
                        <div class="vr-item" id="vr-${f.id}">
                            <div class="vr-info">
                                <span>📅 ${dateStr}</span>
                                <span>ID: ${f.id.substring(0,6)}...</span>
                            </div>
                            <button class="vr-del" onclick="VoiceRecorder.delete('${f.id}')">✕</button>
                            <iframe src="https://drive.google.com/file/d/${f.id}/preview"></iframe>
                        </div>
                    `;
                }).join('') || '<div style="font-size:12px;color:gray;text-align:center">Chưa có bản ghi nào.</div>';
            }
        } catch (e) { if(!silent) container.innerHTML = "Lỗi tải danh sách."; }
    }

    window.VoiceRecorder = {
        delete: async (id) => {
            if (!confirm("Xóa bản ghi này?")) return;
            const el = document.getElementById(`vr-${id}`);
            if (el) el.style.opacity = "0.3";
            fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "deleteVoice", fileId: id }) });
            setTimeout(() => { 
                el && el.remove(); 
                const count = document.getElementById('vr-count');
                count.innerText = parseInt(count.innerText) - 1;
            }, 500);
        }
    };

    if (document.readyState === 'complete') injectUI();
    else window.addEventListener('load', injectUI);

    return { refresh: loadList };
})();

export default VoiceRecorder;