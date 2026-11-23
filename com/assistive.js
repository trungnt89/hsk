(function() {
    const SCRIPT_SRC = (document.currentScript && document.currentScript.src) ? document.currentScript.src : '';
    const CACHE_KEY = 'assistive_menu_sections_v1';

    const DEFAULT_SECTIONS = [
        {
            title: 'Chứng chỉ',
            items: [
                { icon: '📜', label: 'Claude', href: 'claude/index.html' },
                { icon: '📘', label: 'PMP', href: 'pmp/index.html' },
                { icon: '🇯🇵', label: 'Nhật ngữ', href: 'n1/index.html' },
                { icon: '🇨🇳', label: 'Hoa ngữ', href: 'hsk/index.html' }
            ]
        },
        {
            title: 'Quản Lý Cá Nhân',
            items: [
                { icon: '🤖', label: 'Nhật ký & AI', href: 'nikki/index.html' },
                { icon: '📊', label: 'Monitoring', href: 'task/index.html' },
                { icon: '🍅', label: 'Pomodoro', href: 'pomodoro/index.html' }
            ]
        },
        {
            title: 'Hệ thống',
            items: [
                { icon: '💬', label: 'SMS', href: 'sms/index.html' },
                { icon: '⏱', label: 'Sched.', href: 'notify/index.html' },
                { icon: '🗄️', label: 'DB', href: 'db/index.html' }
            ]
        }
    ];

    function extractIconAndLabel(rawText) {
        const text = (rawText || '').replace(/\s+/g, ' ').trim();
        if (!text) return { icon: '📄', label: '' };
        const spaceMatch = text.match(/^(\S+)\s+(.+)$/);
        if (spaceMatch && !/^[A-Za-z0-9\u00C0-\u024F\u1E00-\u1EFF]+$/.test(spaceMatch[1])) {
            return { icon: spaceMatch[1], label: spaceMatch[2] };
        }
        return { icon: '📄', label: text };
    }

    function resolveIndexCandidates() {
        const candidates = [];
        const currentOrigin = window.location.origin;

        if (SCRIPT_SRC) {
            try {
                const scriptUrl = new URL(SCRIPT_SRC, window.location.href);
                if (scriptUrl.origin === currentOrigin) {
                    candidates.push(new URL('../index.html', scriptUrl.href).href);
                }
            } catch (e) {}
        }

        try {
            candidates.push(new URL('/index.html', currentOrigin).href);
        } catch (e) {}

        try {
            candidates.push(new URL('../index.html', window.location.href).href);
        } catch (e) {}

        if (SCRIPT_SRC) {
            try {
                const scriptUrl = new URL(SCRIPT_SRC, window.location.href);
                candidates.push(new URL('../index.html', scriptUrl.href).href);
            } catch (e) {}
        }

        return Array.from(new Set(candidates));
    }

    function parseSectionsFromDoc(doc, baseUrl) {
        const cards = doc.querySelectorAll('.dashboard .nav-card');
        if (!cards || cards.length === 0) return null;

        const sections = [];
        cards.forEach(card => {
            const titleEl = card.querySelector('.group-title');
            const title = titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : 'Menu';
            const linkEls = card.querySelectorAll('.group-links a[href]');
            const items = [];

            linkEls.forEach(a => {
                const rawHref = a.getAttribute('href');
                if (!rawHref) return;
                let resolvedHref = rawHref;
                try {
                    resolvedHref = new URL(rawHref, baseUrl).href;
                } catch (e) {}

                const { icon, label } = extractIconAndLabel(a.textContent);
                if (label) {
                    items.push({ icon, label, href: resolvedHref });
                }
            });

            if (items.length > 0) {
                sections.push({ title, items });
            }
        });

        return sections.length > 0 ? sections : null;
    }

    function normalizeDefaultSections(baseUrl) {
        return DEFAULT_SECTIONS.map(sec => ({
            title: sec.title,
            items: sec.items.map(item => {
                let resolved = item.href;
                try {
                    resolved = new URL(item.href, baseUrl).href;
                } catch (e) {}
                return { icon: item.icon, label: item.label, href: resolved };
            })
        }));
    }

    async function loadSectionsFromIndex() {
        const candidates = resolveIndexCandidates();
        const fallbackBase = candidates[0] || window.location.origin + '/index.html';

        // Nếu đang ở chính trang index.html thì đọc trực tiếp từ DOM
        const localSections = parseSectionsFromDoc(document, window.location.href);
        if (localSections) {
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ indexUrl: window.location.href, sections: localSections }));
            } catch (e) {}
            return { indexUrl: window.location.href, sections: localSections };
        }

        for (const indexUrl of candidates) {
            try {
                const res = await fetch(indexUrl, { cache: 'no-cache' });
                if (!res.ok) continue;
                const html = await res.text();
                const parsedDoc = new DOMParser().parseFromString(html, 'text/html');
                const sections = parseSectionsFromDoc(parsedDoc, indexUrl);
                if (sections) {
                    try {
                        localStorage.setItem(CACHE_KEY, JSON.stringify({ indexUrl, sections }));
                    } catch (e) {}
                    return { indexUrl, sections };
                }
            } catch (e) {
                console.warn('[AssistiveTouch] Không đọc được menu từ:', indexUrl, e);
            }
        }

        // Fallback cache nếu offline
        try {
            const cachedRaw = localStorage.getItem(CACHE_KEY);
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw);
                if (cached && Array.isArray(cached.sections) && cached.sections.length > 0) {
                    return cached;
                }
            }
        } catch (e) {}

        return { indexUrl: fallbackBase, sections: normalizeDefaultSections(fallbackBase) };
    }

    function isSamePage(href) {
        try {
            const target = new URL(href, window.location.href);
            const current = new URL(window.location.href);
            const norm = (p) => p.replace(/\/index\.html$/i, '/').replace(/\/+$/, '') || '/';
            return target.origin === current.origin && norm(target.pathname) === norm(current.pathname);
        } catch (e) {
            return false;
        }
    }

    function renderMenuContent(menuEl, data) {
        menuEl.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'menu-container';

        // Thanh thao tác nhanh: Home & Reload
        const topActions = document.createElement('div');
        topActions.className = 'menu-quick-actions';

        const homeLink = document.createElement('a');
        homeLink.className = 'menu-quick-btn';
        homeLink.href = data.indexUrl;
        homeLink.textContent = '🏠 Trang chủ';
        if (isSamePage(data.indexUrl)) {
            homeLink.classList.add('is-active');
        }
        homeLink.addEventListener('click', () => {
            console.log('[Navigation] Click: Home');
        });

        const reloadBtn = document.createElement('button');
        reloadBtn.type = 'button';
        reloadBtn.className = 'menu-quick-btn';
        reloadBtn.textContent = '🔄 Tải lại';
        reloadBtn.addEventListener('click', () => {
            console.log('[System] Reloading...');
            location.reload();
        });

        topActions.appendChild(homeLink);
        topActions.appendChild(reloadBtn);
        container.appendChild(topActions);

        // Các nhóm menu lấy động từ index.html
        data.sections.forEach(sec => {
            const titleEl = document.createElement('div');
            titleEl.className = 'menu-section-title';
            titleEl.textContent = sec.title;
            container.appendChild(titleEl);

            const gridEl = document.createElement('div');
            gridEl.className = 'menu-grid';

            sec.items.forEach(item => {
                const a = document.createElement('a');
                a.className = 'menu-item';
                if (isSamePage(item.href)) {
                    a.classList.add('is-active');
                }
                a.href = item.href;
                a.addEventListener('click', () => {
                    console.log(`[Navigation] Click: ${item.label}`);
                });

                const iconDiv = document.createElement('div');
                iconDiv.className = 'item-icon';
                iconDiv.textContent = item.icon;

                const labelSpan = document.createElement('span');
                labelSpan.className = 'item-label';
                labelSpan.textContent = item.label;

                a.appendChild(iconDiv);
                a.appendChild(labelSpan);
                gridEl.appendChild(a);
            });

            container.appendChild(gridEl);
        });

        menuEl.appendChild(container);
    }

    function initAssistiveTouch() {
        console.log("[AssistiveTouch] Khởi tạo menu...");
        if (!document.body) {
            console.error("[AssistiveTouch] document.body không tồn tại.");
            return;
        }

        const style = document.createElement("style");
        style.textContent = `
            #assistive-touch { position: fixed; top: 5px; left: 5px; width: 35px; height: 35px; background: rgba(0,0,0,0.2); border: 3px solid rgba(255,255,255,0.2); border-radius: 10px; z-index: 10000; cursor: move; touch-action: none; display: flex; align-items: center; justify-content: center; }
            #assistive-touch::after { content: ""; width: 18px; height: 18px; background: rgba(255,255,255,0.3); border-radius: 50%; }
            #assistive-menu { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: none; z-index: 10001; justify-content: center; align-items: center; padding: 16px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
            .menu-container { position: relative; background: rgba(28,28,30,0.96); padding: 16px; border-radius: 26px; width: 100%; max-width: 400px; max-height: 85dvh; overflow-y: auto; -webkit-overflow-scrolling: touch; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; box-sizing: border-box; border: 0.5px solid rgba(255,255,255,0.12); box-shadow: 0 20px 45px rgba(0,0,0,0.45); }
            .menu-quick-actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 10px; }
            .menu-quick-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 10px; border-radius: 12px; background: rgba(255,255,255,0.1); border: 0.5px solid rgba(255,255,255,0.12); color: #fff; font-size: 12px; font-weight: 700; text-decoration: none; cursor: pointer; font-family: inherit; transition: 0.12s; }
            .menu-quick-btn:active { transform: scale(0.96); background: rgba(255,255,255,0.18); }
            .menu-quick-btn.is-active { background: rgba(59,130,246,0.32); border-color: rgba(96,165,250,0.65); }
            .menu-section-title { color: #9ca3af; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin: 10px 0 10px 2px; border-bottom: 0.5px solid rgba(255,255,255,0.1); padding-bottom: 4px; }
            .menu-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 8px; margin-bottom: 4px; }
            .menu-item { display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: 0.12s; text-decoration: none; color: inherit; min-width: 0; }
            .menu-item:active { transform: scale(0.92); }
            .item-icon { width: 48px; height: 48px; background: #3a3a3c; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 5px; border: 1px solid transparent; transition: 0.15s; }
            .menu-item.is-active .item-icon { background: rgba(59,130,246,0.3); border-color: rgba(96,165,250,0.75); }
            .item-label { font-size: 10.5px; font-weight: 600; text-align: center; color: #fff; line-height: 1.25; word-break: break-word; }
            .menu-item.is-active .item-label { color: #93c5fd; }`;
        document.head.appendChild(style);

        const btn = Object.assign(document.createElement('div'), { id: 'assistive-touch' });
        const menu = Object.assign(document.createElement('div'), { id: 'assistive-menu' });

        // Hiển thị nhanh từ cache/mặc định trước, sau đó đồng bộ trực tiếp từ index.html
        const candidates = resolveIndexCandidates();
        const defaultBase = candidates[0] || window.location.origin + '/index.html';
        let initialData = { indexUrl: defaultBase, sections: normalizeDefaultSections(defaultBase) };
        try {
            const cachedRaw = localStorage.getItem(CACHE_KEY);
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw);
                if (cached && Array.isArray(cached.sections) && cached.sections.length > 0) {
                    initialData = cached;
                }
            }
        } catch (e) {}
        renderMenuContent(menu, initialData);

        loadSectionsFromIndex().then(freshData => {
            renderMenuContent(menu, freshData);
        });

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
        btn.addEventListener('click', () => {
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
