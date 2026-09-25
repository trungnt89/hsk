const ALARMS_STORAGE_KEY = 'smart_alarms_v2_light';
let selectedQuickType = 'website';

document.addEventListener('DOMContentLoaded', () => {
  initClock();
  loadAlarms();
  setupTypeTabs();

  document.getElementById('btnOptions').addEventListener('click', openOptions);
  document.getElementById('btnFullDashboard').addEventListener('click', openOptions);
  document.getElementById('btnQuickAdd').addEventListener('click', handleQuickAdd);
  document.getElementById('btnRefreshList').addEventListener('click', loadAlarms);

  // Gợi ý giờ mặc định sau 5 phút
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  document.getElementById('quickTimeInput').value = `${hh}:${mm}`;
});

function setupTypeTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const webRow = document.getElementById('quickWebsiteRow');
  const ttsRow = document.getElementById('quickTtsRow');
  const ytRow = document.getElementById('quickYtRow');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedQuickType = tab.getAttribute('data-type');

      webRow.style.display = selectedQuickType === 'website' ? 'flex' : 'none';
      ttsRow.style.display = selectedQuickType === 'tts' ? 'flex' : 'none';
      ytRow.style.display = selectedQuickType === 'youtube' ? 'flex' : 'none';
    });
  });
}

function initClock() {
  const update = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('liveClock').textContent = `${h}:${m}:${s}`;
    document.getElementById('liveDate').textContent = now.toLocaleDateString('vi-VN', {
      weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric'
    });
  };
  update();
  setInterval(update, 1000);
}

function formatDaysOfWeek(days) {
  if (!days || !Array.isArray(days) || days.length === 0 || days.length === 7) return 'Hàng ngày';
  if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) return 'T2 - T6';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Cuối tuần';
  const dayNames = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 0: 'CN' };
  const sorted = [...days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  return sorted.map(d => dayNames[d]).join(', ');
}

async function loadAlarms() {
  const data = await chrome.storage.local.get(ALARMS_STORAGE_KEY);
  let alarms = data[ALARMS_STORAGE_KEY] || [];
  let updated = false;
  alarms = alarms.map(a => {
    if (!a.daysOfWeek || !Array.isArray(a.daysOfWeek) || a.daysOfWeek.length === 0) {
      a.daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
      updated = true;
    }
    return a;
  });
  if (updated) {
    await chrome.storage.local.set({ [ALARMS_STORAGE_KEY]: alarms });
  }
  renderAlarms(alarms);
}

