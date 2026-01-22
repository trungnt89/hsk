const LoggerModule = (function() {
    let _config = {
        apiUrl: "https://script.google.com/macros/s/AKfycbxvY66MHgos5E_dYYw6YbV4HxFJrOGKD433_uHc6ybR0gdCBgeGnAByjQYZq5i604Pg/exec",
        containerId: "",
        intervalMs: 60000, 
        lastLogFingerprint: "" // Sử dụng fingerprint thay vì count
    };

    function _convertToJST(timeInput) {
        try {
            let date = new Date(timeInput);
            if (isNaN(date.getTime())) {
                date = new Date();
                const parts = String(timeInput).split(':');
                if (parts.length >= 2) {
                    date.setHours(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2] || 0));
                } else return timeInput;
            }
            return date.toLocaleTimeString('ja-JP', {
                timeZone: 'Asia/Tokyo', hour12: false, 
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        } catch (e) { return "00:00:00"; }
    }

    function _startHeaderClock() {
        const clockEl = document.getElementById('jst-clock');
        if (!clockEl) return;
        setInterval(() => {
            clockEl.innerText = _convertToJST(new Date());
        }, 1000);
    }

    function _getTypeColor(type) {
        const t = String(type).toUpperCase();
        if (t.includes("SENT") || t.includes("SUCCESS") || t.includes("START")) return "#2ecc71"; 
        if (t.includes("ERR") || t.includes("FAIL") || t.includes("STOP") || t.includes("END")) return "#ff4757"; 
        if (t.includes("WAIT") || t.includes("INIT") || t.includes("WARN")) return "#eccc68"; 
        return "#3498db"; 
    }

    function _createLogUI() {
        const container = document.getElementById(_config.containerId);
        if (!container) return;
        container.innerHTML = `
            <div style="display:flex; justify-content: space-between; align-items: center; background:#0a0a0a; padding: 4px 8px; border-radius: 4px 4px 0 0; border: 1px solid #222; border-bottom: none;">
                <div style="font-size: 10px; font-weight: bold; color: #888; display: flex; align-items: center; gap: 4px;">
                    <span id="log-status" style="color: #2ecc71; font-size: 7px;">●</span> MONITOR (JST)
                </div>
                <div id="jst-clock" style="font-family: 'Consolas', monospace; font-size: 11px; color: #2ecc71; font-weight: bold;">--:--:--</div>
            </div>
            <div id="log-box-inner" style="background: #000; color: #bbb; padding: 2px 4px; border-radius: 0 0 4px 4px; 
                 font-family: 'Consolas', monospace; font-size: 9px; max-height: 400px; overflow-y: auto; 
                 border: 1px solid #222; line-height: 1.2; scroll-behavior: smooth;">
                 Syncing logs...
            </div>
        `;
        _startHeaderClock();
    }

    async function _fetchLogs() {
        const statusIcon = document.getElementById('log-status');
        if(statusIcon) statusIcon.style.opacity = "0.3";
        try {
            const response = await fetch(`${_config.apiUrl}?action=getDashboardData&t=${new Date().getTime()}`);
            const data = await response.json();
            if (data && data.logs) _renderLogs(data.logs);
        } catch (e) { console.error("Logger Sync Error:", e); }
        if(statusIcon) statusIcon.style.opacity = "1";
    }

    function _renderLogs(logs) {
        const content = document.getElementById('log-box-inner');
        if (!content) return;

        // Kiểm tra xem nội dung có thực sự thay đổi không (tránh render thừa)
        const currentFingerprint = JSON.stringify(logs);
        if (currentFingerprint === _config.lastLogFingerprint) return;
        _config.lastLogFingerprint = currentFingerprint;

        const sortedLogs = [...logs].sort((a, b) => new Date(a[0]) - new Date(b[0]));

        let html = "";
        sortedLogs.forEach(l => {
            const timeJST = _convertToJST(l[0]);
            const typeColor = _getTypeColor(l[1]);
            html += `
                <div style="border-bottom: 1px solid #111; padding: 1px 0; display: flex; gap: 4px; align-items: center; white-space: nowrap; overflow: hidden;">
                    <span style="color: #ffc; font-size: 11px; flex-shrink: 0;">${timeJST}</span>
                    <span style="color: ${typeColor}; font-size: 11px; font-weight: bold; flex-shrink: 0; min-width: 50px; text-transform: uppercase;">[${l[1]}]</span>
                    <span style="color: #aaa; font-size: 11px; text-overflow: ellipsis; overflow: hidden; flex-grow: 1;">${l[2]}</span>
                </div>`;
        });
        
        content.innerHTML = html;
        // Đảm bảo cuộn xuống cuối sau khi nội dung đã được chèn vào DOM
        setTimeout(() => { 
            content.scrollTop = content.scrollHeight; 
        }, 100);
    }

    async function addLog(type, message) {
        try {
            await fetch(_config.apiUrl, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: type, message: message, timestamp: new Date().toISOString() })
            });
            _fetchLogs();
        } catch (e) { console.error("Logger.add Error:", e); }
    }

    return {
        init: function(targetId) {
            _config.containerId = targetId;
            _createLogUI();
            _fetchLogs();
            setInterval(_fetchLogs, _config.intervalMs);
        },
        add: addLog
    };
})();
window.LoggerModule = LoggerModule;