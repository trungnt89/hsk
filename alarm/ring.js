const ALARMS_STORAGE_KEY = 'smart_alarms_v2_light';

let currentRepeat = 1;
let maxRepeats = 10;
let isStopped = false;
let isClosing = false;
let ttsTimeoutId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const alarmId = params.get('id');

  const urlType = params.get('type') || '';
  const urlTitle = params.get('title') || '';
  const urlVid = params.get('vid') || '';
  const urlTtsText = params.get('ttsText') || '';
  const urlVoiceType = params.get('ttsVoiceType') || '';
  const urlGender = params.get('voiceGender') || '';
  const urlSpeed = params.get('voiceSpeed') ? parseFloat(params.get('voiceSpeed')) : 1.0;
  const urlWebsiteUrl = params.get('websiteUrl') || '';
  const urlRepeat = params.get('repeatCount') !== null ? Number(params.get('repeatCount')) : undefined;
  const urlLoop = params.get('loop') !== null ? params.get('loop') === 'true' : undefined;
  const urlAuthToken = params.get('authToken') || '';

  // Khởi tạo alarm
  let alarm = {
    id: alarmId || '',
    title: urlTitle || 'Đã đến giờ hẹn!',
    type: urlType || (urlVid ? 'youtube' : 'tts'),
    repeatCount: urlRepeat !== undefined ? urlRepeat : 10,
    loop: urlLoop !== undefined ? urlLoop : true,
    vid: urlVid || 'fuXfT4Rv_WM',
    ttsText: urlTtsText || 'Đã đến giờ báo thức rồi!',
    ttsVoiceType: urlVoiceType || 'azure_male',
    voiceGender: urlGender || 'male',
    voiceSpeed: urlSpeed,
    authToken: urlAuthToken,
    websiteUrl: urlWebsiteUrl
  };

  // 1. Thử lấy từ chrome.storage.local
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && alarmId) {
      const data = await chrome.storage.local.get(ALARMS_STORAGE_KEY);
      const alarms = data[ALARMS_STORAGE_KEY] || [];
      const found = alarms.find(a => a.id === alarmId);
      if (found) {
        alarm = { ...alarm, ...found };
      }
    }
  } catch (e) {}

  // 2. Thử lấy từ IndexedDB qua db.js
  if ((!alarm.title || alarm.title === 'Đã đến giờ hẹn!') && typeof getAllAlarms === 'function' && alarmId) {
    try {
      const idbAlarms = await getAllAlarms();
      const found = idbAlarms.find(a => a.id === alarmId);
      if (found) {
        alarm = { ...alarm, ...found };
      }
    } catch (e) {}
  }

  // 3. Thử lấy từ localStorage
  if ((!alarm.title || alarm.title === 'Đã đến giờ hẹn!') && alarmId) {
    try {
      const raw = localStorage.getItem(ALARMS_STORAGE_KEY) || localStorage.getItem('smart_alarms');
      if (raw) {
        const localAlarms = JSON.parse(raw);
        const found = localAlarms.find(a => a.id === alarmId);
        if (found) {
          alarm = { ...alarm, ...found };
        }
      }
    } catch (e) {}
  }

  // Ưu tiên các param từ URL nếu được truyền cụ thể
  if (urlType) alarm.type = urlType;
  if (urlVid) alarm.vid = urlVid;
  if (urlTtsText) alarm.ttsText = urlTtsText;
  if (urlRepeat !== undefined) alarm.repeatCount = urlRepeat;

  // Xác định số lần phát tối đa
  // 0 = lặp vô tận, 1..N = số lần phát cụ thể
  maxRepeats = alarm.repeatCount !== undefined ? Number(alarm.repeatCount) : 10;
  currentRepeat = 1;

  document.getElementById('hudTitle').textContent = alarm.title || 'Đã đến giờ hẹn!';
  updateRepeatDisplay();

  const updateClock = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${h}:${m}:${s}`;
    const hudTime = document.getElementById('hudTime');
    if (hudTime) hudTime.textContent = timeStr;
    const ttsClock = document.getElementById('ttsClock');
    if (ttsClock) ttsClock.textContent = timeStr;
  };
  updateClock();
  setInterval(updateClock, 1000);

  // CHỈ redirect nếu đúng là loại website VÀ có URL hợp lệ:
  if (alarm.type === 'website') {
    let finalUrl = (alarm.websiteUrl || '').trim();
    if (finalUrl) {
      if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
      window.location.replace(finalUrl);
      return;
    }
    alarm.type = 'tts';
    alarm.ttsText = 'Đã đến giờ mở Website theo hẹn nhưng chưa có địa chỉ web!';
  }

  if (alarm.type === 'tts') {
    document.getElementById('ttsLayer').style.display = 'block';
    document.getElementById('ttsTitle').textContent = alarm.title || 'Lời nhắc bằng giọng đọc';
    document.getElementById('ttsText').textContent = `"${alarm.ttsText || 'Đã đến giờ báo thức rồi!'}"`;

    let effectiveToken = (alarm.authToken || '').trim();
    if (!effectiveToken && typeof localStorage !== 'undefined') {
      effectiveToken = (localStorage.getItem('azure_tts_token') || localStorage.getItem('gsheet_auth_token') || '').trim();
    }

    let vType = alarm.ttsVoiceType || (alarm.voiceGender === 'female' ? 'azure_female' : 'azure_male');
    let icon = '👨';
    let badge = 'Nam của Azure (Mặc định)';
    let badgeBg = '#1d4ed8';

    if (!effectiveToken && vType !== 'browser_default') {
      icon = '🌐';
      badge = 'Tiếng Việt trình duyệt (Chưa có token)';
      badgeBg = '#d97706';
    } else if (vType === 'azure_female') {
      icon = '👩';
      badge = 'Nữ của Azure (vi-VN-HoaiMyNeural)';
      badgeBg = '#7c3aed';
    } else if (vType === 'browser_default') {
      icon = '🌐';
      badge = 'Mặc định trình duyệt (Tiếng Việt)';
      badgeBg = '#059669';
    }

    document.getElementById('ttsGenderIcon').textContent = icon;
    document.getElementById('ttsGenderBadge').textContent = badge;
    document.getElementById('ttsGenderBadge').style.background = badgeBg;

    updateRepeatDisplay();
    startTtsLoop(alarm.ttsText, vType, alarm.voiceSpeed || 1, effectiveToken);
  } else {
    // Chế độ YouTube
    document.getElementById('ytLayer').style.display = 'block';
    const vid = alarm.vid || 'fuXfT4Rv_WM';
    const iframe = document.getElementById('ytIframe');

    // Nếu lặp vô tận (maxRepeats === 0): bật loop=1&playlist=${vid}
    // Nếu có số lần lặp giới hạn (maxRepeats > 0): tắt loop của YouTube để bắt sự kiện kết thúc (ended)
    const isInfinite = maxRepeats === 0;
    iframe.src = `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&mute=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&widget_referrer=${encodeURIComponent(window.location.origin)}${isInfinite ? `&loop=1&playlist=${vid}` : ''}`;

    setupYouTubeListener(vid);
    updateRepeatDisplay();
  }

  document.getElementById('btnStop').addEventListener('click', () => {
    isStopped = true;
    stopAllAudio();
    closeAlarmWindow();
  });

  document.getElementById('btnSnooze').addEventListener('click', () => {
    isStopped = true;
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'SNOOZE_ALARM', alarmId: alarm.id, minutes: 5 });
    }
    stopAllAudio();
    closeAlarmWindow();
  });
});

/**
 * Cập nhật hiển thị số lần phát / tổng số lần
 */
function updateRepeatDisplay() {
  const hudRepeat = document.getElementById('hudRepeat');
  const ttsRepeatStatus = document.getElementById('ttsRepeatStatus');

  const hudText = maxRepeats === 0
    ? `🔁 Lần ${currentRepeat} (Vô tận)`
    : `🔁 Lần phát: ${currentRepeat}/${maxRepeats}`;

  const ttsText = maxRepeats === 0
    ? `Đang phát lần thứ ${currentRepeat} (Lặp vô tận)`
    : `Số lần phát: ${currentRepeat} / ${maxRepeats}`;

  if (hudRepeat) {
    hudRepeat.textContent = hudText;
  }
  if (ttsRepeatStatus) {
    ttsRepeatStatus.textContent = ttsText;
  }
}

/**
 * Xử lý khi đã hoàn thành toàn bộ số lần phát: Tự động đóng cửa sổ
 */
function handleAllRepeatsFinished() {
  if (isStopped || isClosing) return;
  isClosing = true;

  const hudRepeat = document.getElementById('hudRepeat');
  const ttsRepeatStatus = document.getElementById('ttsRepeatStatus');

  if (hudRepeat) {
    hudRepeat.textContent = `✅ Đã xong (${maxRepeats}/${maxRepeats}) - Đang đóng...`;
    hudRepeat.classList.add('finished');
  }
  if (ttsRepeatStatus) {
    ttsRepeatStatus.textContent = `✅ Đã phát xong ${maxRepeats}/${maxRepeats} lượt. Tự động đóng cửa sổ báo thức...`;
    ttsRepeatStatus.style.color = '#34d399';
  }

  stopAllAudio();

  // Đếm ngược 1.2s rồi tự động đóng cửa sổ báo thức
  setTimeout(() => {
    closeAlarmWindow();
  }, 1200);
}

/**
 * Đóng cửa sổ / tab báo thức một cách an toàn và triệt để
 */
function closeAlarmWindow() {
  stopAllAudio();

  // 1. Thử dùng Chrome Tabs API nếu mở bằng tab
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.getCurrent) {
      chrome.tabs.getCurrent((tab) => {
        if (tab && tab.id) {
          chrome.tabs.remove(tab.id, () => {
            window.close();
          });
          return;
        }
        closeViaWindowApi();
      });
      return;
    }
  } catch (e) {}

  closeViaWindowApi();
}

function closeViaWindowApi() {
  // 2. Thử dùng Chrome Windows API nếu mở bằng cửa sổ popup
  try {
    if (typeof chrome !== 'undefined' && chrome.windows && chrome.windows.getCurrent) {
      chrome.windows.getCurrent((win) => {
        if (win && win.id) {
          chrome.windows.remove(win.id, () => {
            window.close();
          });
        } else {
          window.close();
        }
      });
      return;
    }
  } catch (e) {}

  // 3. Fallback tiêu chuẩn của trình duyệt
  window.close();
}

function stopAllAudio() {
  if (ttsTimeoutId) {
    clearTimeout(ttsTimeoutId);
    ttsTimeoutId = null;
  }
  if (typeof stopSpeaking === 'function') stopSpeaking();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function startTtsLoop(text, voiceType, speed, authToken) {
  currentRepeat = 1;
  playOneTtsIteration(text, voiceType, speed, authToken);
}

function playOneTtsIteration(text, voiceType, speed, authToken) {
  if (isStopped || isClosing) return;
  updateRepeatDisplay();

  const cleanedText = (text || 'Chào bạn, đã đến giờ hẹn rồi!').trim();
  if (typeof speakTTS === 'function') {
    speakTTS(cleanedText, voiceType, speed || 1, authToken || '', () => {
      onTtsIterationFinished(text, voiceType, speed, authToken);
    });
  }
}

function onTtsIterationFinished(text, voiceType, speed, authToken) {
  if (isStopped || isClosing) return;

  // Kiểm tra nếu đã hoàn thành số lần phát được thiết lập
  if (maxRepeats > 0 && currentRepeat >= maxRepeats) {
    handleAllRepeatsFinished();
    return;
  }

  // Tăng lượt phát và lặp lại
  currentRepeat++;
  updateRepeatDisplay();

  ttsTimeoutId = setTimeout(() => {
    if (!isStopped && !isClosing) {
      playOneTtsIteration(text, voiceType, speed, authToken);
    }
  }, 1200);
}

/**
 * Lắng nghe trạng thái phát của YouTube qua IFrame API postMessage
 */
function setupYouTubeListener(vid) {
  const iframe = document.getElementById('ytIframe');
  if (iframe) {
    iframe.addEventListener('load', () => {
      try {
        iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*');
      } catch (e) {}
    });
  }

  window.addEventListener('message', (event) => {
    if (isStopped || isClosing) return;
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      let playerState = null;

      if (data && data.event === 'infoDelivery' && data.info && typeof data.info.playerState !== 'undefined') {
        playerState = data.info.playerState;
      } else if (data && data.event === 'onStateChange' && typeof data.info !== 'undefined') {
        playerState = data.info;
      }

      // Trạng thái 0 = ENDED (kết thúc video)
      if (playerState === 0) {
        onYouTubeVideoEnded(vid);
      }
    } catch (err) {}
  });
}

function onYouTubeVideoEnded(vid) {
  if (isStopped || isClosing) return;

  if (maxRepeats > 0 && currentRepeat >= maxRepeats) {
    handleAllRepeatsFinished();
    return;
  }

  currentRepeat++;
  updateRepeatDisplay();

  const iframe = document.getElementById('ytIframe');
  if (iframe && iframe.contentWindow) {
    try {
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [0, true] }), '*');
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: '' }), '*');
    } catch (e) {}
  }
}
