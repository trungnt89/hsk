const DB_NAME = 'SmartAlarmDB';
const DB_VERSION = 1;
const STORE_NAME = 'alarms';
const ALARMS_STORAGE_KEY = 'smart_alarms_v2_light';

const FEMALE_VOICES = [
  { id: 'vi-VN-HoaiMyNeural', name: '👩 Hoài My (Nữ - Nhẹ nhàng, truyền cảm)', pitch: 1.1 },
  { id: 'vi-VN-MaiNgocNeural', name: '👩 Mai Ngọc (Nữ - Tươi vui, trẻ trung)', pitch: 1.15 },
  { id: 'vi-Google-Female', name: '👩 Google Nữ (Chuẩn 100% ngữ điệu)', pitch: 1.05 },
  { id: 'vi-VN-NgocLam', name: '👩 Ngọc Lam (Nữ - Giọng Miền Nam ngọt ngào)', pitch: 1.08 }
];

const MALE_VOICES = [
  { id: 'vi-VN-NamMinhNeural', name: '👨 Nam Minh (Nam - Trầm ấm, truyền thanh)', pitch: 0.8 },
  { id: 'vi-VN-QuangDungNeural', name: '👨 Quang Dũng (Nam - Dõng dạc, rõ ràng)', pitch: 0.82 },
  { id: 'vi-Google-Male', name: '👨 Google Nam (Nam - Dứt khoát, chuẩn âm)', pitch: 0.85 },
  { id: 'vi-VN-TriTue', name: '👨 Trí Tuệ (Nam - Phong cách phát thanh viên)', pitch: 0.78 }
];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WORKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

function formatDaysOfWeek(days) {
  if (!days || !Array.isArray(days) || days.length === 0 || days.length === 7) return 'Hàng ngày';
  if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) return 'Thứ 2 - Thứ 6';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Cuối tuần (T7, CN)';
  const dayNames = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 0: 'CN' };
  const sorted = [...days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  return sorted.map(d => dayNames[d]).join(', ');
}

const DEFAULT_SAMPLES = [
  {
    id: 'alarm_sample_1',
    time: '06:30',
    type: 'youtube',
    title: '☀️ Thức Giấc Bình Minh - Nhạc Acoustic Chill',
    youtubeUrl: 'https://www.youtube.com/watch?v=fuXfT4Rv_WM',
    vid: 'fuXfT4Rv_WM',
    enabled: true,
    loop: true,
    repeatCount: 10,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
  },
  {
    id: 'alarm_sample_2',
    time: '07:15',
    type: 'tts',
    title: '🌸 Lời Nhắc Buổi Sáng (Nữ của Azure)',
    ttsText: 'Chào bạn! Đã 7 giờ 15 phút sáng rồi. Hãy dậy tập thể dục, uống một ly nước ấm và sẵn sàng cho một ngày mới thật tuyệt vời nhé!',
    ttsVoiceType: 'azure_female',
    voiceGender: 'female',
    voiceName: 'vi-VN-HoaiMyNeural',
    voiceSpeed: 1.0,
    enabled: true,
    loop: false,
    repeatCount: 5,
    daysOfWeek: [1, 2, 3, 4, 5]
  },
  {
    id: 'alarm_sample_3',
    time: '08:00',
    type: 'website',
    title: '📰 Đọc Báo Đầu Ngày (VnExpress)',
    websiteUrl: 'https://vnexpress.net',
    openMode: 'new_tab',
    enabled: true,
    loop: false,
    repeatCount: 1,
    daysOfWeek: [1, 2, 3, 4, 5]
  },
  {
    id: 'alarm_sample_4',
    time: '12:00',
    type: 'tts',
    title: '🍱 Nhắc Nghỉ Trưa & Dùng Bữa (Nam Azure - Mặc định)',
    ttsText: 'Đã 12 giờ trưa rồi, tạm gác công việc lại để dùng bữa trưa và chợp mắt nghỉ ngơi 15 phút lấy lại sức nào!',
    ttsVoiceType: 'azure_male',
    voiceGender: 'male',
    voiceName: 'vi-VN-NamMinhNeural',
    voiceSpeed: 1.0,
    enabled: true,
    loop: false,
    repeatCount: 3,
    daysOfWeek: [1, 2, 3, 4, 5]
  },
  {
    id: 'alarm_sample_5',
    time: '14:00',
    type: 'website',
    title: '💼 Bắt Đầu Ca Chiều - Bảng Việc Trello',
    websiteUrl: 'https://trello.com',
    openMode: 'new_tab',
    enabled: false,
    loop: false,
    repeatCount: 1,
    daysOfWeek: [1, 2, 3, 4, 5]
  }
];

let alarms = [];
let currentPreviewVid = 'fuXfT4Rv_WM';
let useNoCookieDomain = true;
let isSpeakingTest = false;

