/**
 * Voice Recorder Module - Floating Popup Version
 */
const VoiceRecorder = (() => {
    const GAS_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
    let mediaRecorder;
    let audioChunks = [];

    // 1. CSS Giao diện
    const style = document.createElement('style');
    style.textContent = `
        /* Nút nổi góc màn hình */
        .vr-float-btn { position: fixed; bottom: 20px; right: 20px; width: 56px; height: 56px; background: #dc2626; color: white; border-radius: 50%; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4); z-index: 9999; display: flex; align-items: center; justify-content: center; font-size: 24px; transition: transform 0.2s; }
        .vr-float-btn:hover { transform: scale(1.1); }
        .vr-badge { position: absolute; top: -2px; right: -2px; background: #1e293b; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; border: 2px solid white; }

        /* Lớp nền mờ Popup */
        .vr-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(2px); }
        .vr-overlay.show { display: flex; }

        /* Khung nội dung Popup */
        .vr-modal { background: white; width: 90%; max-width: 450px; border-radius: 16px; padding: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); position: relative; max-height: 80vh; display: flex; flex-direction: column; }
        .vr-close { position: absolute; top: 15px; right: 15px; border: none; background: none; font-size: 20px; cursor: pointer; color: #94a3b8; }
        
        .vr-header { font-size: 18px; font-weight: bold; margin-bottom: 20px; color: #1e293b; display: flex; align-items: center; gap: 10px; }
        
        /* Điều khiển ghi âm */
        .vr-main-controls { display: flex; gap: 12px; margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
        .vr-btn { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; cursor: pointer; font-size: 14px; font-weight: 600; background: white; transition: all 0.2s; }
        .vr-btn-rec { color: #dc2626; border-color: #fecaca; }
        .vr-btn-rec.active { background: #fee2e2; border-color: #dc2626; animation: vr-pulse 1.5s infinite; }
        
        /* Danh sách lịch sử */
        .vr-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 5px; }
        .vr-item { position: relative; border: 1px solid #f1f5f9; border-radius: 8px; padding: 4px; background: #fff; }
        .vr-info { font-size: 11px; color: #64748b; margin: 2px 0 4px 6px; display: flex; justify-content: space-between; padding-right: 30px; }
        .vr-item iframe { width: 100%; height: 60px; border: none; display: block; }
        
        .vr-del { position: absolute; top: 6px; right: 8px; color: #cbd5e1; border: none; background: none; cursor: pointer; font-size: 16px; z-index: 5; }
        .vr-del:hover { color: #ef4444; }

        @keyframes vr-pulse { 0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); } 70% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); } 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); } }
    `;
    document.head.appendChild(style);

    const injectUI = () => {
        // Tạo nút nổi
        const floatBtn = document.createElement('button');
        floatBtn.className = 'vr-float-btn';
        floatBtn.innerHTML = `🎤<span id="vr-count" class="vr-badge">0</span>`;
        floatBtn.onclick = toggleModal;
        document.body.appendChild(floatBtn);

        // Tạo Popup Modal
        const overlay = document.createElement('div');
        overlay.id = 'vr-overlay';
        overlay.className = 'vr-overlay';
        overlay.innerHTML = `
            <div class="vr-modal">
                <button class="vr-close" onclick="VoiceRecorder.toggle()">✕</button>
                <div class="vr-header">🎤 Ghi âm luyện tập</div>
                
                <div class="vr-main-controls">
                    <button id="vr-start" class="vr-btn vr-btn-rec">🔴 Bắt đầu ghi</button>
                    <button id="vr-stop" class="vr-btn" disabled>⏹ Dừng</button>
                </div>

                <div id="vr-status" style="text-align:center; font-size:12px; color:#ef4444; margin-bottom:10px; height:15px"></div>
                
                <div id="vr-list" class="vr-list">Đang tải lịch sử...</div>
            </div>
        `;
        overlay.onclick = (e) => { if(e.target === overlay) toggleModal(); };
        document.body.appendChild(overlay);

        document.getElementById('vr-start').onclick = startRec;
        document.getElementById('vr-stop').onclick = stopRec;
        
        loadList(true); // Cập nhật số lượng ban đầu
    };

    function toggleModal() {
        const overlay = document.getElementById('vr-overlay');
        overlay.classList.toggle('show');
        if(overlay.classList.contains('show')) loadList();
    }

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
            document.getElementById('vr-status').innerText = "Đang ghi âm...";
        } catch (e) { alert("Lỗi: Không thể truy cập Micro!"); }
    }

    function stopRec() {
        mediaRecorder.stop();
        document.getElementById('vr-start').classList.remove('active');
        document.getElementById('vr-start').disabled = false;
        document.getElementById('vr-stop').disabled = true;
        document.getElementById('vr-status').innerText = "Đang xử lý dữ liệu...";
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
            document.getElementById('vr-status').innerText = "✅ Đã lưu vào Drive";
            setTimeout(() => { 
                document.getElementById('vr-status').innerText = ""; 
                loadList(); 
            }, 1500);
        };
    }

    async function loadList(silent = false) {
        const container = document.getElementById('vr-list');
        const countBadge = document.getElementById('vr-count');
        try {
            const res = await fetch(`${GAS_URL}?type=listVoice&_t=${Date.now()}`);
            const data = await res.json();
            
            countBadge.innerText = data.length;
            
            if (!silent) {
                container.innerHTML = data.map(f => {
                    const dateObj = new Date(f.date);
                    const dateStr = `${dateObj.getDate()}/${dateObj.getMonth()+1} ${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                    return `
                        <div class="vr-item" id="vr-${f.id}">
                            <div class="vr-info">
                                <span>📅 ${dateStr}</span>
                                <span>ID: ${f.id.substring(0,5)}</span>
                            </div>
                            <button class="vr-del" onclick="VoiceRecorder.delete('${f.id}')">✕</button>
                            <iframe src="https://drive.google.com/file/d/${f.id}/preview"></iframe>
                        </div>
                    `;
                }).join('') || '<div style="text-align:center; color:gray; font-size:13px; margin-top:20px">Chưa có bản ghi nào.</div>';
            }
        } catch (e) { if(!silent) container.innerHTML = "Lỗi kết nối danh sách."; }
    }

    window.VoiceRecorder = {
        toggle: toggleModal,
        delete: async (id) => {
            if (!confirm("Xóa bản ghi này khỏi Drive?")) return;
            const el = document.getElementById(`vr-${id}`);
            if (el) el.style.opacity = "0.3";
            fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "deleteVoice", fileId: id }) });
            setTimeout(() => { 
                el && el.remove(); 
                const badge = document.getElementById('vr-count');
                badge.innerText = Math.max(0, parseInt(badge.innerText) - 1);
            }, 500);
        }
    };

    if (document.readyState === 'complete') injectUI();
    else window.addEventListener('load', injectUI);

    return { toggle: toggleModal };
})();

export default VoiceRecorder;