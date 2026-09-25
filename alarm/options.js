// options.js - Báo Thức Thông Minh Pro
const DB_NAME = 'SmartAlarmDB';
const DB_VERSION = 1;
const STORE_NAME = 'alarms';
const ALARMS_STORAGE_KEY = 'smart_alarms_v2_light';
const ASSISTIVE_STORAGE_KEY = 'assistive_enabled';

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
let currentFilter = 'enabled';
let currentSearch = '';
let currentFormDays = [0, 1, 2, 3, 4, 5, 6];
let isSpeakingTest = false;

function formatDaysOfWeek(days) {
  if (!days || !Array.isArray(days) || days.length === 0 || days.length === 7) return 'Hàng ngày';
  if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) return 'Thứ 2 - Thứ 6';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Cuối tuần (T7, CN)';
  const dayNames = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 0: 'CN' };
  const sorted = [...days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  return sorted.map(d => dayNames[d]).join(', ');
}

// IndexedDB Helper
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
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'RESCHEDULE_ALARMS' });
    }
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
  initClock();
  setupVoiceGenderControls();
  await loadAndRenderAlarms();
  setupEventListeners();
  setupSettingsModal();
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
  const speedSlider = document.getElementById('formVoiceSpeed');
  const speedDisplay = document.getElementById('speedDisplay');
  if (speedSlider && speedDisplay) {
    speedSlider.addEventListener('input', (e) => {
      speedDisplay.textContent = Number(e.target.value).toFixed(2) + 'x';
    });
  }

  const tokenInput = document.getElementById('formAzureToken');
  if (tokenInput) {
    const savedToken = localStorage.getItem('azure_tts_token');
    if (savedToken) tokenInput.value = savedToken;
    tokenInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val) localStorage.setItem('azure_tts_token', val);
    });
  }
}

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
  if (!banner || !text) return;

  text.textContent = message;
  if (type === 'success') {
    banner.style.background = '#f0fdf4';
    banner.style.borderColor = '#bbf7d0';
    banner.style.color = '#166534';
    if (icon) icon.textContent = '🟢';
  } else if (type === 'info') {
    banner.style.background = '#eff6ff';
    banner.style.borderColor = '#bfdbfe';
    banner.style.color = '#1d4ed8';
    if (icon) icon.textContent = 'ℹ️';
  } else if (type === 'error') {
    banner.style.background = '#fef2f2';
    banner.style.borderColor = '#fecaca';
    banner.style.color = '#991b1b';
    if (icon) icon.textContent = '⚠️';
  }
}

function getAlarmPeriod(timeStr) {
  if (!timeStr) return 'morning';
  const parts = String(timeStr).split(':');
  const hour = parseInt(parts[0], 10);
  if (isNaN(hour)) return 'morning';
  if (hour < 12) return 'morning'; // 00:00 - 11:59 (Buổi Sáng)
  if (hour < 19) return 'afternoon'; // 12:00 - 17:59 (Buổi Chiều)
  return 'evening'; // 18:00 - 23:59 (Buổi Tối)
}