function renderAlarms(alarms) {
  const listEl = document.getElementById('alarmList');
  document.getElementById('alarmCount').textContent = alarms.length;

  if (alarms.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:16px;color:#94a3b8;font-size:0.85rem;">Chưa có mốc báo thức nào</div>';
    return;
  }

  alarms.sort((a, b) => a.time.localeCompare(b.time));

  const currentDay = new Date().getDay();

  listEl.innerHTML = alarms.map(a => {
    let tagHtml = '';
    let subInfo = '';
    if (a.type === 'website') {
      tagHtml = '<span class="card-tag web">🌐 Website</span>';
      subInfo = a.websiteUrl || 'Trang web';
    } else if (a.type === 'tts') {
      let vLabel = '👨 Nam Azure';
      if (a.ttsVoiceType === 'azure_female' || a.voiceGender === 'female') vLabel = '👩 Nữ Azure';
      if (a.ttsVoiceType === 'browser_default') vLabel = '🌐 Trình duyệt';
      tagHtml = `<span class="card-tag tts">🗣️ ${vLabel}</span>`;
      subInfo = a.ttsText || 'Lời thoại nhắc nhở';
    } else {
      tagHtml = '<span class="card-tag yt">🎬 YouTube</span>';
      subInfo = a.vid ? `ID: ${a.vid}` : 'Video';
    }

    const days = (a.daysOfWeek && Array.isArray(a.daysOfWeek) && a.daysOfWeek.length > 0)
      ? a.daysOfWeek
      : [0, 1, 2, 3, 4, 5, 6];
    const isToday = days.includes(currentDay);
    const dayBadgeHtml = `<span style="font-size: 10px; font-weight: 700; color: ${isToday ? '#e11d48' : '#64748b'}; background: ${isToday ? '#ffe4e6' : '#f1f5f9'}; border: 1px solid ${isToday ? '#fda4af' : '#cbd5e1'}; border-radius: 4px; padding: 1px 4px; margin-left: 4px;">📅 ${formatDaysOfWeek(days)}${isToday ? ' • Hôm nay' : ''}</span>`;

    let actionBtnHtml = '';
    if (a.type === 'website' && a.websiteUrl) {
      actionBtnHtml = `<button type="button" class="btn-open-web-quick" data-url="${escapeHtml(a.websiteUrl)}" title="Mở trang web ngay" style="background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; border-radius: 6px; padding: 2px 7px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 2px;">↗️ Mở</button>`;
    }

    return `
      <div class="alarm-card ${a.enabled ? '' : 'off'}">
        <div class="card-left">
          <div class="card-time">${a.time}</div>
          <div class="card-title">${a.title || 'Mốc báo thức'}</div>
          <div>
            ${tagHtml}
            ${dayBadgeHtml}
            <span style="font-size: 0.7rem; color: #64748b; margin-left: 4px;">${escapeHtml(subInfo)}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          ${actionBtnHtml}
          <label class="switch">
            <input type="checkbox" data-id="${a.id}" ${a.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.btn-open-web-quick').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      let url = btn.getAttribute('data-url');
      if (url) {
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        chrome.tabs.create({ url, active: true });
      }
    });
  });

  listEl.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-id');
      await toggleAlarm(id, e.target.checked);
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

async function toggleAlarm(id, enabled) {
  const data = await chrome.storage.local.get(ALARMS_STORAGE_KEY);
  const alarms = data[ALARMS_STORAGE_KEY] || [];
  const item = alarms.find(a => a.id === id);
  if (item) {
    item.enabled = enabled;
    await chrome.storage.local.set({ [ALARMS_STORAGE_KEY]: alarms });
    chrome.runtime.sendMessage({ action: 'RESCHEDULE_ALARMS' });
    loadAlarms();
  }
}

async function handleQuickAdd() {
  const time = document.getElementById('quickTimeInput').value;
  const title = document.getElementById('quickTitleInput').value.trim();
  if (!time) return;

  let newAlarm = {
    id: 'alarm_' + Date.now(),
    time: time,
    type: selectedQuickType,
    title: title || (selectedQuickType === 'website' ? 'Mở Website' : selectedQuickType === 'tts' ? 'Nhắc nhở TTS' : 'Báo thức YouTube'),
    enabled: true,
    repeatCount: 1,
    loop: false,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
  };

  if (selectedQuickType === 'website') {
    let url = document.getElementById('quickWebUrlInput').value.trim() || 'https://vnexpress.net';
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    newAlarm.websiteUrl = url;
    newAlarm.openMode = 'new_tab';
  } else if (selectedQuickType === 'tts') {
    const voiceType = document.getElementById('quickGenderSelect').value || 'azure_male';
    const text = document.getElementById('quickTtsTextInput').value.trim() || 'Đã đến giờ hẹn rồi!';
    newAlarm.ttsVoiceType = voiceType;
    newAlarm.voiceGender = voiceType === 'azure_female' ? 'female' : 'male';
    newAlarm.voiceName = voiceType === 'azure_female' ? 'vi-VN-HoaiMyNeural' : 'vi-VN-NamMinhNeural';
    newAlarm.ttsText = text;
    newAlarm.voiceSpeed = 1;
    newAlarm.repeatCount = 5;
    newAlarm.loop = false;
  } else {
    let ytUrl = document.getElementById('quickYtUrlInput').value.trim() || 'https://www.youtube.com/watch?v=fuXfT4Rv_WM';
    newAlarm.youtubeUrl = ytUrl;
    newAlarm.vid = 'fuXfT4Rv_WM';
    newAlarm.repeatCount = 10;
    newAlarm.loop = true;
  }

  const data = await chrome.storage.local.get(ALARMS_STORAGE_KEY);
  const alarms = data[ALARMS_STORAGE_KEY] || [];
  alarms.push(newAlarm);
  await chrome.storage.local.set({ [ALARMS_STORAGE_KEY]: alarms });

  chrome.runtime.sendMessage({ action: 'RESCHEDULE_ALARMS' });
  document.getElementById('quickTitleInput').value = '';
  loadAlarms();
}

function openOptions() {
  const optionsUrl = chrome.runtime.getURL('options.html');
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url: optionsUrl });
  } else {
    window.open(optionsUrl, '_blank');
  }
}
