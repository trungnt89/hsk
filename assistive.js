(function() {
    function initAssistiveTouch() {
        // Kiểm tra nếu body chưa tồn tại thì thoát để tránh lỗi
        if (!document.body) return;

        // 1. Chèn CSS (Giữ nguyên logic cũ)
        const css = `
            #assistive-touch {
                position: fixed; top: 150px; right: 20px; width: 50px; height: 50px;
                background: rgba(0, 0, 0, 0.6); border: 4px solid rgba(255, 255, 255, 0.3);
                border-radius: 12px; z-index: 10000; cursor: move; touch-action: none;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 0 10px rgba(0,0,0,0.3); transition: transform 0.1s;
            }
            #assistive-touch::after {
                content: ""; width: 28px; height: 28px;
                background: rgba(255, 255, 255, 0.8); border-radius: 50%;
            }
            #assistive-menu {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.4); display: none; z-index: 10001;
                justify-content: center; align-items: center; backdrop-filter: blur(5px);
            }
            .menu-grid {
                display: grid; grid-template-columns: repeat(3, 80px); gap: 20px;
                background: rgba(30, 30, 30, 0.9); padding: 25px; border-radius: 20px;
            }
            .menu-item {
                display: flex; flex-direction: column; align-items: center; color: white;
                cursor: pointer; font-size: 11px; font-family: sans-serif; gap: 8px;
            }
            .item-icon {
                width: 45px; height: 45px; background: #444; border-radius: 10px;
                display: flex; align-items: center; justify-content: center; font-size: 20px;
            }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.innerText = css;
        document.head.appendChild(styleSheet);

        // 2. Tạo cấu trúc HTML
        const button = document.createElement('div');
        button.id = 'assistive-touch';
        
        const menu = document.createElement('div');
        menu.id = 'assistive-menu';
        menu.innerHTML = `
            <div class="menu-grid">
                <div class="menu-item" onclick="window.history.back()">
                    <div class="item-icon">⬅️</div><span>Back</span>
                </div>
                <div class="menu-item" onclick="location.reload()">
                    <div class="item-icon">🔄</div><span>Reload</span>
                </div>
                <div class="menu-item" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
                    <div class="item-icon">⬆️</div><span>Top</span>
                </div>
                <div class="menu-item" onclick="location.href='index.html'">
                    <div class="item-icon">🏠</div><span>Home</span>
                </div>
                <div class="menu-item" id="close-menu">
                    <div class="item-icon">❌</div><span>Close</span>
                </div>
            </div>
        `;

        document.body.appendChild(button);
        document.body.appendChild(menu);

        // 3. Logic Drag & Drop (Giữ nguyên)
        let isDragging = false;
        let startPos = { x: 0, y: 0 };
        let offset = { x: 0, y: 0 };

        const onStart = (e) => {
            isDragging = false;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startPos.x = clientX;
            startPos.y = clientY;
            offset.x = clientX - button.offsetLeft;
            offset.y = clientY - button.offsetTop;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('touchmove', onMove, { passive: false });
        };

        const onMove = (e) => {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            // Chỉ coi là drag nếu di chuyển hơn 5px
            if (Math.abs(clientX - startPos.x) > 5 || Math.abs(clientY - startPos.y) > 5) {
                isDragging = true;
            }

            if (isDragging) {
                e.preventDefault();
                let x = clientX - offset.x;
                let y = clientY - offset.y;
                x = Math.max(0, Math.min(x, window.innerWidth - 50));
                y = Math.max(0, Math.min(y, window.innerHeight - 50));
                button.style.left = x + 'px';
                button.style.top = y + 'px';
                button.style.right = 'auto';
            }
        };

        const onEnd = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('touchmove', onMove);
        };

        button.addEventListener('mousedown', onStart);
        button.addEventListener('touchstart', onStart);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchend', onEnd);

        button.addEventListener('click', () => {
            if (!isDragging) menu.style.display = 'flex';
        });

        menu.addEventListener('click', (e) => {
            if (e.target === menu || e.target.closest('#close-menu')) {
                menu.style.display = 'none';
            }
        });
    }

    // Đợi DOM sẵn sàng rồi mới chạy để tránh lỗi appendChild trên null
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAssistiveTouch);
    } else {
        initAssistiveTouch();
    }
})();