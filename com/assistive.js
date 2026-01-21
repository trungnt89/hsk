(function() {
    // --- ASSISTIVE TOUCH UI ---
    function initAssistiveTouch() {
        console.log("[Log] Initializing 3x3 Menu at Mid-Left position...");
        if (!document.body) return;

        const styleSheet = document.createElement("style");
        styleSheet.innerText = `
            #assistive-touch { 
                position: fixed; 
                top: 40%; 
                left: 0px; 
                transform: translateY(-50%); 
                width: 50px; 
                height: 50px; 
                background: rgba(0, 0, 0, 0.3); 
                border: 4px solid rgba(255, 255, 255, 0.3); 
                border-radius: 12px; 
                z-index: 10000; 
                cursor: move; 
                touch-action: none; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                box-shadow: 0 0 10px rgba(0,0,0,0.3); 
            }
            #assistive-touch::after { content: ""; width: 28px; height: 28px; background: rgba(255, 255, 255, 0.8); border-radius: 50%; }
            #assistive-menu { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: none; z-index: 10001; justify-content: center; align-items: center; backdrop-filter: blur(8px); }
            
            .menu-container { position: relative; background: rgba(28, 28, 30, 0.95); padding: 18px; border-radius: 30px; width: 240px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); border: 0.5px solid rgba(255,255,255,0.1); font-family: -apple-system, sans-serif; }
            .menu-section-title { color: #8e8e93; font-size: 9px; font-weight: 700; text-transform: uppercase; margin: 5px 0 10px 4px; letter-spacing: 0.5px; border-bottom: 0.5px solid rgba(255,255,255,0.1); padding-bottom: 3px; width: 100%; box-sizing: border-box; }
            .menu-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
            
            .menu-item { display: flex; flex-direction: column; align-items: center; color: white; cursor: pointer; transition: transform 0.1s; }
            .menu-item:active { transform: scale(0.9); }
            .item-icon { width: 44px; height: 44px; background: #3a3a3c; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 4px; }
            .item-label { font-size: 9px; font-weight: 500; text-align: center; color: #efeff4; }
        `;
        document.head.appendChild(styleSheet);

        const button = document.createElement('div');
        button.id = 'assistive-touch';
        const menu = document.createElement('div');
        menu.id = 'assistive-menu';
        
        menu.innerHTML = `
            <div class="menu-container">
                <div class="menu-section-title">Năng suất</div>
                <div class="menu-grid">
                    <div class="menu-item" onclick="location.href='../index.html'"><div class="item-icon">🏠</div><span class="item-label">Home</span></div>
                    <div class="menu-item" onclick="location.href='../task/index.html'"><div class="item-icon">📊</div><span class="item-label">Tasks</span></div>
                    <div class="menu-item" onclick="location.href='../pomodoro/index.html'"><div class="item-icon">🍅</div><span class="item-label">Pomo</span></div>
                </div>
                <div class="menu-section-title">Học tập</div>
                <div class="menu-grid">
                    <div class="menu-item" onclick="location.href='../pmp/index.html'"><div class="item-icon">📘</div><span class="item-label">PMP</span></div>
                    <div class="menu-item" onclick="location.href='../jp/index.html'"><div class="item-icon">🇯🇵</div><span class="item-label">Japan</span></div>
                    <div class="menu-item" onclick="location.href='../hsk/index.html'"><div class="item-icon">🇨🇳</div><span class="item-label">HSK</span></div>
                </div>
                <div class="menu-section-title">Hệ thống</div>
                <div class="menu-grid">
                    <div class="menu-item" onclick="location.href='../db/index.html'"><div class="item-icon">🗄️</div><span class="item-label">DB</span></div>
                    <div class="menu-item" onclick="location.href='../sms/index.html'"><div class="item-icon">💬</div><span class="item-label">SMS</span></div>
                    <div class="menu-item" onclick="location.reload()"><div class="item-icon">🔄</div><span class="item-label">Reload</span></div>
                </div>
            </div>`;

        document.body.appendChild(button);
        document.body.appendChild(menu);

        let isDragging = false, startPos = { x: 0, y: 0 }, offset = { x: 0, y: 0 };

        const onStart = (e) => {
            const touch = e.touches ? e.touches[0] : e;
            isDragging = false; 
            startPos.x = touch.clientX; 
            startPos.y = touch.clientY;
            
            const rect = button.getBoundingClientRect();
            offset.x = touch.clientX - rect.left; 
            offset.y = touch.clientY - rect.top;

            document.addEventListener('mousemove', onMove);
            document.addEventListener('touchmove', onMove, { passive: false });
        };
        
        const onMove = (e) => {
            const touch = e.touches ? e.touches[0] : e;
            if (Math.abs(touch.clientX - startPos.x) > 5 || Math.abs(touch.clientY - startPos.y) > 5) {
                isDragging = true;
            }
            if (isDragging) {
                if (e.cancelable) e.preventDefault();
                const x = Math.max(0, Math.min(touch.clientX - offset.x, window.innerWidth - 50));
                const y = Math.max(0, Math.min(touch.clientY - offset.y, window.innerHeight - 50));
                
                button.style.transform = 'none'; // Tắt transform căn giữa khi kéo
                button.style.setProperty('left', x + 'px', 'important');
                button.style.setProperty('top', y + 'px', 'important');
                button.style.right = 'auto';
                button.style.bottom = 'auto';
            }
        };

        const onEnd = () => {
            if (isDragging) {
                const rect = button.getBoundingClientRect();
                button.style.left = rect.left + 'px';
                button.style.top = rect.top + 'px';
                console.log("[Log] Drag ended at: " + rect.left + ", " + rect.top);
            }
            document.removeEventListener('mousemove', onMove); 
            document.removeEventListener('touchmove', onMove); 
        };

        button.addEventListener('mousedown', onStart);
        button.addEventListener('touchstart', onStart, { passive: false });
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchend', onEnd);

        button.addEventListener('click', (e) => { 
            if (isDragging) {
                e.preventDefault();
                e.stopPropagation();
            } else {
                console.log("[Log] Menu opened");
                menu.style.display = 'flex'; 
            }
        }, true);

        menu.addEventListener('click', (e) => {
            if (e.target === menu) {
                console.log("[Log] Menu closed");
                menu.style.display = 'none';
            }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAssistiveTouch);
    else initAssistiveTouch();
})();