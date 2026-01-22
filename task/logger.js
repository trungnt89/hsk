/**
 * MODULE LOG TỰ TRỊ (AUTO-REALTIME & CLIENT-WRITE)
 * Chỉ cần nhúng vào HTML và gọi LoggerModule.init("ID_ELEMENT")
 */
const LoggerModule = (function() {
    let _config = {
        apiUrl: "https://script.google.com/macros/s/AKfycbxvY66MHgos5E_dYYw6YbV4HxFJrOGKD433_uHc6ybR0gdCBgeGnAByjQYZq5i604Pg/exec",
        containerId: "",
        intervalMs: 30000, 
        lastLogCount: 0
    };

    function _createLogUI() {
        const container = document.getElementById(_config.containerId);
        if (!container) return;
        container.innerHTML = `
            <div style="margin-top:20px; font-size: 11px; color: #95a5a6; font-weight: bold;">📜 SYSTEM LOGS (AUTO-REALTIME)</div>
            <div id="log-box-inner" style="background: #1a1a1a; color: #bdc3c7; padding: 10px; border-radius: 8px; 
                 font-family: monospace; font-size: 10px; max-height: 150px; overflow-y: auto; margin-top: 5px; 
                 border: 1px solid #333; line-height: 1.6;">
                 Đang kết nối luồng Log...
            </div>
        `;
    }

    async function _fetchLogs() {
        try {
            const response = await fetch(`${_config.apiUrl}?action=getDashboardData`);
            const data = await response.json();
            if (data && data.logs) _renderLogs(data.logs);
        } catch (e) { console.error("Logger Sync Error:", e); }
    }

    function _renderLogs(logs) {
        const content = document.getElementById('log-box-inner');
        if (!content || logs.length === _config.lastLogCount) return;
        _config.lastLogCount = logs.length;

        content.innerHTML = logs.map(l => {
            let color = "#bdc3c7";
            const type = String(l[1]);
            if (type.includes("SENT") || type.includes("SUCCESS")) color = "#2ecc71";
            if (type.includes("ERR") || type.includes("FAIL")) color = "#e74c3c";
            if (type.includes("INIT")) color = "#f1c40f";
            return `<div><span style="color: #666">[${l[0]}]</span> <span style="color: ${color}; font-weight: bold;">${l[1]}</span>: ${l[2]}</div>`;
        }).reverse().join('');
        content.scrollTop = 0; 
    }

    return {
        init: function(targetId) {
            _config.containerId = targetId;
            _createLogUI();
            _fetchLogs();
            setInterval(_fetchLogs, _config.intervalMs);
            console.log("LoggerModule: Đã khởi tạo vòng lặp 30s.");
        },
        write: async function(type, message) {
            console.log(`[Client Write] ${type}: ${message}`);
            try {
                return await fetch(`${_config.apiUrl}?action=writeLog`, {
                    method: 'POST',
                    body: JSON.stringify({ type, message })
                });
            } catch (e) { console.error("Write Log Error:", e); }
        }
    };
})();

window.LoggerModule = LoggerModule;