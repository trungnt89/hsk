(function() {
    // --- ASSISTIVE TOUCH UI ---
    function initAssistiveTouch() {
        console.log("[Log] Initializing Assistive Touch with Hub links...");
        if (!document.body) return;

        const styleSheet = document.createElement("style");
        styleSheet.innerText = `
            #assistive-touch { position: fixed; top: 150px; right: 20px; width: 50px; height: 50px; background: rgba(0, 0, 0, 0.6); border: 4px solid rgba(255, 255, 255, 0.3); border-radius: 12px; z-index: 10000; cursor: move; touch-action: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(0,0,0,0.3); }
            #assistive-touch::after { content: ""; width: 28px; height: 28px; background: rgba(255, 255, 255, 0.8); border-radius: 50%; }
            #assistive-menu { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: none; z-index: 10001; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
            .menu-grid { display: grid; grid-template-columns: repeat(3, 80px); gap: 15px; background: rgba(30, 30, 30, 0.9); padding: 25px; border-radius: 24px; max-width: 90vw; }
            .menu-item { display: flex; flex-direction: column; align-items: center; color: white; cursor: pointer; font-size: 11px; font-family: sans-serif; gap: 8px; }
            .item-icon { width: 45px; height: 45px; background: #444; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
            @keyframes slideUp { from { bottom: -50px; opacity: 0; } to { bottom: 30px; opacity: 1; } }
        `;
        document.head.appendChild(styleSheet);

        const button = document.createElement('div');
        button.id = 'assistive-touch';
        const menu = document.createElement('div');
        menu.id = 'assistive-menu';
        menu.innerHTML = `
            <div class="menu-grid">
                <div class="menu-item" onclick="window.history.back()"><div class="item-icon">⬅️</div><span>Back</span></div>
                <div class="menu-item" onclick="location.reload()"><div class="item-icon">🔄</div><span>Reload</span></div>
                <div class="menu-item" onclick="location.href='/index.html'"><div class="item-icon">🏠</div><span>Home</span></div>
                <div class="menu-item" onclick="location.href='/pmp/index.html'"><div class="item-icon">📘</div><span>PMP</span></div>
                <div class="menu-item" onclick="location.href='/jp/index.html'"><div class="item-icon">🇯🇵</div><span>Japan</span></div>
                <div class="menu-item" onclick="location.href='/hsk/index.html'"><div class="item-icon">🇨🇳</div><span>HSK</span></div>
                <div class="menu-item" onclick="location.href='/task/index.html'"><div class="item-icon">📊</div><span>Tasks</span></div>
                <div class="menu-item" onclick="location.href='/pomodoro/index.html'"><div class="item-icon">🍅</div><span>Pomo</span></div>
                <div class="menu-item" onclick="location.href='/sms/index.html'"><div class="item-icon">💬</div><span>SMS</span></div>
                <div class="menu-item" onclick="location.href='/notify/index.html'"><div class="item-icon">⏱</div><span>Sched</span></div>
                <div class="menu-item" onclick="location.href='/db/index.html'"><div class="item-icon">🗄️</div><span>DB</span></div>
                <div class="menu-item" id="close-menu"><div class="item-icon">❌</div><span>Close</span></div>
            </div>`;

        document.body.appendChild(button);
        document.body.appendChild(menu);

        // Logic Drag & Drop
        let isDragging = false, startPos = { x: 0, y: 0 }, offset = { x: 0, y: 0 };
        const onStart = (e) => {
            console.log("[Log] Touch/Mouse start");
            const cX = e.touches ? e.touches[0].clientX : e.clientX;
            const cY = e.touches ? e.touches[0].clientY : e.clientY;
            isDragging = false; startPos.x = cX; startPos.y = cY;
            offset.x = cX - button.offsetLeft; offset.y = cY - button.offsetTop;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('touchmove', onMove, { passive: false });
        };
        const onMove = (e) => {
            const cX = e.touches ? e.touches[0].clientX : e.clientX;
            const cY = e.touches ? e.touches[0].clientY : e.clientY;
            if (Math.abs(cX - startPos.x) > 5 || Math.abs(cY - startPos.y) > 5) isDragging = true;
            if (isDragging) {
                e.preventDefault();
                let x = Math.max(0, Math.min(cX - offset.x, window.innerWidth - 50));
                let y = Math.max(0, Math.min(cY - offset.y, window.innerHeight - 50));
                button.style.left = x + 'px'; button.style.top = y + 'px'; button.style.right = 'auto';
            }
        };
        button.addEventListener('mousedown', onStart);
        button.addEventListener('touchstart', onStart);
        window.addEventListener('mouseup', () => { 
            if(isDragging) console.log("[Log] Drag ended");
            document.removeEventListener('mousemove', onMove); 
            document.removeEventListener('touchmove', onMove); 
        });

        // Logic Click
        button.addEventListener('click', () => { 
            if (!isDragging) {
                console.log("[Log] Menu opened");
                menu.style.display = 'flex'; 
            }
        });
        menu.addEventListener('click', (e) => {
            if (e.target === menu || e.target.closest('#close-menu')) {
                console.log("[Log] Menu closed");
                menu.style.display = 'none';
            }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAssistiveTouch);
    else initAssistiveTouch();
})();