function updateYouTubePlayer(vid, autoplay = false) {
  currentPreviewVid = vid || 'fuXfT4Rv_WM';
  const iframe = document.getElementById('mainYtIframe');
  if (!iframe) return;
  const domain = useNoCookieDomain ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
  const autoVal = autoplay ? 1 : 0;
  const originParam = encodeURIComponent('https://www.youtube.com');
  iframe.src = `${domain}/embed/${currentPreviewVid}?enablejsapi=1&autoplay=${autoVal}&mute=0&rel=0&playsinline=1&origin=${originParam}&widget_referrer=${originParam}`;
  
  const badge = document.getElementById('playerServerBadge');
  if (badge) {
    badge.textContent = useNoCookieDomain ? 'youtube-nocookie.com (Ngừa 153)' : 'youtube.com (Chuẩn)';
  }
}

// Khởi tạo IndexedDB
function openAlarmDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Trình duyệt không hỗ trợ IndexedDB'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('time', 'time', { unique: false });
        store.createIndex('enabled', 'enabled', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getDBAlarms() {
  try {
    const db = await openAlarmDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get(ALARMS_STORAGE_KEY);
      return data[ALARMS_STORAGE_KEY] || [];
    }
    return [];
  }
}

async function saveDBAlarm(alarm) {
  try {
    const db = await openAlarmDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(alarm);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB put error:', err);
  }
  await syncToChromeStorage();
}

async function deleteDBAlarm(id) {
  try {
    const db = await openAlarmDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete error:', err);
  }
  await syncToChromeStorage();
}

async function bulkSaveDBAlarms(items) {
  try {
    const db = await openAlarmDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Bulk save error:', err);
  }
  await syncToChromeStorage();
}

async function clearAllDBAlarms() {
  try {
    const db = await openAlarmDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Clear error:', err);
  }
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ [ALARMS_STORAGE_KEY]: [] });
    chrome.runtime.sendMessage({ action: 'RESCHEDULE_ALARMS' });
  }
}

async function syncToChromeStorage() {
  const all = await getDBAlarms();
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ [ALARMS_STORAGE_KEY]: all });
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'RESCHEDULE_ALARMS' });
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    initClock();
  } catch (e) {
    console.warn('initClock warning:', e);
  }

  try {
    setupVoiceGenderControls();
  } catch (e) {
    console.warn('setupVoiceGenderControls warning:', e);
  }

  try {
    await loadAndRenderAlarms();
  } catch (e) {
    console.error('loadAndRenderAlarms error:', e);
  }

  try {
    setupEventListeners();
  } catch (e) {
    console.error('setupEventListeners error:', e);
  }
});

function initClock() {
  const timeEl = document.getElementById('navClockTime');
  const dateEl = document.getElementById('navClockDate');
  if (!timeEl && !dateEl) return;

  const update = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    if (timeEl) timeEl.textContent = `${h}:${m}:${s}`;
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('vi-VN', {
        weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric'
      });
    }
  };
  update();
  setInterval(update, 1000);
}

function setupVoiceGenderControls() {
  // Đồng bộ thanh trượt tốc độ phát âm (Speed / Rate)
  const speedSlider = document.getElementById('formVoiceSpeed');
  const speedDisplay = document.getElementById('speedDisplay');
  if (speedSlider && speedDisplay) {
    speedSlider.addEventListener('input', (e) => {
      speedDisplay.textContent = Number(e.target.value).toFixed(2) + 'x';
    });
  }

  // Tự động nạp authToken Azure đã lưu (nếu có)
  const tokenInput = document.getElementById('formAzureToken');
  if (tokenInput) {
    const savedToken = localStorage.getItem('azure_tts_token');
    if (savedToken) {
      tokenInput.value = savedToken;
    }
    tokenInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val) {
        localStorage.setItem('azure_tts_token', val);
      }
    });
  }
}

let currentFormDays = [0, 1, 2, 3, 4, 5, 6];

