// ==UserScript==
// @name         Safari iOS Website Blocker
// @namespace    safari.ios.website.blocker
// @version      1.2.0
// @description  Chặn các trang web theo danh sách cài đặt trên trình duyệt Safari của iPhone / iPad
// @author       AI Assistant
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// ==/UserScript==

/**
 * ============================================================================
 * SAFARI IOS WEBSITE BLOCKER (SINGLE-FILE USERSCRIPT)
 * ============================================================================
 * Tương thích hoàn toàn với trình duyệt Safari trên iPhone / iPad thông qua
 * các tiện ích mở rộng như: Userscripts (App Store), Stay, AdGuard, Orion.
 *
 * TÍNH NĂNG CHÍNH:
 * 1. Chặn tức thì ngay khi bắt đầu tải trang (@run-at document-start, window.stop()).
 * 2. Danh sách chặn có thể tùy chỉnh (Thêm, Xóa, Bật/Tắt từng tên miền hoặc từ khóa).
 * 3. Giao diện chặn thiết kế chuẩn phong cách Apple iOS (hỗ trợ Light / Dark mode).
 * 4. Bảng điều khiển cài đặt nổi tích hợp ngay trên màn hình chặn hoặc mở bằng
 *    cách thêm '#safari-blocker-settings' vào cuối địa chỉ web.
 * 5. Tùy chọn chuyển hướng (Redirect) hoặc hiển thị màn hình khóa tập trung.
 * 6. Tùy chọn đặt mã PIN 4 số và tính năng bỏ chặn tạm thời 5-15 phút.
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. CẤU HÌNH MẶC ĐỊNH (DEFAULT CONFIGURATION)
  // ==========================================================================
  const DEFAULT_CONFIG = {
    enabled: true,
    // Danh sách các trang web bị chặn mặc định
    blockedSites: [
      { domain: 'bloxd.io', note: 'Game', enabled: true },
	  { domain: 'poki.com', note: 'Game', enabled: true },
      { domain: 'facebook.com', note: 'Mạng xã hội', enabled: true },
      { domain: 'tiktok.com', note: 'Video ngắn', enabled: true },
      { domain: 'instagram.com', note: 'Mạng xã hội', enabled: true },
      { domain: 'x.com', note: 'Mạng xã hội X', enabled: true },
      { domain: 'twitter.com', note: 'Twitter cũ', enabled: true },
      { domain: 'threads.net', note: 'Threads', enabled: true },
	  { domain: 'youtube.com', note: 'YouTube Shorts', enabled: true },
      { domain: 'youtube.com/shorts', note: 'YouTube Shorts', enabled: true },
      { domain: 'reddit.com', note: 'Diễn đàn', enabled: true }
    ],
    // Hành động khi chặn: 'blockScreen' (hiển thị trang chặn) hoặc 'redirect' (chuyển hướng)
    blockAction: 'blockScreen',
    redirectUrl: 'https://www.google.com',
    // Khóa bằng mã PIN (để trống nếu không dùng PIN)
    pinCode: ''
  };

  const STORAGE_KEY = 'safari_ios_blocker_config_v1';

  // ==========================================================================
  // 2. LƯU TRỮ VÀ ĐỌC DỮ LIỆU (STORAGE ADAPTER HỖ TRỢ ĐỒNG BỘ TOÀN CỤC)
  // ==========================================================================
  function loadConfig() {
    let raw = null;
    try {
      if (typeof GM_getValue === 'function') {
        raw = GM_getValue(STORAGE_KEY, null);
      }
    } catch (_) {}

    if (raw === null || raw === undefined) {
      try {
        if (typeof GM !== 'undefined' && GM.getValue) {
          raw = GM.getValue(STORAGE_KEY, null);
        }
      } catch (_) {}
    }

    if (raw === null || raw === undefined) {
      try {
        raw = localStorage.getItem(STORAGE_KEY);
      } catch (_) {}
    }

    if (raw === null || raw === undefined) {
      return {
        enabled: DEFAULT_CONFIG.enabled,
        blockedSites: DEFAULT_CONFIG.blockedSites.map(s => ({ ...s })),
        blockAction: DEFAULT_CONFIG.blockAction,
        redirectUrl: DEFAULT_CONFIG.redirectUrl,
        pinCode: DEFAULT_CONFIG.pinCode
      };
    }

    try {
      let parsed = raw;
      if (typeof raw === 'string') {
        try {
          parsed = JSON.parse(raw);
          // Trường hợp bị JSON.stringify 2 lần
          if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
          }
        } catch (_) {
          parsed = null;
        }
      }
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.blockedSites)) {
        return {
          enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_CONFIG.enabled,
          blockedSites: parsed.blockedSites.map(s => ({
            domain: cleanDomainInput(s.domain || ''),
            note: s.note || '',
            enabled: s.enabled !== false
          })),
          blockAction: parsed.blockAction || DEFAULT_CONFIG.blockAction,
          redirectUrl: parsed.redirectUrl || DEFAULT_CONFIG.redirectUrl,
          pinCode: parsed.pinCode || ''
        };
      }
    } catch (e) {
      console.warn('[SafariBlocker] Lỗi phân tích dữ liệu cấu hình:', e);
    }

    return {
      enabled: DEFAULT_CONFIG.enabled,
      blockedSites: DEFAULT_CONFIG.blockedSites.map(s => ({ ...s })),
      blockAction: DEFAULT_CONFIG.blockAction,
      redirectUrl: DEFAULT_CONFIG.redirectUrl,
      pinCode: DEFAULT_CONFIG.pinCode
    };
  }

  let currentConfig = loadConfig();

  function saveConfig(config) {
    if (!config || !Array.isArray(config.blockedSites)) return;
    
    // Cập nhật cấu hình bộ nhớ hiện tại
    currentConfig = config;

    const jsonStr = JSON.stringify(config);
    let saved = false;

    // 1. Lưu qua GM_setValue (Hỗ trợ chia sẻ đa tên miền trên Safari Userscripts / Stay)
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(STORAGE_KEY, jsonStr);
        // Lưu dự phòng cả object nếu extension hỗ trợ lưu object trực tiếp
        try { GM_setValue(STORAGE_KEY + '_obj', config); } catch (_) {}
        saved = true;
      }
    } catch (e) {
      console.warn('[SafariBlocker] GM_setValue error:', e);
    }

    // 2. Lưu qua GM.setValue nếu có
    try {
      if (typeof GM !== 'undefined' && GM.setValue) {
        GM.setValue(STORAGE_KEY, jsonStr);
        saved = true;
      }
    } catch (_) {}

    // 3. Luôn lưu dự phòng vào localStorage của trang hiện tại
    try {
      localStorage.setItem(STORAGE_KEY, jsonStr);
      saved = true;
    } catch (_) {}

    return saved;
  }

  // ==========================================================================
  // 3. LOGIC CHUẨN HÓA VÀ KIỂM TRA ĐỊA CHỈ TRANG WEB (ROBUST MATCHING ENGINE)
  // ==========================================================================
  function cleanDomainInput(input) {
    if (!input) return '';
    let str = input.trim().toLowerCase();
    // Bỏ protocol http://, https://
    str = str.replace(/^https?:\/\//i, '');
    // Bỏ tiền tố www.
    str = str.replace(/^www\./i, '');
    // Bỏ query parameters ?... hoặc hash #...
    str = str.split('?')[0].split('#')[0];
    // Bỏ dấu gạch chéo cuối cùng
    str = str.replace(/\/+$/, '');
    return str;
  }

  function isSiteBlocked(config) {
    if (!config || !config.enabled || !Array.isArray(config.blockedSites)) return null;

    const rawHost = (window.location.hostname || '').toLowerCase();
    const cleanCurrentHost = rawHost.replace(/^www\./i, '');
    const cleanCurrentHref = (window.location.href || '')
      .toLowerCase()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '');

    for (const item of config.blockedSites) {
      if (!item || !item.enabled) continue;
      const target = cleanDomainInput(item.domain);
      if (!target) continue;

      // 1. Kiểm tra trường hợp chặn đường dẫn cụ thể (ví dụ: youtube.com/shorts hoặc facebook.com/reel)
      if (target.includes('/')) {
        if (cleanCurrentHref.startsWith(target) || cleanCurrentHref.includes(target)) {
          return item;
        }
      } else {
        // 2. Kiểm tra tên miền (ví dụ: "tiktok.com" sẽ khớp với "tiktok.com", "m.tiktok.com", "v.tiktok.com")
        const targetDomain = target.split('/')[0];
        if (
          cleanCurrentHost === targetDomain ||
          rawHost === targetDomain ||
          rawHost.endsWith('.' + targetDomain) ||
          cleanCurrentHost.endsWith('.' + targetDomain)
        ) {
          return item;
        }
      }
    }

    return null;
  }

  // ==========================================================================
  // 4. MÀN HÌNH CHẶN SAFARI IPHONE (NATIVE IOS BLOCK SCREEN)
  // ==========================================================================
  function renderBlockScreen(matchedRule, config) {
    try {
      window.stop();
    } catch (_) {}

    document.title = 'Trang web đã bị chặn - Safari';

    const blockedDomain = matchedRule.domain;
    const note = matchedRule.note ? ` (${matchedRule.note})` : '';

    const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Trang web đã bị chặn</title>
  <style>
    :root {
      --bg: #f2f2f7;
      --card-bg: #ffffff;
      --text: #000000;
      --subtext: #8e8e93;
      --tint: #007aff;
      --destructive: #ff3b30;
      --border: #e5e5ea;
      --badge-bg: #ffebee;
      --badge-text: #d32f2f;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #000000;
        --card-bg: #1c1c1e;
        --text: #ffffff;
        --subtext: #8e8e93;
        --tint: #0a84ff;
        --destructive: #ff453a;
        --border: #2c2c2e;
        --badge-bg: #3a1d1d;
        --badge-text: #ff6961;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif;
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px 20px;
      text-align: center;
    }
    .card {
      background: var(--card-bg);
      border-radius: 24px;
      padding: 36px 24px 28px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
      border: 1px solid var(--border);
      animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes popIn {
      0% { opacity: 0; transform: scale(0.92); }
      100% { opacity: 1; transform: scale(1); }
    }
    .icon-wrapper {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      background: var(--badge-bg);
      color: var(--badge-text);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 38px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 8px;
      letter-spacing: -0.4px;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 12px;
      background: var(--badge-bg);
      color: var(--badge-text);
      font-weight: 600;
      font-size: 14px;
      word-break: break-all;
      margin-bottom: 14px;
    }
    p {
      color: var(--subtext);
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .btn-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    }
    .btn {
      padding: 14px 18px;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: opacity 0.2s, transform 0.1s;
    }
    .btn:active {
      transform: scale(0.98);
      opacity: 0.85;
    }
    .btn-primary {
      background: var(--tint);
      color: #ffffff;
    }
    .btn-secondary {
      background: var(--bg);
      color: var(--tint);
      border: 1px solid var(--border);
    }
    .btn-text {
      background: transparent;
      color: var(--subtext);
      font-size: 14px;
      padding: 8px;
    }
    .footer-info {
      margin-top: 24px;
      font-size: 12px;
      color: var(--subtext);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrapper">🛡️</div>
    <h1>Trang web đã bị chặn</h1>
    <div class="badge">${blockedDomain}${note}</div>
    <p>Trang web này nằm trong danh sách bị chặn trên Safari iPhone của bạn để giúp bạn tập trung và an toàn hơn.</p>
    
    <div class="btn-group">
      <button class="btn btn-primary" id="btn-back">← Quay lại trang trước</button>
      <button class="btn btn-secondary" id="btn-settings">⚙️ Cài đặt danh sách chặn</button>
    </div>
  </div>
  <div class="footer-info">Safari iOS Website Blocker</div>
</body>
</html>
    `;

    document.documentElement.innerHTML = htmlContent;

    // Gắn sự kiện cho các nút bấm trên màn hình chặn
    setTimeout(() => {
      const btnBack = document.getElementById('btn-back');
      if (btnBack) {
        btnBack.onclick = () => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = 'about:blank';
          }
        };
      }

      const btnSettings = document.getElementById('btn-settings');
      if (btnSettings) {
        btnSettings.onclick = () => {
          openSettingsModal(config);
        };
      }

      // Tạo nút nổi AssistiveTouch trên màn hình hiện tại
      createAssistiveButton(config);
    }, 50);
  }

  // ==========================================================================
  // 5. BẢNG ĐIỀU KHIỂN CÀI ĐẶT (SETTINGS MODAL)
  // ==========================================================================
  function openSettingsModal(passedConfig) {
    // Luôn nạp dữ liệu cấu hình mới nhất từ bộ nhớ lưu trữ
    const freshConfig = loadConfig();
    const config = passedConfig || freshConfig;
    if (freshConfig && freshConfig.blockedSites) {
      config.blockedSites = freshConfig.blockedSites;
      config.enabled = freshConfig.enabled;
      config.blockAction = freshConfig.blockAction;
      config.redirectUrl = freshConfig.redirectUrl;
      config.pinCode = freshConfig.pinCode;
    }

    const existing = document.getElementById('safari-blocker-modal');
    if (existing) existing.remove();

    if (config.pinCode) {
      const entered = prompt('Nhập mã PIN để mở cài đặt:');
      if (entered !== config.pinCode) {
        alert('Mã PIN không đúng!');
        return;
      }
    }

    const modal = document.createElement('div');
    modal.id = 'safari-blocker-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    `;

    function renderListItems() {
      return config.blockedSites
        .map(
          (item, idx) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#f9f9f9;border-radius:12px;margin-bottom:8px;border:1px solid #eee;">
          <div style="flex:1;overflow:hidden;padding-right:8px;">
            <div style="font-weight:600;font-size:14px;color:#111;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">${item.domain}</div>
            <div style="font-size:12px;color:#777;">${item.note || 'Không có ghi chú'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button type="button" data-action="toggle" data-index="${idx}" style="background:${item.enabled ? '#007aff' : '#ccc'};color:#fff;border:none;padding:5px 10px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
              ${item.enabled ? 'Đang chặn' : 'Đã tắt'}
            </button>
            <button type="button" data-action="delete" data-index="${idx}" style="background:#ff3b30;color:#fff;border:none;padding:5px 9px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
              ✕
            </button>
          </div>
        </div>
      `
        )
        .join('');
    }

    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;max-width:440px;width:100%;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.25);">
        <div style="padding:18px 20px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;">
          <h2 style="font-size:18px;font-weight:700;color:#111;margin:0;">⚙️ Cài đặt Safari Blocker</h2>
          <button id="sbm-close" style="background:#eee;border:none;width:32px;height:32px;border-radius:50%;font-size:16px;font-weight:bold;cursor:pointer;color:#555;">✕</button>
        </div>

        <div style="padding:16px 20px;overflow-y:auto;flex:1;">
          <div style="margin-bottom:16px;background:#f2f2f7;padding:12px;border-radius:14px;">
            <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:8px;">➕ Thêm trang web chặn mới:</div>
            <div style="display:flex;gap:8px;margin-bottom:8px;">
              <input id="sbm-new-domain" type="text" placeholder="vd: tiktok.com hoặc x.com" style="flex:1;padding:10px 12px;border:1px solid #ccc;border-radius:10px;font-size:14px;outline:none;" />
            </div>
            <div style="display:flex;gap:8px;">
              <input id="sbm-new-note" type="text" placeholder="Ghi chú (vd: Mạng xã hội)" style="flex:1;padding:10px 12px;border:1px solid #ccc;border-radius:10px;font-size:14px;outline:none;" />
              <button id="sbm-btn-add" style="background:#007aff;color:#fff;border:none;padding:10px 16px;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer;white-space:nowrap;">Thêm</button>
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="font-size:13px;font-weight:600;color:#555;">Danh sách trang web (${config.blockedSites.length}):</span>
            <button id="sbm-btn-reset" style="background:transparent;border:none;color:#ff3b30;font-size:12px;cursor:pointer;">Đặt lại mặc định</button>
          </div>

          <div id="sbm-list-container">
            ${renderListItems()}
          </div>

          <div style="margin-top:16px;padding-top:16px;border-top:1px solid #eee;">
            <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:8px;">🔒 Bảo vệ cài đặt bằng mã PIN:</div>
            <div style="display:flex;gap:8px;">
              <input id="sbm-pin" type="password" maxlength="8" placeholder="Nhập PIN (để trống nếu không dùng)" value="${config.pinCode || ''}" style="flex:1;padding:10px 12px;border:1px solid #ccc;border-radius:10px;font-size:14px;outline:none;" />
              <button id="sbm-save-pin" style="background:#34c759;color:#fff;border:none;padding:10px 14px;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer;">Lưu PIN</button>
            </div>
          </div>
        </div>

        <div style="padding:14px 20px;border-top:1px solid #eee;display:flex;justify-content:flex-end;">
          <button id="sbm-done" style="background:#007aff;color:#fff;border:none;padding:10px 24px;border-radius:12px;font-weight:600;font-size:15px;cursor:pointer;">Hoàn tất</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    function updateList() {
      const container = document.getElementById('sbm-list-container');
      if (container) container.innerHTML = renderListItems();
      saveConfig(config);
    }

    function checkCurrentPageAfterConfigChange() {
      const matched = isSiteBlocked(currentConfig);
      if (matched) {
        modal.remove();
        if (currentConfig.blockAction === 'redirect' && currentConfig.redirectUrl) {
          window.location.replace(currentConfig.redirectUrl);
        } else {
          renderBlockScreen(matched, currentConfig);
        }
      }
    }

    modal.addEventListener('click', (e) => {
      const target = e.target;
      if (target.id === 'sbm-close' || target.id === 'sbm-done' || target === modal) {
        modal.remove();
        checkCurrentPageAfterConfigChange();
        return;
      }

      if (target.id === 'sbm-btn-add') {
        const domainInput = document.getElementById('sbm-new-domain');
        const noteInput = document.getElementById('sbm-new-note');
        let domain = cleanDomainInput(domainInput ? domainInput.value : '');
        const note = (noteInput ? noteInput.value : '').trim();
        if (!domain) {
          alert('Vui lòng nhập tên miền hoặc địa chỉ hợp lệ cần chặn (ví dụ: facebook.com)!');
          return;
        }
        config.blockedSites.unshift({ domain, note, enabled: true });
        if (domainInput) domainInput.value = '';
        if (noteInput) noteInput.value = '';
        updateList();

        // Kiểm tra xem trang hiện tại có bị chặn ngay bởi luật vừa thêm không
        const matched = isSiteBlocked(currentConfig);
        if (matched) {
          alert(`Đã lưu thành công! Trang web "${domain}" hiện đã bị chặn.`);
          modal.remove();
          if (currentConfig.blockAction === 'redirect' && currentConfig.redirectUrl) {
            window.location.replace(currentConfig.redirectUrl);
          } else {
            renderBlockScreen(matched, currentConfig);
          }
        }
        return;
      }

      if (target.id === 'sbm-btn-reset') {
        if (confirm('Khôi phục danh sách chặn ban đầu?')) {
          config.blockedSites = [...DEFAULT_CONFIG.blockedSites];
          updateList();
        }
        return;
      }

      if (target.id === 'sbm-save-pin') {
        const pinInput = document.getElementById('sbm-pin');
        config.pinCode = (pinInput.value || '').trim();
        saveConfig(config);
        alert(config.pinCode ? 'Đã lưu mã PIN bảo vệ!' : 'Đã xóa mã PIN bảo vệ!');
        return;
      }

      const action = target.getAttribute('data-action');
      const idx = parseInt(target.getAttribute('data-index'), 10);
      if (action === 'toggle' && !isNaN(idx)) {
        config.blockedSites[idx].enabled = !config.blockedSites[idx].enabled;
        updateList();
      } else if (action === 'delete' && !isNaN(idx)) {
        config.blockedSites.splice(idx, 1);
        updateList();
      }
    });
  }

  // ==========================================================================
  // 6. NÚT NỔI TIỆN ÍCH (ASSISTIVETOUCH BUTTON) ĐỂ VÀO CÀI ĐẶT
  // ==========================================================================
  function createAssistiveButton(config) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    function ensureMounted() {
      if (document.getElementById('safari-blocker-assistive-btn')) return;

      const targetRoot = document.body || document.documentElement;
      if (!targetRoot) return;

      const btn = document.createElement('div');
      btn.id = 'safari-blocker-assistive-btn';
      btn.title = 'Chạm để mở Cài đặt Safari Blocker';
      btn.setAttribute('aria-label', 'Cài đặt Safari Blocker');
      
      btn.innerHTML = `
        <div style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.22);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 4px rgba(255,255,255,0.4);pointer-events:none;">
          <div style="width:14px;height:14px;border-radius:50%;background:#ffffff;box-shadow:0 0 5px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;pointer-events:none;">
            <span style="font-size:9px;line-height:1;user-select:none;pointer-events:none;">⚙️</span>
          </div>
        </div>
      `;

      btn.style.cssText = `
        position: fixed !important;
        bottom: 24px !important;
        right: 18px !important;
        width: 48px !important;
        height: 48px !important;
        border-radius: 50% !important;
        background: rgba(28, 28, 30, 0.88) !important;
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        border: 1.5px solid rgba(255, 255, 255, 0.35) !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        z-index: 2147483645 !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        touch-action: none !important;
        opacity: 0.9 !important;
        visibility: visible !important;
        transition: transform 0.15s ease, opacity 0.2s ease !important;
        box-sizing: border-box !important;
        padding: 0 !important;
        margin: 0 !important;
      `;

      let isDragging = false;
      let startX = 0, startY = 0;
      let initialLeft = 0, initialTop = 0;
      let moved = false;

      const onStart = (e) => {
        const p = e.touches ? e.touches[0] : e;
        isDragging = true;
        moved = false;
        startX = p.clientX;
        startY = p.clientY;
        const rect = btn.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        btn.style.transition = 'none';
        btn.style.opacity = '1';
      };

      const onMove = (e) => {
        if (!isDragging) return;
        const p = e.touches ? e.touches[0] : e;
        const dx = p.clientX - startX;
        const dy = p.clientY - startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          moved = true;
        }
        const w = window.innerWidth;
        const h = window.innerHeight;
        const newLeft = Math.max(8, Math.min(w - 56, initialLeft + dx));
        const newTop = Math.max(8, Math.min(h - 56, initialTop + dy));
        btn.style.left = newLeft + 'px';
        btn.style.top = newTop + 'px';
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
      };

      const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        btn.style.transition = 'transform 0.15s ease, opacity 0.2s ease';
        btn.style.opacity = '0.9';
        if (!moved) {
          openSettingsModal(loadConfig());
        }
      };

      btn.addEventListener('touchstart', onStart, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);

      btn.addEventListener('mousedown', onStart);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);

      // Cho phép click trực tiếp để kích hoạt nếu không kéo
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!moved) openSettingsModal(loadConfig());
      });

      targetRoot.appendChild(btn);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureMounted);
    } else {
      ensureMounted();
    }

    // Đảm bảo nút luôn xuất hiện kể cả khi trang web tự xóa/ghi đè DOM (Single Page Apps như Youtube, Facebook)
    setTimeout(ensureMounted, 300);
    setTimeout(ensureMounted, 1000);
    setTimeout(ensureMounted, 2500);
    window.addEventListener('load', ensureMounted);
  }

  // ==========================================================================
  // 7. ĐIỀU KIỆN MÔI TRƯỜNG & KHỞI CHẠY (INITIALIZATION)
  // ==========================================================================
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  function initialize() {
    if (!isBrowser) {
      return;
    }

    // Luôn tạo nút AssistiveTouch nổi trên màn hình hiện tại để người dùng mở Cài đặt nhanh
    createAssistiveButton(currentConfig);

    // Cho phép mở bảng cài đặt bằng cách thêm '#safari-blocker-settings' trên bất kỳ trang nào
    if (window.location.hash === '#safari-blocker-settings') {
      window.addEventListener('DOMContentLoaded', () => {
        openSettingsModal(currentConfig);
      });
    }

    // Đăng ký lệnh menu nếu extension hỗ trợ GM_registerMenuCommand
    try {
      if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('⚙️ Cài đặt Safari Blocker', () => {
          openSettingsModal(currentConfig);
        });
      }
    } catch (_) {}

    // Kiểm tra xem trang web hiện tại có nằm trong danh sách chặn không
    const matchedRule = isSiteBlocked(currentConfig);
    if (matchedRule) {
      if (currentConfig.blockAction === 'redirect' && currentConfig.redirectUrl) {
        window.location.replace(currentConfig.redirectUrl);
      } else {
        renderBlockScreen(matchedRule, currentConfig);
      }
    }
  }

  // Khởi chạy ngay lập tức khi kịch bản được nạp
  initialize();

  // Xuất cấu hình để hỗ trợ môi trường kiểm thử nếu cần
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DEFAULT_CONFIG, loadConfig, saveConfig, isSiteBlocked };
  }
})();