function renderAlarmCard(a, today) {
  let badgeHtml = '';
  let detailText = '';

  if (a.type === 'website') {
    badgeHtml = '<span class="badge badge-web">🌐 Web</span>';
    detailText = `<a href="${escapeHtml(a.websiteUrl || '')}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.websiteUrl || '')}</a>`;
  } else if (a.type === 'tts') {
    let vLabel = 'Nam Azure';
    if (a.ttsVoiceType === 'azure_female' || a.voiceGender === 'female') vLabel = 'Nữ Azure';
    if (a.ttsVoiceType === 'browser_default') vLabel = 'Trình duyệt';
    badgeHtml = `<span class="badge badge-tts">🗣️ ${vLabel}</span>`;
    detailText = `<span class="tts-quote">“${escapeHtml(a.ttsText || '')}”</span>`;
  } else {
    badgeHtml = '<span class="badge badge-yt">🎬 YouTube</span>';
    detailText = a.vid ? `ID: <code>${escapeHtml(a.vid)}</code>` : '';
  }

  const days = (a.daysOfWeek && Array.isArray(a.daysOfWeek) && a.daysOfWeek.length > 0)
    ? a.daysOfWeek
    : [0, 1, 2, 3, 4, 5, 6];
  const isTodayActive = days.includes(today);
  const daysLabel = formatDaysOfWeek(days);
  const daysBadge = `<span class="badge-days ${isTodayActive ? 'active-today' : ''}" title="Lịch áp dụng: ${daysLabel}">📅 ${daysLabel}${isTodayActive ? ' (Hôm nay)' : ''}</span>`;

  return `
    <div class="alarm-card ${a.enabled ? '' : 'disabled'}" data-id="${a.id}">
      <div class="alarm-card-header">
        <div class="alarm-card-time-group">
          <span class="alarm-time">${a.time}</span>
          ${badgeHtml}
          <span class="badge badge-warning" title="Số lần lặp lại chuông">🔁 ${a.repeatCount === 0 ? 'Vô tận' : (a.repeatCount !== undefined ? a.repeatCount : 10) + 'l'}</span>
        </div>
        <label class="switch" title="${a.enabled ? 'Đang bật - Nhấp để tắt' : 'Đang tắt - Nhấp để bật'}">
          <input type="checkbox" class="toggle-switch" data-id="${a.id}" ${a.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>

      <div class="alarm-card-body">
        <div class="alarm-title" title="${escapeHtml(a.title || 'Mốc báo thức')}">${escapeHtml(a.title || 'Mốc báo thức')}</div>
        ${detailText ? `<div class="alarm-detail-info">${detailText}</div>` : ''}
      </div>

      <div class="alarm-card-footer">
        <div class="alarm-card-tags">
          ${daysBadge}
        </div>

        <div class="alarm-card-actions">
          <button type="button" class="btn-card-action btn-ring-test" data-id="${a.id}" title="Reo thử chuông ngay">
            🔔 <span>Thử</span>
          </button>
          <button type="button" class="btn-card-action btn-clone" data-id="${a.id}" title="Nhân bản mốc này">
            📋
          </button>
          <button type="button" class="btn-card-action btn-edit" data-id="${a.id}" title="Sửa thông số">
            ✏️
          </button>
          <button type="button" class="btn-card-action btn-delete" data-id="${a.id}" title="Xóa mốc này">
            🗑️
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderEmptyPeriod(period) {
  if (period === 'morning') {
    return `
      <div class="period-empty-state">
        <div class="empty-icon">☕</div>
        <div class="empty-title">Chưa có mốc buổi sáng</div>
        <div class="empty-desc">Thức dậy, thể dục, đọc tin tức (00:00 - 11:59)</div>
      </div>
    `;
  } else if (period === 'afternoon') {
    return `
      <div class="period-empty-state">
        <div class="empty-icon">☀️</div>
        <div class="empty-title">Chưa có mốc buổi chiều</div>
        <div class="empty-desc">Họp chiều, uống nước, giải lao (12:00 - 17:59)</div>
      </div>
    `;
  } else {
    return `
      <div class="period-empty-state">
        <div class="empty-icon">🌙</div>
        <div class="empty-title">Chưa có mốc buổi tối</div>
        <div class="empty-desc">Học bài, giải trí, đi ngủ (18:00 - 23:59)</div>
      </div>
    `;
  }
}

function renderAlarmsList() {
  const container = document.getElementById('alarmTableContainer');
  if (!container) return;

  const enabledCount = alarms.filter(a => a.enabled).length;

  if (document.getElementById('enabledCount')) document.getElementById('enabledCount').textContent = enabledCount;
  if (document.getElementById('totalCount')) document.getElementById('totalCount').textContent = alarms.length;

  // Filter stats
  const webCount = alarms.filter(a => a.type === 'website').length;
  const ttsCount = alarms.filter(a => a.type === 'tts').length;
  const ytCount = alarms.filter(a => a.type === 'youtube').length;
  const morningTotal = alarms.filter(a => getAlarmPeriod(a.time) === 'morning').length;
  const afternoonTotal = alarms.filter(a => getAlarmPeriod(a.time) === 'afternoon').length;
  const eveningTotal = alarms.filter(a => getAlarmPeriod(a.time) === 'evening').length;

  if (document.getElementById('filterEnabledCount')) document.getElementById('filterEnabledCount').textContent = enabledCount;
  if (document.getElementById('filterAllCount')) document.getElementById('filterAllCount').textContent = alarms.length;
  if (document.getElementById('filterWebCount')) document.getElementById('filterWebCount').textContent = webCount;
  if (document.getElementById('filterTtsCount')) document.getElementById('filterTtsCount').textContent = ttsCount;
  if (document.getElementById('filterYtCount')) document.getElementById('filterYtCount').textContent = ytCount;
  if (document.getElementById('filterMorningCount')) document.getElementById('filterMorningCount').textContent = morningTotal;
  if (document.getElementById('filterAfternoonCount')) document.getElementById('filterAfternoonCount').textContent = afternoonTotal;
  if (document.getElementById('filterEveningCount')) document.getElementById('filterEveningCount').textContent = eveningTotal;

  let filtered = [...alarms];

  if (currentFilter === 'website') {
    filtered = filtered.filter(a => a.type === 'website');
  } else if (currentFilter === 'tts') {
    filtered = filtered.filter(a => a.type === 'tts');
  } else if (currentFilter === 'youtube') {
    filtered = filtered.filter(a => a.type === 'youtube');
  } else if (currentFilter === 'enabled') {
    filtered = filtered.filter(a => a.enabled);
  } else if (currentFilter === 'morning') {
    filtered = filtered.filter(a => getAlarmPeriod(a.time) === 'morning');
  } else if (currentFilter === 'afternoon') {
    filtered = filtered.filter(a => getAlarmPeriod(a.time) === 'afternoon');
  } else if (currentFilter === 'evening') {
    filtered = filtered.filter(a => getAlarmPeriod(a.time) === 'evening');
  }

  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    filtered = filtered.filter(a =>
      (a.title && a.title.toLowerCase().includes(q)) ||
      (a.time && a.time.includes(q)) ||
      (a.websiteUrl && a.websiteUrl.toLowerCase().includes(q)) ||
      (a.ttsText && a.ttsText.toLowerCase().includes(q))
    );
  }

  // Ensure 3 columns shell exists
  let morningListEl = document.getElementById('morningAlarmsList');
  let afternoonListEl = document.getElementById('afternoonAlarmsList');
  let eveningListEl = document.getElementById('eveningAlarmsList');

  if (!morningListEl || !afternoonListEl || !eveningListEl) {
    container.innerHTML = `
      <div class="time-periods-grid">
        <!-- CỘT 1: BUỔI SÁNG (00:00 - 11:59) -->
        <div class="period-column period-morning" id="colMorning">
          <div class="period-header">
            <div class="period-header-left">
              <span class="period-icon">🌅</span>
              <div>
                <h3 class="period-title">BUỔI SÁNG</h3>
                <span class="period-sub">00:00 - 11:59</span>
              </div>
            </div>
            <span class="period-badge badge-morning" id="morningCount">0 mốc</span>
          </div>
          <div class="period-items" id="morningAlarmsList"></div>
        </div>

        <!-- CỘT 2: BUỔI CHIỀU (12:00 - 17:59) -->
        <div class="period-column period-afternoon" id="colAfternoon">
          <div class="period-header">
            <div class="period-header-left">
              <span class="period-icon">☀️</span>
              <div>
                <h3 class="period-title">BUỔI CHIỀU</h3>
                <span class="period-sub">12:00 - 17:59</span>
              </div>
            </div>
            <span class="period-badge badge-afternoon" id="afternoonCount">0 mốc</span>
          </div>
          <div class="period-items" id="afternoonAlarmsList"></div>
        </div>

        <!-- CỘT 3: BUỔI TỐI (18:00 - 23:59) -->
        <div class="period-column period-evening" id="colEvening">
          <div class="period-header">
            <div class="period-header-left">
              <span class="period-icon">🌙</span>
              <div>
                <h3 class="period-title">BUỔI TỐI</h3>
                <span class="period-sub">18:00 - 23:59</span>
              </div>
            </div>
            <span class="period-badge badge-evening" id="eveningCount">0 mốc</span>
          </div>
          <div class="period-items" id="eveningAlarmsList"></div>
        </div>
      </div>
    `;
    morningListEl = document.getElementById('morningAlarmsList');
    afternoonListEl = document.getElementById('afternoonAlarmsList');
    eveningListEl = document.getElementById('eveningAlarmsList');
  }

  // Handle density mode
  const isCompact = localStorage.getItem('alarms_density_mode') === 'compact';
  if (isCompact) {
    container.classList.add('density-compact');
  } else {
    container.classList.remove('density-compact');
  }
  const densityBtnText = document.getElementById('densityBtnText');
  if (densityBtnText) {
    densityBtnText.textContent = isCompact ? 'Xem Chi Tiết' : 'Xem Gọn';
  }

  filtered.sort((a, b) => a.time.localeCompare(b.time));
  const today = new Date().getDay();

  // Split into Morning, Afternoon, Evening groups
  const morningAlarms = filtered.filter(a => getAlarmPeriod(a.time) === 'morning');
  const afternoonAlarms = filtered.filter(a => getAlarmPeriod(a.time) === 'afternoon');
  const eveningAlarms = filtered.filter(a => getAlarmPeriod(a.time) === 'evening');

  // Đảm bảo tất cả các cột đều xếp 1 hàng cho mỗi setting (1 card per row)
  const eveningCol = document.getElementById('colEvening');
  if (eveningCol) {
    eveningCol.classList.remove('has-many-alarms');
  }

  // Update column badges with enabled count
  const morningCountEl = document.getElementById('morningCount');
  if (morningCountEl) {
    const actM = morningAlarms.filter(a => a.enabled).length;
    morningCountEl.textContent = `${morningAlarms.length} mốc (${actM} bật)`;
  }

  const afternoonCountEl = document.getElementById('afternoonCount');
  if (afternoonCountEl) {
    const actA = afternoonAlarms.filter(a => a.enabled).length;
    afternoonCountEl.textContent = `${afternoonAlarms.length} mốc (${actA} bật)`;
  }

  const eveningCountEl = document.getElementById('eveningCount');
  if (eveningCountEl) {
    const actE = eveningAlarms.filter(a => a.enabled).length;
    eveningCountEl.textContent = `${eveningAlarms.length} mốc (${actE} bật)`;
  }

  // Render items into each column
  morningListEl.innerHTML = morningAlarms.length > 0
    ? morningAlarms.map(a => renderAlarmCard(a, today)).join('')
    : renderEmptyPeriod('morning');

  afternoonListEl.innerHTML = afternoonAlarms.length > 0
    ? afternoonAlarms.map(a => renderAlarmCard(a, today)).join('')
    : renderEmptyPeriod('afternoon');

  eveningListEl.innerHTML = eveningAlarms.length > 0
    ? eveningAlarms.map(a => renderAlarmCard(a, today)).join('')
    : renderEmptyPeriod('evening');

  // Attach event handlers
  container.querySelectorAll('.toggle-switch').forEach(input => {
    input.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-id');
      await toggleAlarm(id, e.target.checked);
    });
  });

  container.querySelectorAll('.btn-ring-test').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const targetBtn = e.target.closest('.btn-ring-test') || btn;
      const id = targetBtn.getAttribute('data-id');
      const item = alarms.find(a => a.id === id);
      if (!item) {
        console.warn('Không tìm thấy mốc báo thức với ID:', id);
        return;
      }

      if (item.type === 'website') {
        let finalUrl = (item.websiteUrl || 'https://vnexpress.net').trim();
        if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
          chrome.tabs.create({ url: finalUrl, active: true });
        } else {
          window.open(finalUrl, '_blank');
        }
        updateStatusBanner(`🌐 Đã mở website: ${finalUrl}`, 'success');
        return;
      }

      if (item.type === 'tts') {
        const text = (item.ttsText || 'Đã đến giờ báo thức rồi!').trim();
        const vType = item.ttsVoiceType || (item.voiceGender === 'female' ? 'azure_female' : 'azure_male');
        const speed = item.voiceSpeed || 1.0;
        let token = (item.authToken || '').trim();
        if (!token) {
          token = (localStorage.getItem('azure_tts_token') || localStorage.getItem('gsheet_auth_token') || '').trim();
        }

        updateStatusBanner(`🗣️ Đang phát thử giọng đọc (${item.voiceGender === 'female' ? 'Nữ' : 'Nam'}): "${text}"`, 'info');
        if (typeof speakTTS === 'function') {
          //speakTTS(text, vType, speed, token, () => {
          //  updateStatusBanner(`✅ Đã hoàn tất phát thử giọng đọc!`, 'success');
          //});
        }

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          await syncToChromeStorage();
          chrome.runtime.sendMessage({ action: 'TRIGGER_TEST', alarmId: id, alarmData: item }, () => {
            if (chrome.runtime.lastError) {
              openRingWindow(item);
            }
          });
        } else {
          openRingWindow(item);
        }
        return;
      }

      if (item.type === 'youtube') {
        let vid = item.vid;
        if (!vid && item.youtubeUrl) {
          vid = extractVid(item.youtubeUrl);
        }
        if (!vid) vid = 'fuXfT4Rv_WM';
        item.vid = vid;

        updateStatusBanner(`🎬 Đang phát thử YouTube: ${item.title || vid}`, 'info');

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          await syncToChromeStorage();
          chrome.runtime.sendMessage({ action: 'TRIGGER_TEST', alarmId: id, alarmData: item }, () => {
            if (chrome.runtime.lastError) {
              openRingWindow(item);
            }
          });
        } else {
          openRingWindow(item);
        }
        return;
      }
    });
  });

  container.querySelectorAll('.btn-clone').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const targetBtn = e.target.closest('.btn-clone') || btn;
      const id = targetBtn.getAttribute('data-id');
      await cloneAlarm(id);
    });
  });

  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetBtn = e.target.closest('.btn-edit') || btn;
      const id = targetBtn.getAttribute('data-id');
      editAlarm(id);
    });
  });

  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const targetBtn = e.target.closest('.btn-delete') || btn;
      const id = targetBtn.getAttribute('data-id');
      const item = alarms.find(a => a.id === id);
      if (confirm(`Bạn có chắc muốn xóa mốc "${item ? item.title : id}" khỏi danh sách?`)) {
        await deleteDBAlarm(id);
        if (typeof deleteAlarmFromSheet === 'function') {
          deleteAlarmFromSheet(id).catch(() => {});
        }
        alarms = await getDBAlarms();
        renderAlarmsList();
        updateStatusBanner('Đã xóa mốc báo thức thành công!', 'info');
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
  if (typeof addAlarmToSheet === 'function') {
    addAlarmToSheet(cloned).catch(() => {});
  }
  alarms = await getDBAlarms();
  renderAlarmsList();
  updateStatusBanner(`📋 Đã nhân bản mốc ${cloned.time}!`, 'success');
}

async function toggleAlarm(id, enabled) {
  const item = alarms.find(a => a.id === id);
  if (item) {
    item.enabled = enabled;
    await saveDBAlarm(item);
    if (typeof updateAlarmInSheet === 'function') {
      updateAlarmInSheet(item).catch(() => {});
    }
    renderAlarmsList();
    updateStatusBanner(`Đã ${enabled ? 'bật' : 'tắt'} mốc ${item.time}!`, 'success');
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
  // Toggle form
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

  document.getElementById('btnCloseForm').addEventListener('click', () => {
    document.getElementById('formSection').style.display = 'none';
  });

  document.getElementById('btnCancelForm').addEventListener('click', () => {
    document.getElementById('formSection').style.display = 'none';
  });

  document.getElementById('formType').addEventListener('change', handleTypeChange);

  // Quick days buttons
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

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.getAttribute('data-filter');
      renderAlarmsList();
    });
  });

  // Search input
  const searchInput = document.getElementById('inputSearchAlarms');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim();
      renderAlarmsList();
    });
  }

  // Mở thử website
  document.getElementById('btnTestOpenWebsite').addEventListener('click', () => {
    let url = document.getElementById('formWebUrl').value.trim() || 'https://vnexpress.net';
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
    updateStatusBanner(`🌐 Đã mở thử: ${url}`, 'success');
  });

  // Chọn nhanh preset web
  document.querySelectorAll('.btn-preset-web').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      if (url) {
        document.getElementById('formWebUrl').value = url;
        const currentTitle = document.getElementById('formTitle').value.trim();
        if (!currentTitle || currentTitle.startsWith('Mở') || currentTitle.startsWith('Đọc')) {
          document.getElementById('formTitle').value = 'Mở ' + btn.textContent.trim();
        }
        updateStatusBanner(`🌐 Đã chọn: ${url}`, 'info');
      }
    });
  });

  // Chọn nhanh preset YouTube
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const vid = btn.getAttribute('data-vid');
      if (vid) {
        document.getElementById('formYtUrl').value = `https://www.youtube.com/watch?v=${vid}`;
        updateStatusBanner(`🎵 Đã chọn âm mẫu: ${btn.textContent.trim()}`, 'info');
      }
    });
  });

  // THAO TÁC NHANH NGAY TẠI DANH SÁCH (Lấy từ Sheet, Đẩy lên Sheet, Xóa tất cả chuyển ra ngoài)
  const btnMainPull = document.getElementById('btnMainPullSheet');
  const btnMainPush = document.getElementById('btnMainPushSheet');
  const btnMainClear = document.getElementById('btnMainClearAll');

  if (btnMainPull) {
    btnMainPull.addEventListener('click', async () => {
      try {
        btnMainPull.disabled = true;
        btnMainPull.textContent = '⏳ Đang tải...';
        updateStatusBanner('⏳ Đang kết nối lấy dữ liệu từ Google Sheets...', 'info');
        const sheetAlarms = await fetchAlarmsFromSheet();
        if (sheetAlarms && sheetAlarms.length > 0) {
          await bulkSaveDBAlarms(sheetAlarms);
          alarms = await getDBAlarms();
          renderAlarmsList();
          updateStatusBanner(`✅ Đã lấy thành công ${sheetAlarms.length} mốc từ Google Sheets!`, 'success');
        } else {
          updateStatusBanner('Sheet1 trên Google Sheets hiện đang trống!', 'info');
        }
      } catch (err) {
        updateStatusBanner('Lỗi lấy từ Google Sheet: ' + err.message, 'error');
      } finally {
        btnMainPull.disabled = false;
        btnMainPull.textContent = '⬇️ Lấy Từ Sheet';
      }
    });
  }

  if (btnMainPush) {
    btnMainPush.addEventListener('click', async () => {
      try {
        btnMainPush.disabled = true;
        btnMainPush.textContent = '⏳ Đang đẩy...';
        updateStatusBanner('⏳ Đang đẩy toàn bộ mốc lên Google Sheets...', 'info');
        const currentList = await getDBAlarms();
        const count = await pushAllAlarmsToSheet(currentList);
        updateStatusBanner(`✅ Đã đồng bộ thành công ${count} mốc lên Google Sheets!`, 'success');
      } catch (err) {
        updateStatusBanner('Lỗi đẩy lên Google Sheet: ' + err.message, 'error');
      } finally {
        btnMainPush.disabled = false;
        btnMainPush.textContent = '⬆️ Đẩy Lên Sheet';
      }
    });
  }

  if (btnMainClear) {
    btnMainClear.addEventListener('click', async () => {
      if (confirm('⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA TẤT CẢ MỐC BÁO THỨC?\nThao tác này sẽ xóa sạch toàn bộ danh sách khỏi bộ nhớ.')) {
        await clearAllDBAlarms();
        alarms = [];
        renderAlarmsList();
        updateStatusBanner('🗑️ Đã xóa sạch toàn bộ mốc báo thức khỏi danh sách!', 'success');
      }
    });
  }

  const btnMainLoadSamples = document.getElementById('btnMainLoadSamples');
  if (btnMainLoadSamples) {
    btnMainLoadSamples.addEventListener('click', async () => {
      await bulkSaveDBAlarms(DEFAULT_SAMPLES);
      alarms = await getDBAlarms();
      renderAlarmsList();
      updateStatusBanner('✨ Đã nạp thành công 5 mốc mẫu chuẩn vào danh sách!', 'success');
    });
  }

  // Chuyển đổi mật độ hiển thị (Xem gọn / Tiêu chuẩn)
  const btnToggleDensity = document.getElementById('btnToggleDensity');
  if (btnToggleDensity) {
    btnToggleDensity.addEventListener('click', () => {
      const isCompact = localStorage.getItem('alarms_density_mode') === 'compact';
      const nextMode = isCompact ? 'standard' : 'compact';
      localStorage.setItem('alarms_density_mode', nextMode);
      renderAlarmsList();
      updateStatusBanner(nextMode === 'compact' ? '🗜️ Đã bật chế độ xem thẻ siêu gọn!' : '📰 Đã chuyển sang chế độ xem tiêu chuẩn!', 'info');
    });
  }

  // Test giọng TTS
  const btnTestTtsVoice = document.getElementById('btnTestTtsVoice');
  if (btnTestTtsVoice) {
    btnTestTtsVoice.addEventListener('click', () => {
      if (isSpeakingTest) {
        if (typeof stopSpeaking === 'function') stopSpeaking();
        isSpeakingTest = false;
        btnTestTtsVoice.textContent = '🔊 Thử Giọng Ngay';
        updateStatusBanner('⏹️ Đã dừng thử giọng.', 'info');
        return;
      }

      const radio = document.querySelector('input[name="voiceTypeRadio"]:checked');
      const vType = radio ? radio.value : 'azure_male';
      const speed = parseFloat(document.getElementById('formVoiceSpeed').value) || 1.0;
      const tokenInput = document.getElementById('formAzureToken');
      let token = (tokenInput ? tokenInput.value.trim() : '') || localStorage.getItem('azure_tts_token') || localStorage.getItem('gsheet_auth_token') || '';
      if (token) localStorage.setItem('azure_tts_token', token);

      let sampleText = document.getElementById('formTtsText').value.trim();
      if (!sampleText) {
        sampleText = vType === 'azure_female'
          ? 'Chào bạn, đây là giọng Nữ của Azure truyền cảm và ngọt ngào!'
          : vType === 'browser_default'
          ? 'Chào bạn, đây là giọng phát âm mặc định của trình duyệt!'
          : 'Chào bạn, đây là giọng Nam của Azure mặc định trầm ấm và rõ ràng!';
      }

      btnTestTtsVoice.textContent = '⏹️ Dừng';
      isSpeakingTest = true;

      // Yêu cầu 2: Khi chưa setting token thì thông báo sử dụng mặc định trình duyệt đọc tiếng Việt
      if (!token && vType !== 'browser_default') {
        updateStatusBanner('⚠️ Chưa cài đặt Token: Tự động sử dụng giọng đọc Tiếng Việt mặc định của trình duyệt.', 'info');
      } else {
        updateStatusBanner(`🗣️ Đang phát thử giọng...`, 'info');
      }

      if (typeof speakTTS === 'function') {
        speakTTS(sampleText, vType, speed, token, () => {
          isSpeakingTest = false;
          btnTestTtsVoice.textContent = '🔊 Thử Giọng Ngay';
        });
      }
    });
  }

  // Thử chuông tổng quát
  document.getElementById('btnTestFormPreplay').addEventListener('click', () => {
    const type = document.getElementById('formType').value;
    if (type === 'website') {
      let url = document.getElementById('formWebUrl').value.trim() || 'https://vnexpress.net';
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      window.open(url, '_blank');
    } else if (type === 'tts') {
      const btn = document.getElementById('btnTestTtsVoice');
      if (btn) btn.click();
    } else {
      let ytUrl = document.getElementById('formYtUrl').value.trim() || 'https://www.youtube.com/watch?v=fuXfT4Rv_WM';
      const vid = extractVid(ytUrl) || 'fuXfT4Rv_WM';
      openRingWindow({
        id: 'test_preview_youtube',
        type: 'youtube',
        title: document.getElementById('formTitle').value.trim() || 'Báo thức YouTube',
        vid: vid,
        youtubeUrl: ytUrl,
        repeatCount: Number(document.getElementById('formRepeatCount').value) || 10
      });
    }
  });