function updateDayButtonsUI() {
  const container = document.getElementById('weekdayButtonsContainer');
  if (!container) return;
  const buttons = container.querySelectorAll('.day-select-btn');
  buttons.forEach(btn => {
    const day = parseInt(btn.getAttribute('data-day'), 10);
    if (currentFormDays.includes(day)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const summary = document.getElementById('daysSummaryLabel');
  if (summary) {
    summary.textContent = `${formatDaysOfWeek(currentFormDays)} (${currentFormDays.length}/7 ngày)`;
  }
}

function setFormDays(days) {
  currentFormDays = Array.isArray(days) && days.length > 0 ? [...days] : [0, 1, 2, 3, 4, 5, 6];
  updateDayButtonsUI();
}

async function loadAndRenderAlarms() {
  let rawAlarms = await getDBAlarms();
  if (rawAlarms.length === 0) {
    await bulkSaveDBAlarms(DEFAULT_SAMPLES);
    rawAlarms = await getDBAlarms();
  }

  // Mặc định setting tất cả các ngày trong tuần với các alert cũ chưa được setting ngày trong tuần
  let hasLegacyUpdate = false;
  alarms = rawAlarms.map(item => {
    if (!item.daysOfWeek || !Array.isArray(item.daysOfWeek) || item.daysOfWeek.length === 0) {
      item.daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
      hasLegacyUpdate = true;
    }
    return item;
  });

  if (hasLegacyUpdate) {
    await bulkSaveDBAlarms(alarms);
  }

  renderAlarmsList();
}

function updateStatusBanner(message, type = 'success') {
  const banner = document.getElementById('statusBanner');
  const icon = document.getElementById('statusIcon');
  const text = document.getElementById('statusText');

  text.textContent = message;
  if (type === 'success') {
    banner.style.background = '#f0fdf4';
    banner.style.borderColor = '#bbf7d0';
    banner.style.color = '#166534';
    icon.textContent = '🟢';
  } else if (type === 'info') {
    banner.style.background = '#eff6ff';
    banner.style.borderColor = '#bfdbfe';
    banner.style.color = '#1d4ed8';
    icon.textContent = 'ℹ️';
  } else if (type === 'error') {
    banner.style.background = '#fef2f2';
    banner.style.borderColor = '#fecaca';
    banner.style.color = '#991b1b';
    icon.textContent = '⚠️';
  }
}

function renderAlarmsList() {
  const container = document.getElementById('alarmTableContainer');
  const enabledCount = alarms.filter(a => a.enabled).length;

  document.getElementById('enabledCount').textContent = enabledCount;
  document.getElementById('totalCount').textContent = alarms.length;

  if (alarms.length === 0) {
    container.innerHTML = '<div class="empty-state">Chưa có mốc báo thức nào trong IndexedDB. Bấm "➕ Thêm Mốc Mới" hoặc "✨ Nạp Mẫu" để bắt đầu.</div>';
    return;
  }

  alarms.sort((a, b) => a.time.localeCompare(b.time));

  const today = new Date().getDay();

  container.innerHTML = alarms.map(a => {
    let badgeHtml = '';
    let detailText = '';

    if (a.type === 'website') {
      badgeHtml = '<span class="badge badge-web">🌐 Website</span>';
      detailText = `<a href="${a.websiteUrl}" target="_blank" style="color: #0284c7; text-decoration: underline;">${escapeHtml(a.websiteUrl || '')}</a>`;
    } else if (a.type === 'tts') {
      let vLabel = 'Nam Azure (Mặc định) 👨';
      if (a.ttsVoiceType === 'azure_female' || a.voiceGender === 'female') vLabel = 'Nữ Azure 👩';
      if (a.ttsVoiceType === 'browser_default') vLabel = 'Trình duyệt 🌐';
      badgeHtml = `<span class="badge badge-tts">🗣️ ${vLabel}</span>`;
      detailText = `"${escapeHtml(a.ttsText || '')}"`;
    } else {
      badgeHtml = '<span class="badge badge-yt">🎬 YouTube</span>';
      detailText = a.vid ? `Video ID: ${escapeHtml(a.vid)}` : '';
    }

    const days = (a.daysOfWeek && Array.isArray(a.daysOfWeek) && a.daysOfWeek.length > 0)
      ? a.daysOfWeek
      : [0, 1, 2, 3, 4, 5, 6];
    const isTodayActive = days.includes(today);
    const daysLabel = formatDaysOfWeek(days);
    const daysBadge = `<span class="badge-days ${isTodayActive ? 'active-today' : ''}" title="Lịch áp dụng: ${daysLabel}">📅 ${daysLabel}${isTodayActive ? ' (Hôm nay)' : ''}</span>`;

    return `
      <div class="alarm-row ${a.enabled ? '' : 'disabled'}">
        <div class="alarm-left">
          <div class="alarm-time">${a.time}</div>
          <div class="alarm-details">
            <div class="alarm-title">${escapeHtml(a.title || 'Mốc báo thức')}</div>
            <div class="alarm-meta">
              ${badgeHtml}
              ${daysBadge}
              <span class="badge" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a;">
                🔁 ${a.repeatCount === 0 ? 'Vô tận' : (a.repeatCount !== undefined ? a.repeatCount : 10) + ' lần'}
              </span>
              <span>${detailText}</span>
            </div>
          </div>
        </div>

        <div class="alarm-right">
          <button class="btn btn-sm btn-outline btn-ring-test" data-id="${a.id}" title="Reo chuông ngay">🔔 Reo Thử</button>
          <button class="btn btn-sm btn-outline btn-clone" data-id="${a.id}" title="Nhân bản mốc này">📋 Nhân bản</button>
          <button class="btn btn-sm btn-outline btn-edit" data-id="${a.id}" title="Sửa mốc">✏️ Sửa</button>
          <button class="btn btn-sm btn-outline btn-delete" data-id="${a.id}" title="Xóa mốc">🗑️</button>
          <label class="switch">
            <input type="checkbox" class="toggle-switch" data-id="${a.id}" ${a.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.toggle-switch').forEach(input => {
    input.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-id');
      await toggleAlarm(id, e.target.checked);
    });
  });

  container.querySelectorAll('.btn-ring-test').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = alarms.find(a => a.id === id);
      if (item && item.type === 'website' && item.websiteUrl) {
        let finalUrl = item.websiteUrl.trim();
        if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
          chrome.tabs.create({ url: finalUrl, active: true });
        } else {
          window.open(finalUrl, '_blank');
        }
        updateStatusBanner(`🌐 Đã mở ngay website đã cài đặt: ${finalUrl}`, 'success');
        return;
      }
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'TRIGGER_TEST', alarmId: id });
      }
    });
  });

  container.querySelectorAll('.btn-clone').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      await cloneAlarm(id);
    });
  });

  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      editAlarm(id);
    });
  });

  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      const item = alarms.find(a => a.id === id);
      if (confirm(`Bạn có chắc muốn xóa mốc ${item ? item.time : ''} khỏi IndexedDB?`)) {
        await deleteDBAlarm(id);
        deleteAlarmFromSheet(id).catch(err => console.warn('Lỗi xóa trên Google Sheet:', err));
        alarms = await getDBAlarms();
        renderAlarmsList();
        updateStatusBanner('Đã xóa mốc báo thức khỏi IndexedDB & Google Sheets!', 'info');
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

async function cloneAlarm(id) {
  const item = alarms.find(a => a.id === id);
  if (!item) return;

  const days = (item.daysOfWeek && Array.isArray(item.daysOfWeek) && item.daysOfWeek.length > 0)
    ? [...item.daysOfWeek]
    : [0, 1, 2, 3, 4, 5, 6];

  const cloned = {
    ...item,
    id: 'alarm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    title: (item.title || 'Báo thức') + ' (Bản sao)',
    enabled: true,
    daysOfWeek: days
  };

  await saveDBAlarm(cloned);
  addAlarmToSheet(cloned).catch(err => console.warn('Lỗi thêm Google Sheet:', err));
  alarms = await getDBAlarms();
  renderAlarmsList();
  updateStatusBanner(`📋 Đã nhân bản mốc ${cloned.time} (Đã lưu Google Sheets)!`, 'success');
}

async function toggleAlarm(id, enabled) {
  const item = alarms.find(a => a.id === id);
  if (item) {
    item.enabled = enabled;
    await saveDBAlarm(item);
    updateAlarmInSheet(item).catch(err => console.warn('Lỗi cập nhật Google Sheet:', err));
    renderAlarmsList();
    updateStatusBanner(`Đã ${enabled ? 'bật' : 'tắt'} mốc ${item.time} (Đã đồng bộ Google Sheets)!`, 'success');
  }
}

function editAlarm(id) {
  const item = alarms.find(a => a.id === id);
  if (!item) return;

  document.getElementById('editAlarmId').value = item.id;
  document.getElementById('formTime').value = item.time;
  document.getElementById('formTitle').value = item.title;
  document.getElementById('formType').value = item.type || 'website';
  document.getElementById('formWebUrl').value = item.websiteUrl || 'https://vnexpress.net';
  document.getElementById('formYtUrl').value = item.youtubeUrl || (item.vid ? 'https://www.youtube.com/watch?v=' + item.vid : '');
  document.getElementById('formTtsText').value = item.ttsText || '';
  document.getElementById('formRepeatCount').value = item.repeatCount !== undefined ? item.repeatCount : 10;

  const days = (item.daysOfWeek && Array.isArray(item.daysOfWeek) && item.daysOfWeek.length > 0)
    ? item.daysOfWeek
    : [0, 1, 2, 3, 4, 5, 6];
  setFormDays(days);

  const vType = item.ttsVoiceType || (item.voiceGender === 'female' ? 'azure_female' : 'azure_male');
  if (vType === 'azure_female') {
    const el = document.getElementById('radioAzureFemale');
    if (el) el.checked = true;
  } else if (vType === 'browser_default') {
    const el = document.getElementById('radioBrowserDefault');
    if (el) el.checked = true;
  } else {
    const el = document.getElementById('radioAzureMale');
    if (el) el.checked = true;
  }

  const tokenInput = document.getElementById('formAzureToken');
  if (tokenInput) {
    tokenInput.value = item.authToken || localStorage.getItem('azure_tts_token') || '';
  }

  const speedVal = item.voiceSpeed !== undefined ? item.voiceSpeed : 1.0;
  const speedEl = document.getElementById('formVoiceSpeed');
  if (speedEl) speedEl.value = speedVal;
  const speedDisp = document.getElementById('speedDisplay');
  if (speedDisp) speedDisp.textContent = Number(speedVal).toFixed(2) + 'x';

  handleTypeChange();
  if (item.type === 'youtube' && item.vid) {
    updateYouTubePlayer(item.vid, false);
  }
  document.getElementById('formTitleText').textContent = '✏️ Chỉnh Sửa Mốc Báo Thức';
  document.getElementById('formSection').style.display = 'block';
  document.getElementById('formSection').scrollIntoView({ behavior: 'smooth' });
}

function handleTypeChange() {
  const type = document.getElementById('formType').value;
  const webGroup = document.getElementById('websiteGroup');
  const ttsGroup = document.getElementById('ttsGroup');
  const ytGroup = document.getElementById('ytGroup');

  webGroup.style.display = type === 'website' ? 'block' : 'none';
  ttsGroup.style.display = type === 'tts' ? 'block' : 'none';
  ytGroup.style.display = type === 'youtube' ? 'block' : 'none';

  // Điều chỉnh gợi ý lặp lại: Website thường chỉ cần mở 1 lần
  if (type === 'website') {
    document.getElementById('formRepeatCount').value = '1';
  }
}

function extractVid(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : '';
}

function setupEventListeners() {
  // Mở đóng form
  document.getElementById('btnToggleForm').addEventListener('click', () => {
    document.getElementById('editAlarmId').value = '';
    document.getElementById('formTitleText').textContent = '➕ Thêm Mốc Báo Thức Mới';
    document.getElementById('alarmForm').reset();
    document.getElementById('formTime').value = '07:00';
    setFormDays([0, 1, 2, 3, 4, 5, 6]);
    if (document.getElementById('radioAzureMale')) document.getElementById('radioAzureMale').checked = true;
    const tokenInput = document.getElementById('formAzureToken');
    if (tokenInput) tokenInput.value = localStorage.getItem('azure_tts_token') || '';
    const speedEl = document.getElementById('formVoiceSpeed');
    if (speedEl) speedEl.value = 1.0;
    const speedDisp = document.getElementById('speedDisplay');
    if (speedDisp) speedDisp.textContent = '1.00x';
    handleTypeChange();
    document.getElementById('formSection').style.display = 'block';
    document.getElementById('formSection').scrollIntoView({ behavior: 'smooth' });
  });

  // Chọn nhanh ngày trong tuần
  document.getElementById('btnDaysAll')?.addEventListener('click', () => setFormDays([0, 1, 2, 3, 4, 5, 6]));
  document.getElementById('btnDaysWorkdays')?.addEventListener('click', () => setFormDays([1, 2, 3, 4, 5]));
  document.getElementById('btnDaysWeekend')?.addEventListener('click', () => setFormDays([0, 6]));

  document.querySelectorAll('.day-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const day = parseInt(btn.getAttribute('data-day'), 10);
      if (currentFormDays.includes(day)) {
        if (currentFormDays.length > 1) {
          currentFormDays = currentFormDays.filter(d => d !== day);
        }
      } else {
        currentFormDays.push(day);
      }
      updateDayButtonsUI();
    });
  });

  const speedSlider = document.getElementById('formVoiceSpeed');
  if (speedSlider) {
    speedSlider.addEventListener('input', (e) => {
      const speedDisp = document.getElementById('speedDisplay');
      if (speedDisp) speedDisp.textContent = Number(e.target.value).toFixed(2) + 'x';
    });
  }

  document.getElementById('btnCloseForm').addEventListener('click', () => {
    document.getElementById('formSection').style.display = 'none';
  });

  document.getElementById('btnCancelForm').addEventListener('click', () => {
    document.getElementById('formSection').style.display = 'none';
  });

  document.getElementById('formType').addEventListener('change', handleTypeChange);

  document.getElementById('formYtUrl').addEventListener('input', (e) => {
    const vid = extractVid(e.target.value);
    if (vid) {
      updateYouTubePlayer(vid, false);
    }
  });

  // Mở thử website
  document.getElementById('btnTestOpenWebsite').addEventListener('click', () => {
    let url = document.getElementById('formWebUrl').value.trim() || 'https://vnexpress.net';
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
    updateStatusBanner(`🌐 Đã mở thử trang web: ${url}`, 'success');
  });

  // Các nút chọn website mẫu nhanh
  document.querySelectorAll('.btn-preset-web').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      if (url) {
        document.getElementById('formWebUrl').value = url;
        const currentTitle = document.getElementById('formTitle').value.trim();
        if (!currentTitle || currentTitle.startsWith('Mở') || currentTitle.startsWith('Đọc')) {
          document.getElementById('formTitle').value = 'Mở ' + btn.textContent.trim();
        }
        updateStatusBanner(`🌐 Đã chọn trang web mẫu: ${url}`, 'info');
      }
    });
  });

  // Submit form thêm/sửa
  document.getElementById('alarmForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editAlarmId').value || ('alarm_' + Date.now());
    const time = document.getElementById('formTime').value;
    const type = document.getElementById('formType').value;
    const title = document.getElementById('formTitle').value.trim();
    const repeatCount = Number(document.getElementById('formRepeatCount').value) || 1;

    const days = (currentFormDays && currentFormDays.length > 0)
      ? [...currentFormDays]
      : [0, 1, 2, 3, 4, 5, 6];

    let newAlarm = {
      id,
      time,
      type,
      title: title || (type === 'website' ? 'Mở Website' : type === 'tts' ? 'Lời nhắc TTS' : 'Báo thức YouTube'),
      enabled: true,
      repeatCount,
      loop: repeatCount !== 1,
      daysOfWeek: days
    };

    if (type === 'website') {
      let webUrl = document.getElementById('formWebUrl').value.trim() || 'https://vnexpress.net';
      if (!/^https?:\/\//i.test(webUrl)) webUrl = 'https://' + webUrl;
      newAlarm.websiteUrl = webUrl;
      newAlarm.openMode = 'new_tab';
    } else if (type === 'tts') {
      const radio = document.querySelector('input[name="voiceTypeRadio"]:checked');
      const vType = radio ? radio.value : 'azure_male';
      newAlarm.ttsVoiceType = vType;
      newAlarm.voiceGender = vType === 'azure_female' ? 'female' : 'male';
      newAlarm.voiceName = vType === 'azure_female' ? 'vi-VN-HoaiMyNeural' : 'vi-VN-NamMinhNeural';
      newAlarm.voiceSpeed = parseFloat(document.getElementById('formVoiceSpeed').value) || 1.0;
      const tokenInput = document.getElementById('formAzureToken');
      const tokenVal = tokenInput ? tokenInput.value.trim() : '';
      newAlarm.authToken = tokenVal;
      if (tokenVal) localStorage.setItem('azure_tts_token', tokenVal);
      newAlarm.ttsText = document.getElementById('formTtsText').value.trim() || 'Đã đến giờ hẹn rồi!';
    } else {
      const ytUrl = document.getElementById('formYtUrl').value.trim();
      const vid = extractVid(ytUrl) || 'fuXfT4Rv_WM';
      newAlarm.youtubeUrl = ytUrl || ('https://www.youtube.com/watch?v=' + vid);
      newAlarm.vid = vid;
    }

    const isEditing = Boolean(document.getElementById('editAlarmId').value);
    await saveDBAlarm(newAlarm);
    if (isEditing) {
      updateAlarmInSheet(newAlarm).catch(err => console.warn('Lỗi cập nhật Google Sheet:', err));
    } else {
      addAlarmToSheet(newAlarm).catch(err => console.warn('Lỗi thêm Google Sheet:', err));
    }
    alarms = await getDBAlarms();
    document.getElementById('formSection').style.display = 'none';
    renderAlarmsList();
    updateStatusBanner(`Đã lưu mốc ${newAlarm.time} vào IndexedDB & Google Sheets!`, 'success');
  });

  // Đổi server YouTube
  const btnToggleServer = document.getElementById('btnToggleServer');
  if (btnToggleServer) {
    btnToggleServer.addEventListener('click', () => {
      useNoCookieDomain = !useNoCookieDomain;
      updateYouTubePlayer(currentPreviewVid, false);
      const hostName = useNoCookieDomain ? 'youtube-nocookie.com' : 'youtube.com';
      updateStatusBanner('🔄 Đã đổi máy chủ phát sang: ' + hostName, 'success');
    });
  }

  // Thử giọng đọc phát âm: 1. Nam Azure (Mặc định) • 2. Nữ Azure • 3. Mặc định trình duyệt
  const btnTestTtsVoice = document.getElementById('btnTestTtsVoice');
  if (btnTestTtsVoice) {
    btnTestTtsVoice.addEventListener('click', () => {
      if (isSpeakingTest) {
        stopSpeaking();
        isSpeakingTest = false;
        btnTestTtsVoice.textContent = '🔊 Thử Giọng Ngay';
        updateStatusBanner('⏹️ Đã dừng thử giọng.', 'info');
        return;
      }

      const radio = document.querySelector('input[name="voiceTypeRadio"]:checked');
      const vType = radio ? radio.value : 'azure_male';
      const speed = parseFloat(document.getElementById('formVoiceSpeed').value) || 1.0;
      const tokenInput = document.getElementById('formAzureToken');
      const token = (tokenInput ? tokenInput.value.trim() : '') || localStorage.getItem('azure_tts_token') || '';
      if (token) localStorage.setItem('azure_tts_token', token);

      let sampleText = document.getElementById('formTtsText').value.trim();
      if (!sampleText) {
        if (vType === 'azure_female') {
          sampleText = 'Chào bạn, đây là giọng Nữ của Azure truyền cảm và trong trẻo!';
        } else if (vType === 'browser_default') {
          sampleText = 'Chào bạn, đây là giọng đọc phát âm mặc định của trình duyệt!';
        } else {
          sampleText = 'Chào bạn, đây là giọng Nam của Azure mặc định trầm ấm và rõ ràng!';
        }
      }

      btnTestTtsVoice.textContent = '⏹️ Dừng';
      isSpeakingTest = true;
      let label = 'Nam của Azure (Mặc định)';
      if (vType === 'azure_female') label = 'Nữ của Azure';
      if (vType === 'browser_default') label = 'Mặc định trình duyệt';
      updateStatusBanner(`🗣️ Đang phát thử giọng: ${label} (Tốc độ: ${speed}x)`, 'info');

      speakTTS(sampleText, vType, speed, token, () => {
        isSpeakingTest = false;
        btnTestTtsVoice.textContent = '🔊 Thử Giọng Ngay';
      });
    });
  }

  // Mở tab YouTube
  const btnOpenDirectYt = document.getElementById('btnOpenDirectYt');
  if (btnOpenDirectYt) {
    btnOpenDirectYt.addEventListener('click', () => {
      const url = `https://www.youtube.com/watch?v=${encodeURIComponent(currentPreviewVid)}`;
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url });
      } else {
        window.open(url, '_blank');
      }
    });
  }

  // Các nút chọn nhạc mẫu nhanh
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const vid = btn.getAttribute('data-vid');
      if (vid) {
        document.getElementById('formYtUrl').value = `https://www.youtube.com/watch?v=${vid}`;
        updateYouTubePlayer(vid, false);
        updateStatusBanner(`🎵 Đã chọn âm mẫu: ${btn.textContent.trim()} (${vid})`, 'info');
      }
    });
  });

  // Phát thử 10 giây
  document.getElementById('btnPreplayGlobal').addEventListener('click', playPreplay10s);
  document.getElementById('btnTestFormPreplay').addEventListener('click', () => {
    const type = document.getElementById('formType').value;
    if (type === 'website') {
      let url = document.getElementById('formWebUrl').value.trim() || 'https://vnexpress.net';
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      window.open(url, '_blank');
    } else if (type === 'tts') {
      document.getElementById('btnTestTtsVoice').click();
    } else {
      playPreplay10s();
    }
  });

  // Xuất file JSON
  const handleExport = async () => {
    const currentList = await getDBAlarms();
    const jsonStr = JSON.stringify(currentList, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart_alarms_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    updateStatusBanner('📥 Đã tải xuống file sao lưu JSON thành công!', 'success');
  };
  document.getElementById('btnExportJson').addEventListener('click', handleExport);
  document.getElementById('btnExportJsonTop').addEventListener('click', handleExport);

  // Nhập file JSON
  const fileInput = document.getElementById('fileImportJson');
  const triggerImport = () => fileInput.click();
  document.getElementById('btnImportJson').addEventListener('click', triggerImport);
  document.getElementById('btnImportJsonTop').addEventListener('click', triggerImport);

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('File JSON không hợp lệ!');
      await bulkSaveDBAlarms(parsed);
      alarms = await getDBAlarms();
      renderAlarmsList();
      updateStatusBanner(`📤 Đã khôi phục thành công ${parsed.length} mốc từ file JSON!`, 'success');
    } catch (err) {
      alert('Lỗi nhập file JSON: ' + err.message);
      updateStatusBanner('Lỗi nhập file JSON!', 'error');
    } finally {
      fileInput.value = '';
    }
  });

  // Nạp 5 mốc mẫu
  const handleLoadSamplesAction = async () => {
    await bulkSaveDBAlarms(DEFAULT_SAMPLES);
    alarms = await getDBAlarms();
    renderAlarmsList();
    updateStatusBanner('✨ Đã nạp 5 mốc mẫu chuẩn (Website, TTS Nam/Nữ, YouTube) vào IndexedDB!', 'success');
  };
  document.getElementById('btnLoadSamples').addEventListener('click', handleLoadSamplesAction);
  document.getElementById('btnLoadSamplesTop').addEventListener('click', handleLoadSamplesAction);

  // Xóa toàn bộ
  document.getElementById('btnClearAllIDB').addEventListener('click', async () => {
    if (confirm('Bạn có chắc muốn xóa TOÀN BỘ mốc báo thức khỏi IndexedDB?')) {
      await clearAllDBAlarms();
      alarms = [];
      renderAlarmsList();
      updateStatusBanner('🗑️ Đã xóa sạch toàn bộ dữ liệu IndexedDB!', 'info');
    }
  });

  // Token Configuration for Google Sheets
  const tokenInput = document.getElementById('sheetAuthToken');
  const tokenBadge = document.getElementById('sheetTokenBadge');
  const tokenStatusText = document.getElementById('sheetTokenStatusText');
  const btnToggleToken = document.getElementById('btnToggleTokenVisible');
  const btnSaveToken = document.getElementById('btnSaveSheetToken');

  function updateTokenStatusUI(hasToken) {
    if (tokenBadge) {
      if (hasToken) {
        tokenBadge.textContent = '🟢 Đã lưu Token';
        tokenBadge.style.background = '#ecfdf5';
        tokenBadge.style.color = '#047857';
        tokenBadge.style.borderColor = '#a7f3d0';
      } else {
        tokenBadge.textContent = '🔴 Chưa có Token';
        tokenBadge.style.background = '#fef2f2';
        tokenBadge.style.color = '#b91c1c';
        tokenBadge.style.borderColor = '#fecaca';
      }
    }
    if (tokenStatusText) {
      if (hasToken) {
        tokenStatusText.textContent = 'Đã lưu trong trình duyệt';
        tokenStatusText.style.color = '#059669';
      } else {
        tokenStatusText.textContent = 'Chưa lưu token';
        tokenStatusText.style.color = '#b91c1c';
      }
    }
  }

  getStoredAuthToken().then(saved => {
    if (tokenInput && saved) {
      tokenInput.value = saved;
      updateTokenStatusUI(true);
    } else {
      updateTokenStatusUI(false);
    }
  });

  if (btnToggleToken && tokenInput) {
    btnToggleToken.addEventListener('click', () => {
      tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
      btnToggleToken.textContent = tokenInput.type === 'password' ? '👁️' : '🙈';
    });
  }

  if (btnSaveToken && tokenInput) {
    btnSaveToken.addEventListener('click', async () => {
      const val = tokenInput.value.trim();
      await setStoredAuthToken(val);
      if (val) {
        updateTokenStatusUI(true);
        updateStatusBanner('🔑 Đã lưu Token Authorization vào trình duyệt thành công!', 'success');
      } else {
        updateTokenStatusUI(false);
        updateStatusBanner('Đã xóa Token Authorization khỏi trình duyệt!', 'info');
      }
    });
  }

  // Google Sheets Cloud Sync
  const btnPullFromSheet = document.getElementById('btnPullFromSheet');
  if (btnPullFromSheet) {
    btnPullFromSheet.addEventListener('click', async () => {
      const currentToken = await getStoredAuthToken();
      if (!currentToken) {
        alert('⚠️ Vui lòng nhập Token Authorization và bấm "Lưu" vào trình duyệt trước khi tải dữ liệu!');
        if (tokenInput) tokenInput.focus();
        return;
      }

      const msg = document.getElementById('sheetSyncMsg');
      try {
        btnPullFromSheet.disabled = true;
        btnPullFromSheet.textContent = '⏳ Đang tải...';
        updateStatusBanner('☁️ Đang đọc dữ liệu từ Google Sheets...', 'info');

        const sheetAlarms = await fetchAlarmsFromSheet();
        if (sheetAlarms.length === 0) {
          updateStatusBanner('Google Sheets chưa có dữ liệu mốc báo thức nào!', 'info');
          if (msg) {
            msg.style.display = 'block';
            msg.style.color = '#d97706';
            msg.textContent = 'Sheet1 hiện đang trống. Hãy bấm "Đẩy lên Sheet" để sao lưu dữ liệu!';
          }
        } else {
          await bulkSaveDBAlarms(sheetAlarms);
          alarms = await getDBAlarms();
          renderAlarmsList();
          updateStatusBanner(`☁️ Đã tải và cập nhật ${sheetAlarms.length} mốc từ Google Sheets vào IndexedDB!`, 'success');
          if (msg) {
            msg.style.display = 'block';
            msg.style.color = '#059669';
            msg.textContent = `Đã đồng bộ ${sheetAlarms.length} mốc từ Google Sheets thành công!`;
          }
        }
      } catch (err) {
        alert('Lỗi khi tải từ Google Sheets: ' + err.message);
        updateStatusBanner('Lỗi kết nối Google Sheets: ' + err.message, 'error');
        if (msg) {
          msg.style.display = 'block';
          msg.style.color = '#dc2626';
          msg.textContent = 'Lỗi kết nối: ' + err.message;
        }
      } finally {
        btnPullFromSheet.disabled = false;
        btnPullFromSheet.textContent = '⬇️ Tải từ Sheet';
      }
    });
  }

  const btnPushToSheet = document.getElementById('btnPushToSheet');
  if (btnPushToSheet) {
    btnPushToSheet.addEventListener('click', async () => {
      const currentToken = await getStoredAuthToken();
      if (!currentToken) {
        alert('⚠️ Vui lòng nhập Token Authorization và bấm "Lưu" vào trình duyệt trước khi đẩy dữ liệu!');
        if (tokenInput) tokenInput.focus();
        return;
      }

      const msg = document.getElementById('sheetSyncMsg');
      try {
        btnPushToSheet.disabled = true;
        btnPushToSheet.textContent = '⏳ Đang đẩy...';
        updateStatusBanner('☁️ Đang đẩy toàn bộ mốc báo thức lên Google Sheets...', 'info');

        const currentList = await getDBAlarms();
        if (currentList.length === 0) {
          alert('Không có mốc báo thức nào trong bộ nhớ để đẩy!');
          return;
        }

        const count = await pushAllAlarmsToSheet(currentList);
        updateStatusBanner(`☁️ Đã đẩy thành công ${count} mốc báo thức lên Google Sheets (Sheet1)!`, 'success');
        if (msg) {
          msg.style.display = 'block';
          msg.style.color = '#059669';
          msg.textContent = `Đã đồng bộ ${count} mốc lên Google Sheets lúc ${new Date().toLocaleTimeString()}!`;
        }
      } catch (err) {
        alert('Lỗi khi đẩy lên Google Sheets: ' + err.message);
        updateStatusBanner('Lỗi đẩy dữ liệu lên Google Sheets!', 'error');
        if (msg) {
          msg.style.display = 'block';
          msg.style.color = '#dc2626';
          msg.textContent = 'Lỗi đẩy: ' + err.message;
        }
      } finally {
        btnPushToSheet.disabled = false;
        btnPushToSheet.textContent = '⬆️ Đẩy lên Sheet';
      }
    });
  }
}

function playPreplay10s() {
  updateYouTubePlayer(currentPreviewVid, true);
  updateStatusBanner('▶️ Đang phát thử nghiệm âm thanh trong 10 giây...', 'info');
  setTimeout(() => {
    updateYouTubePlayer(currentPreviewVid, false);
  }, 10000);
}
