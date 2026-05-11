(function() {
    function initAssistiveTouch() {
        console.log("[AssistiveTouch] Khởi tạo menu..."); 
        if (!document.body) {
            console.error("[AssistiveTouch] document.body không tồn tại.");
            return;
        }
        
        const style = document.createElement("style");
        style.innerText = `
            #assistive-touch { position: fixed; top: 5px; left: 5px; width: 35px; height: 35px; background: rgba(0,0,0,0.2); border: 3px solid rgba(255,255,255,0.2); border-radius: 10px; z-index: 10000; cursor: move; touch-action: none; display: flex; align-items: center; justify-content: center; }
            #assistive-touch::after { content: ""; width: 18px; height: 18px; background: rgba(255,255,255,0.3); border-radius: 50%; }
            #assistive-menu { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: none; z-index: 10001; justify-content: center; align-items: center; backdrop-filter: blur(8px); }
            .menu-container { position: relative; background: rgba(28,28,30,0.96); padding: 20px; border-radius: 30px; width: 90%; max-width: 400px; font-family: -apple-system, sans-serif; box-sizing: border-box; border: 0.5px solid rgba(255,255,255,0.1); }
            .menu-section-title { color: #8e8e93; font-size: 10px; font-weight: 700; text-transform: uppercase; margin: 5px 0 12px 4px; border-bottom: 0.5px solid rgba(255,255,255,0.1); padding-bottom: 4px; }
            .menu-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
            .menu-item { display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: 0.1s; text-decoration: none; color: inherit; }
            .menu-item:active { transform: scale(0.9); }
            .item-icon { width: 52px; height: 52px; background: #3a3a3c; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 6px; }
            .item-label { font-size: 11px; font-weight: 600; text-align: center; color: #fff; }`;
        document.head.appendChild(style);

        const btn = Object.assign(document.createElement('div'), { id: 'assistive-touch' });
        const menu = Object.assign(document.createElement('div'), { id: 'assistive-menu' });
        
        menu.innerHTML = `<div class="menu-container">
            <div class="menu-section-title">Năng suất</div>
            <div class="menu-grid">
                <a class="menu-item" href="../index.html" onclick="console.log('[Navigation] Click: Home')"><div class="item-icon">🏠</div><span class="item-label">Home</span></a>
                <a class="menu-item" href="../task/index.html" onclick="console.log('[Navigation] Click: Tasks')"><div class="item-icon">📊</div><span class="item-label">Tasks</span></a>
                <a class="menu-item" href="../pomodoro/index.html" onclick="console.log('[Navigation] Click: Pomo')"><div class="item-icon">🍅</div><span class="item-label">Pomo</span></a>
            </div>
            <div class="menu-section-title">Học tập</div>
            <div class="menu-grid">
                <a class="menu-item" href="../pmp/index.html" onclick="console.log('[Navigation] Click: PMP')"><div class="item-icon">📘</div><span class="item-label">PMP</span></a>
                <a class="menu-item" href="../n1/index.html" onclick="console.log('[Navigation] Click: Japan')"><div class="item-icon">🇯🇵</div><span class="item-label">Japan</span></a>
                <a class="menu-item" href="../hsk/index.html" onclick="console.log('[Navigation] Click: HSK')"><div class="item-icon">🇨🇳</div><span class="item-label">HSK</span></a>
                <a class="menu-item" href="../nikki/index.html" onclick="console.log('[Navigation] Click: NIKKI')"><div class="item-icon">📒</div><span class="item-label">NIKKI</span></a>
                <a class="menu-item" href="https://hsk-gilt.vercel.app/index2.html" onclick="console.log('[Navigation] Click: Links')"><div class="item-icon">🔗</div><span class="item-label">Links</span></a>
                <a class="menu-item" href="../mp3/index.html" onclick="console.log('[Navigation] Click: MP3')"><div class="item-icon">🧭</div><span class="item-label">MP3</span></a>
            </div>
            <div class="menu-section-title">Hệ thống</div>
            <div class="menu-grid">
                <a class="menu-item" href="../db/index.html" onclick="console.log('[Navigation] Click: DB')"><div class="item-icon">🗄️</div><span class="item-label">DB</span></a>
                <a class="menu-item" href="../log/index.html" onclick="console.log('[Navigation] Click: Logs')"><div class="item-icon">📜</div><span class="item-label">Logs</span></a>
                <div class="menu-item" onclick="console.log('[System] Reloading...'); location.reload()"><div class="item-icon">🔄</div><span class="item-label">Reload</span></div>
            </div></div>`;

        [btn, menu].forEach(el => document.body.appendChild(el));

        let drag = false, start = { x: 0, y: 0 }, off = { x: 0, y: 0 };
        const move = (e) => {
            const t = e.touches ? e.touches[0] : e;
            if (Math.abs(t.clientX - start.x) > 5 || Math.abs(t.clientY - start.y) > 5) drag = true;
            if (drag) {
                if (e.cancelable) e.preventDefault();
                btn.style.left = Math.max(0, Math.min(t.clientX - off.x, window.innerWidth - 35)) + 'px';
                btn.style.top = Math.max(0, Math.min(t.clientY - off.y, window.innerHeight - 35)) + 'px';
            }
        };

        btn.addEventListener('touchstart', (e) => {
            drag = false; const t = e.touches[0]; start = { x: t.clientX, y: t.clientY };
            const r = btn.getBoundingClientRect(); off = { x: t.clientX - r.left, y: t.clientY - r.top };
            document.addEventListener('touchmove', move, { passive: false });
        });
        window.addEventListener('touchend', () => {
            if (drag) console.log(`[AssistiveTouch] Đã di chuyển tới vị trí mới: x=${btn.style.left}, y=${btn.style.top}`);
            document.removeEventListener('touchmove', move);
        });
        btn.addEventListener('click', (e) => {
            if (!drag) {
                console.log("[AssistiveTouch] Mở menu.");
                menu.style.display = 'flex';
            }
        });
        menu.addEventListener('click', (e) => {
            if (e.target === menu) {
                console.log("[AssistiveTouch] Đóng menu.");
                menu.style.display = 'none';
            }
        });
    }
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', initAssistiveTouch) : initAssistiveTouch();
})();