function openRingWindow(item) {
  const p = new URLSearchParams();
  p.set('id', item.id || '');
  p.set('type', item.type || '');
  p.set('title', item.title || '');
  if (item.vid) p.set('vid', item.vid);
  if (item.youtubeUrl) p.set('youtubeUrl', item.youtubeUrl);
  if (item.ttsText) p.set('ttsText', item.ttsText);
  if (item.ttsVoiceType) p.set('ttsVoiceType', item.ttsVoiceType);
  if (item.voiceGender) p.set('voiceGender', item.voiceGender);
  if (item.voiceSpeed) p.set('voiceSpeed', String(item.voiceSpeed));
  if (item.repeatCount !== undefined) p.set('repeatCount', String(item.repeatCount));
  if (item.loop !== undefined) p.set('loop', String(item.loop));
  if (item.authToken) p.set('authToken', item.authToken);
  
  const ringUrl = `ring.html?${p.toString()}`;
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url: chrome.runtime.getURL(ringUrl), active: true });
  } else {
    window.open(ringUrl, '_blank', 'width=960,height=600,scrollbars=no,resizable=yes');
  }
}

  // Submit form
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
    if (typeof updateAlarmInSheet === 'function' && typeof addAlarmToSheet === 'function') {
      if (isEditing) {
        updateAlarmInSheet(newAlarm).catch(() => {});
      } else {
        addAlarmToSheet(newAlarm).catch(() => {});
      }
    }
    alarms = await getDBAlarms();
    document.getElementById('formSection').style.display = 'none';
    renderAlarmsList();
    updateStatusBanner(`Đã lưu mốc ${newAlarm.time} thành công!`, 'success');
  });
}

