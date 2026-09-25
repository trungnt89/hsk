const ALARMS_STORAGE_KEY = 'smart_alarms_v2_light';

let currentRepeat = 1;
let maxRepeats = 10;
let isLooping = true;
let chimeInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const alarmId = params.get('id');

  const data = await chrome.storage.local.get(ALARMS_STORAGE_KEY);
  const alarms = data[ALARMS_STORAGE_KEY] || [];
  const alarm = alarms.find(a => a.id === alarmId) || alarms[0] || {
    title: 'Báo thức',
    type: 'website',
    websiteUrl: 'https://vnexpress.net',
    repeatCount: 1
  };

  maxRepeats = alarm.repeatCount !== undefined ? alarm.repeatCount : (alarm.type === 'website' ? 1 : 10);
  isLooping = alarm.loop !== false && maxRepeats !== 1;

  document.getElementById('hudTitle').textContent = alarm.title || 'Đã đến giờ hẹn!';
  document.getElementById('hudRepeat').textContent = maxRepeats === 0 ? '🔁 Vô tận' : `🔁 ${maxRepeats} lần`;

  // Cập nhật đồng hồ thời gian thực
  const updateClock = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${h}:${m}:${s}`;
    document.getElementById('hudTime').textContent = timeStr;
    const ttsClock = document.getElementById('ttsClock');
    if (ttsClock) ttsClock.textContent = timeStr;
    const webClock = document.getElementById('webClock');
    if (webClock) webClock.textContent = timeStr;
  };
  updateClock();
  setInterval(updateClock, 1000);

  // Nút Fullscreen Toggle
  const btnFs = document.getElementById('btnFullscreenToggle');
  if (btnFs) {
    btnFs.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  // Phát theo loại báo thức
  if (alarm.type === 'website') {
    // Chế độ MỞ WEBSITE: Chuyển hướng trực tiếp sang website ngay lập tức!
    let finalUrl = (alarm.websiteUrl || 'https://vnexpress.net').trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
    
    // Mở luôn trang web thay vì chờ người dùng bấm nút
    window.location.replace(finalUrl);
    return;
  } else if (alarm.type === 'tts') {
    // Chế độ GIỌNG ĐỌC TTS: 1. Nam Azure (mặc định) • 2. Nữ Azure • 3. Mặc định trình duyệt
    document.getElementById('ttsLayer').style.display = 'block';
    document.getElementById('ttsTitle').textContent = alarm.title || 'Lời nhắc bằng giọng đọc';
    document.getElementById('ttsText').textContent = `"${alarm.ttsText || 'Đã đến giờ báo thức rồi!'}"`;

    let vType = alarm.ttsVoiceType;
    if (!vType) {
      vType = alarm.voiceGender === 'female' ? 'azure_female' : 'azure_male';
    }

    let icon = '👨';
    let badge = 'Nam của Azure (Mặc định)';
    let badgeBg = '#1d4ed8';

    if (vType === 'azure_female') {
      icon = '👩';
      badge = 'Nữ của Azure';
      badgeBg = '#7c3aed';
    } else if (vType === 'browser_default') {
      icon = '🌐';
      badge = 'Mặc định trình duyệt';
      badgeBg = '#059669';
    }

    document.getElementById('ttsGenderIcon').textContent = icon;
    document.getElementById('ttsGenderBadge').textContent = badge;
    document.getElementById('ttsGenderBadge').style.background = badgeBg;

    updateTtsStatus();
    startTtsLoop(alarm.ttsText, vType, alarm.voiceSpeed || 1, alarm.authToken || '');
  } else {
    // Chế độ YouTube: Mở full màn hình 100% không cuộn
    document.getElementById('ytLayer').style.display = 'block';
    const vid = alarm.vid || 'fuXfT4Rv_WM';
    const iframe = document.getElementById('ytIframe');

    iframe.src = `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&mute=0&loop=1&playlist=${vid}&enablejsapi=1&origin=https%3A%2F%2Fwww.youtube.com&widget_referrer=https%3A%2F%2Fwww.youtube.com`;

    const directBtn = document.getElementById('btnDirectYt');
    if (directBtn) {
      directBtn.style.display = 'inline-block';
      directBtn.href = `https://www.youtube.com/watch?v=${vid}`;
    }
  }

  // Nút Tắt và Báo lại
  document.getElementById('btnStop').addEventListener('click', () => {
    stopAllAudio();
    window.close();
  });

  document.getElementById('btnSnooze').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'SNOOZE_ALARM', alarmId: alarm.id, minutes: 5 });
    stopAllAudio();
    window.close();
  });
});

function playChimeSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.3);
  } catch (e) {}
}

function updateTtsStatus() {
  const el = document.getElementById('ttsRepeatStatus');
  if (el) {
    if (maxRepeats === 0) {
      el.textContent = `Đang lặp lại lần thứ ${currentRepeat} (Lặp vô tận)`;
    } else {
      el.textContent = `Đang lặp lại: ${currentRepeat} / ${maxRepeats} lần`;
    }
  }
}

function stopAllAudio() {
  isLooping = false;
  if (chimeInterval) {
    clearInterval(chimeInterval);
    chimeInterval = null;
  }
  if (typeof stopSpeaking === 'function') {
    stopSpeaking();
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function startTtsLoop(text, voiceType, speed, authToken) {
  currentRepeat = 1;
  playOneTtsIteration(text, voiceType, speed, authToken);
}

function playOneTtsIteration(text, voiceType, speed, authToken) {
  if (!isLooping && currentRepeat > 1) return;
  updateTtsStatus();

  const cleanedText = (text || 'Chào bạn, đã đến giờ hẹn rồi!').trim();
  speakTTS(cleanedText, voiceType, speed || 1, authToken || '', () => {
    onIterationFinished(text, voiceType, speed, authToken);
  });
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
