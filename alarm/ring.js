const ALARMS_STORAGE_KEY = 'smart_alarms_v2_light';

let currentRepeat = 1;
let maxRepeats = 10;
let isLooping = true;

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const alarmId = params.get('id');

  let alarm = {
    title: 'Báo thức',
    type: 'website',
    websiteUrl: 'https://vnexpress.net',
    repeatCount: 1
  };

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get(ALARMS_STORAGE_KEY);
      const alarms = data[ALARMS_STORAGE_KEY] || [];
      const found = alarms.find(a => a.id === alarmId);
      if (found) alarm = found;
    }
  } catch (e) {}

  maxRepeats = alarm.repeatCount !== undefined ? alarm.repeatCount : (alarm.type === 'website' ? 1 : 10);
  isLooping = alarm.loop !== false && maxRepeats !== 1;

  document.getElementById('hudTitle').textContent = alarm.title || 'Đã đến giờ hẹn!';
  document.getElementById('hudRepeat').textContent = maxRepeats === 0 ? '🔁 Vô tận' : `🔁 ${maxRepeats} lần`;

  const updateClock = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${h}:${m}:${s}`;
    document.getElementById('hudTime').textContent = timeStr;
    const ttsClock = document.getElementById('ttsClock');
    if (ttsClock) ttsClock.textContent = timeStr;
  };
  updateClock();
  setInterval(updateClock, 1000);

  if (alarm.type === 'website') {
    let finalUrl = (alarm.websiteUrl || 'https://vnexpress.net').trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
    window.location.replace(finalUrl);
    return;
  } else if (alarm.type === 'tts') {
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
      badge = 'Nữ của Azure';
      badgeBg = '#7c3aed';
    } else if (vType === 'browser_default') {
      icon = '🌐';
      badge = 'Mặc định trình duyệt (Tiếng Việt)';
      badgeBg = '#059669';
    }

    document.getElementById('ttsGenderIcon').textContent = icon;
    document.getElementById('ttsGenderBadge').textContent = badge;
    document.getElementById('ttsGenderBadge').style.background = badgeBg;

    updateTtsStatus();
    startTtsLoop(alarm.ttsText, vType, alarm.voiceSpeed || 1, effectiveToken);
  } else {
    document.getElementById('ytLayer').style.display = 'block';
    const vid = alarm.vid || 'fuXfT4Rv_WM';
    const iframe = document.getElementById('ytIframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&mute=0&loop=1&playlist=${vid}&enablejsapi=1&origin=https%3A%2F%2Fwww.youtube.com&widget_referrer=https%3A%2F%2Fwww.youtube.com`;
  }

  document.getElementById('btnStop').addEventListener('click', () => {
    stopAllAudio();
    window.close();
  });

  document.getElementById('btnSnooze').addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'SNOOZE_ALARM', alarmId: alarm.id, minutes: 5 });
    }
    stopAllAudio();
    window.close();
  });
});

function updateTtsStatus() {
  const el = document.getElementById('ttsRepeatStatus');
  if (el) {
    el.textContent = maxRepeats === 0
      ? `Đang lặp lại lần thứ ${currentRepeat} (Lặp vô tận)`
      : `Đang lặp lại: ${currentRepeat} / ${maxRepeats} lần`;
  }
}

function stopAllAudio() {
  isLooping = false;
  if (typeof stopSpeaking === 'function') stopSpeaking();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function startTtsLoop(text, voiceType, speed, authToken) {
  currentRepeat = 1;
  playOneTtsIteration(text, voiceType, speed, authToken);
}

function playOneTtsIteration(text, voiceType, speed, authToken) {
  if (!isLooping && currentRepeat > 1) return;
  updateTtsStatus();

  const cleanedText = (text || 'Chào bạn, đã đến giờ hẹn rồi!').trim();
  if (typeof speakTTS === 'function') {
    speakTTS(cleanedText, voiceType, speed || 1, authToken || '', () => {
      onIterationFinished(text, voiceType, speed, authToken);
    });
  }
}

function onIterationFinished(text, voiceType, speed, authToken) {
  if (!isLooping) return;
  if (maxRepeats === 0 || currentRepeat < maxRepeats) {
    currentRepeat++;
    setTimeout(() => {
      if (isLooping) playOneTtsIteration(text, voiceType, speed, authToken);
    }, 1500);
  } else {
    isLooping = false;
    const el = document.getElementById('ttsRepeatStatus');
    if (el) el.textContent = `Đã hoàn thành ${maxRepeats} lần lặp.`;
  }
}