// Requirement 4: Setting Modal Setup (Chỉ khi click setting mới hiện)
function setupSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const btnOpen = document.getElementById('btnOpenSettingsModal');
  const btnClose = document.getElementById('btnCloseSettingsModal');
  const btnDone = document.getElementById('btnDoneSettingsModal');

  const openModal = () => {
    modal.style.display = 'flex';
    syncModalSettingsUI();
  };

  const closeModal = () => {
    modal.style.display = 'none';
  };

  btnOpen.addEventListener('click', openModal);
  btnClose.addEventListener('click', closeModal);
  btnDone.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Assistive Toggle inside Modal
  const toggleAssistive = document.getElementById('settingModalToggleAssistive');
  if (toggleAssistive) {
    toggleAssistive.addEventListener('change', async (e) => {
      const isEnabled = e.target.checked;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [ASSISTIVE_STORAGE_KEY]: isEnabled });
      } else {
        localStorage.setItem(ASSISTIVE_STORAGE_KEY, isEnabled ? 'true' : 'false');
      }
      updateStatusBanner(isEnabled ? '🛡️ Đã bật hiển thị Assistive trên màn hình!' : '🛡️ Đã tắt Assistive trên màn hình.', 'info');
    });
  }

  // Google Sheets token handlers
  const tokenInput = document.getElementById('modalSheetAuthToken');
  const tokenBadge = document.getElementById('modalSheetTokenBadge');
  const mainTokenAlertBox = document.getElementById('mainTokenAlertBox');
  const tokenAlertBox = document.getElementById('modalTokenAlertBox');
  const ttsTokenNotice = document.getElementById('ttsTokenNoticeBadge');
  const btnToggleToken = document.getElementById('btnModalToggleTokenVisible');
  const btnSaveToken = document.getElementById('btnModalSaveToken');

  function updateTokenBadgeUI(hasToken) {
    if (tokenBadge) {
      if (hasToken) {
        tokenBadge.className = 'token-status-badge badge-saved';
        tokenBadge.textContent = '🟢 Đã lưu Token';
      } else {
        tokenBadge.className = 'token-status-badge badge-missing';
        tokenBadge.textContent = '🔴 Chưa có Token';
      }
    }

    if (mainTokenAlertBox) {
      if (hasToken) {
        mainTokenAlertBox.className = 'token-alert-box alert-success';
        mainTokenAlertBox.innerHTML = `
          <span class="alert-icon">✅</span>
          <div class="alert-content">
            <strong>Đã cấu hình Token thành công:</strong>
            <span>Hệ thống sẵn sàng đồng bộ Google Sheets và phát giọng đọc trực tuyến Azure TTS tiếng Việt chất lượng cao.</span>
          </div>
          <button type="button" id="btnQuickOpenTokenModal" class="btn btn-sm btn-outline text-green" style="margin-left: auto; flex-shrink: 0;" title="Xem hoặc thay đổi token">
            ⚙️ Quản Lý Token
          </button>
        `;
      } else {
        mainTokenAlertBox.className = 'token-alert-box alert-warning';
        mainTokenAlertBox.innerHTML = `
          <span class="alert-icon">⚠️</span>
          <div class="alert-content">
            <strong>Chưa thiết lập Token:</strong>
            <span>Hệ thống sẽ tự động sử dụng giọng đọc Tiếng Việt mặc định của trình duyệt (Web Speech API) để phát âm báo thức. Để đồng bộ Google Sheets hoặc kích hoạt Azure TTS, hãy nhập token và bấm "Lưu Token".</span>
          </div>
          <button type="button" id="btnQuickOpenTokenModal" class="btn btn-sm btn-outline text-amber" style="margin-left: auto; flex-shrink: 0;" title="Mở cài đặt để nhập token">
            🔑 Nhập Token
          </button>
        `;
      }
      const quickBtn = document.getElementById('btnQuickOpenTokenModal');
      if (quickBtn) quickBtn.addEventListener('click', openModal);
    }

    if (tokenAlertBox) {
      if (hasToken) {
        tokenAlertBox.className = 'token-alert-box alert-success';
        tokenAlertBox.innerHTML = `
          <span class="alert-icon">✅</span>
          <div class="alert-content">
            <strong>Đã cấu hình Token thành công:</strong>
            <span>Hệ thống sẵn sàng đồng bộ Google Sheets và phát giọng đọc trực tuyến Azure TTS tiếng Việt chất lượng cao.</span>
          </div>
        `;
      } else {
        tokenAlertBox.className = 'token-alert-box alert-warning';
        tokenAlertBox.innerHTML = `
          <span class="alert-icon">⚠️</span>
          <div class="alert-content">
            <strong>Chưa thiết lập Token:</strong>
            <span>Hệ thống sẽ tự động sử dụng giọng đọc Tiếng Việt mặc định của trình duyệt (Web Speech API) để phát âm báo thức. Để đồng bộ Google Sheets hoặc kích hoạt Azure TTS, hãy nhập token và bấm "Lưu Token".</span>
          </div>
        `;
      }
    }

    if (ttsTokenNotice) {
      if (hasToken) {
        ttsTokenNotice.style.display = 'none';
      } else {
        ttsTokenNotice.style.display = 'flex';
        ttsTokenNotice.innerHTML = `<span>⚠️ Chưa cài đặt Token: Hệ thống sẽ tự động sử dụng giọng đọc Tiếng Việt mặc định của trình duyệt.</span>`;
      }
    }

    // Cập nhật thông báo chính trên thanh statusBanner theo yêu cầu
    if (hasToken) {
      updateStatusBanner('Dữ liệu lưu trữ tại IndexedDB cục bộ 100% offline, sẵn sàng hoạt động. Đã setting token có thể sử dụng đồng bộ googlesheet và AzureTTS', 'success');
    } else {
      updateStatusBanner('Dữ liệu lưu trữ tại IndexedDB cục bộ 100% offline, sẵn sàng hoạt động. Chưa setting token, ko thể sử dụng đồng bộ googlesheet và AzureTTS', 'info');
    }
  }

  window.showStatusNotification = updateStatusBanner;

  if (typeof getStoredAuthToken === 'function') {
    getStoredAuthToken().then(saved => {
      if (tokenInput && saved) {
        tokenInput.value = saved;
        updateTokenBadgeUI(true);
      } else {
        updateTokenBadgeUI(false);
      }
    });
  }

  if (btnToggleToken && tokenInput) {
    btnToggleToken.addEventListener('click', () => {
      tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
      btnToggleToken.textContent = tokenInput.type === 'password' ? '👁️' : '🙈';
    });
  }

  if (btnSaveToken && tokenInput) {
    btnSaveToken.addEventListener('click', async () => {
      const val = tokenInput.value.trim();
      if (typeof setStoredAuthToken === 'function') {
        await setStoredAuthToken(val);
      }
      updateTokenBadgeUI(Boolean(val));
      updateStatusBanner(val ? '🔑 Đã lưu Token Google Sheets!' : 'Đã xóa Token Google Sheets!', 'success');
    });
  }

  // Pull / Push Google Sheets
  const btnPull = document.getElementById('btnModalPullSheet');
  const btnPush = document.getElementById('btnModalPushSheet');
  const syncMsg = document.getElementById('modalSheetSyncMsg');

  if (btnPull) {
    btnPull.addEventListener('click', async () => {
      try {
        btnPull.disabled = true;
        btnPull.textContent = '⏳ Đang tải...';
        const sheetAlarms = await fetchAlarmsFromSheet();
        if (sheetAlarms.length > 0) {
          await bulkSaveDBAlarms(sheetAlarms);
          alarms = await getDBAlarms();
          renderAlarmsList();
          syncMsg.style.display = 'block';
          syncMsg.style.background = '#dcfce7';
          syncMsg.style.color = '#15803d';
          syncMsg.textContent = `✅ Đã tải thành công ${sheetAlarms.length} mốc từ Google Sheets!`;
        } else {
          syncMsg.style.display = 'block';
          syncMsg.style.background = '#fef3c7';
          syncMsg.style.color = '#b45309';
          syncMsg.textContent = 'Sheet1 hiện đang trống!';
        }
      } catch (err) {
        syncMsg.style.display = 'block';
        syncMsg.style.background = '#fee2e2';
        syncMsg.style.color = '#be123c';
        syncMsg.textContent = 'Lỗi kết nối: ' + err.message;
      } finally {
        btnPull.disabled = false;
        btnPull.textContent = '⬇️ Tải Dữ Liệu Từ Google Sheet';
      }
    });
  }

  if (btnPush) {
    btnPush.addEventListener('click', async () => {
      try {
        btnPush.disabled = true;
        btnPush.textContent = '⏳ Đang đẩy...';
        const currentList = await getDBAlarms();
        const count = await pushAllAlarmsToSheet(currentList);
        syncMsg.style.display = 'block';
        syncMsg.style.background = '#dcfce7';
        syncMsg.style.color = '#15803d';
        syncMsg.textContent = `✅ Đã đồng bộ ${count} mốc lên Google Sheets!`;
      } catch (err) {
        syncMsg.style.display = 'block';
        syncMsg.style.background = '#fee2e2';
        syncMsg.style.color = '#be123c';
        syncMsg.textContent = 'Lỗi: ' + err.message;
      } finally {
        btnPush.disabled = false;
        btnPush.textContent = '⬆️ Đẩy Toàn Bộ Lên Google Sheet';
      }
    });
  }

  // Backup / Restore JSON
  document.getElementById('btnModalExportJson').addEventListener('click', async () => {
    const currentList = await getDBAlarms();
    const blob = new Blob([JSON.stringify(currentList, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart_alarms_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    updateStatusBanner('📥 Đã xuất file JSON thành công!', 'success');
  });

  const fileInput = document.getElementById('modalFileInputJson');
  document.getElementById('btnModalImportJson').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('File không hợp lệ');
      await bulkSaveDBAlarms(parsed);
      alarms = await getDBAlarms();
      renderAlarmsList();
      alert(`Đã khôi phục ${parsed.length} mốc từ file JSON!`);
    } catch (err) {
      alert('Lỗi nhập file: ' + err.message);
    } finally {
      fileInput.value = '';
    }
  });

  // Load samples if modal element exists
  const btnModalLoad = document.getElementById('btnModalLoadSamples');
  if (btnModalLoad) {
    btnModalLoad.addEventListener('click', async () => {
      await bulkSaveDBAlarms(DEFAULT_SAMPLES);
      alarms = await getDBAlarms();
      renderAlarmsList();
      alert('Đã nạp 5 mốc mẫu chuẩn!');
    });
  }

  // Clear all if modal element exists
  const btnModalClear = document.getElementById('btnModalClearAll');
  if (btnModalClear) {
    btnModalClear.addEventListener('click', async () => {
      if (confirm('Bạn có chắc muốn XÓA TẤT CẢ mốc báo thức khỏi IndexedDB?')) {
        await clearAllDBAlarms();
        alarms = [];
        renderAlarmsList();
        alert('Đã xóa sạch toàn bộ dữ liệu!');
      }
    });
  }
}

async function syncModalSettingsUI() {
  const toggle = document.getElementById('settingModalToggleAssistive');
  if (toggle) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const d = await chrome.storage.local.get([ASSISTIVE_STORAGE_KEY]);
      toggle.checked = d[ASSISTIVE_STORAGE_KEY] === true;
    } else {
      toggle.checked = localStorage.getItem(ASSISTIVE_STORAGE_KEY) === 'true';
    }
  }
}
