// popup.js - Quản lý cài đặt hiển thị Assistive trên màn hình
const STORAGE_KEY_ALARMS = 'smart_alarms_v2_light';
const STORAGE_KEY_ASSISTIVE = 'assistive_enabled';

document.addEventListener('DOMContentLoaded', async () => {
  initClock();
  await loadState();

  const toggle = document.getElementById('toggleAssistive');
  toggle.addEventListener('change', async (e) => {
    const isEnabled = e.target.checked;
    await setAssistiveState(isEnabled);
  });

  const btnOpenOptions = document.getElementById('btnOpenOptionsTab');
  const btnOpenFull = document.getElementById('btnOpenFullTab');

  const openOptionsTab = () => {
    const optionsUrl = chrome.runtime.getURL('options.html');
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: optionsUrl });
    } else {
      window.open(optionsUrl, '_blank');
    }
  };

  if (btnOpenOptions) btnOpenOptions.addEventListener('click', openOptionsTab);
  if (btnOpenFull) btnOpenFull.addEventListener('click', openOptionsTab);
});

function initClock() {
  const clockEl = document.getElementById('popupClock');
  const update = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    if (clockEl) clockEl.textContent = `${h}:${m}:${s}`;
  };
  update();
  setInterval(update, 1000);
}

async function loadState() {
  try {
    let isAssistiveOn = false;
    let alarms = [];

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get([STORAGE_KEY_ASSISTIVE, STORAGE_KEY_ALARMS]);
      isAssistiveOn = data[STORAGE_KEY_ASSISTIVE] === true;
      alarms = data[STORAGE_KEY_ALARMS] || [];
    } else {
      isAssistiveOn = localStorage.getItem(STORAGE_KEY_ASSISTIVE) === 'true';
      try {
        alarms = JSON.parse(localStorage.getItem(STORAGE_KEY_ALARMS) || '[]');
      } catch (e) {
        alarms = [];
      }
    }

    const toggle = document.getElementById('toggleAssistive');
    if (toggle) toggle.checked = isAssistiveOn;

    updateBannerUI(isAssistiveOn);

    const activeCount = alarms.filter(a => a.enabled).length;
    const badgeEl = document.getElementById('activeAlarmsCount');
    if (badgeEl) badgeEl.textContent = `${activeCount} mốc`;
  } catch (err) {
    console.warn('loadState error:', err);
  }
}

async function setAssistiveState(enabled) {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [STORAGE_KEY_ASSISTIVE]: enabled });
    } else {
      localStorage.setItem(STORAGE_KEY_ASSISTIVE, enabled ? 'true' : 'false');
    }

    updateBannerUI(enabled);

    // Gửi thông điệp đến tab hiện tại để kích hoạt hoặc ẩn Assistive ngay lập tức
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'TOGGLE_ASSISTIVE',
            enabled: enabled
          }).catch(() => {
            // Tab không hỗ trợ content script (ví dụ chrome:// hoặc web store)
          });
        }
      });
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'ASSISTIVE_STATE_CHANGED',
        enabled: enabled
      }).catch(() => {});
    }
  } catch (err) {
    console.error('setAssistiveState error:', err);
  }
}

function updateBannerUI(enabled) {
  const banner = document.getElementById('assistiveStatusBanner');
  const text = document.getElementById('assistiveStatusText');
  if (!banner || !text) return;

  if (enabled) {
    banner.className = 'status-banner on';
    text.textContent = '🟢 Đang hiển thị trên màn hình hiện tại';
  } else {
    banner.className = 'status-banner off';
    text.textContent = '⚪ Đang ẩn trên màn hình hiện tại';
  }
}
