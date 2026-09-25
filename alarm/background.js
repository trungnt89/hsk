// Service Worker Manifest V3 - Smart Alarm Engine v2.0
const ALARMS_STORAGE_KEY = 'smart_alarms_v2_light';

// Thiết lập DeclarativeNetRequest để sửa triệt để lỗi 153 của YouTube Iframe trong Chrome Extension
async function setupYouTubeRefererRules() {
  if (typeof chrome !== 'undefined' && chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateDynamicRules) {
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1001, 1002],
        addRules: [
          {
            id: 1001,
            priority: 2,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [
                { header: 'Referer', operation: 'set', value: 'https://www.youtube.com/' },
                { header: 'Origin', operation: 'set', value: 'https://www.youtube.com' }
              ]
            },
            condition: {
              urlFilter: '||youtube.com',
              resourceTypes: ['sub_frame', 'xmlhttprequest', 'media', 'other']
            }
          },
          {
            id: 1002,
            priority: 2,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [
                { header: 'Referer', operation: 'set', value: 'https://www.youtube-nocookie.com/' },
                { header: 'Origin', operation: 'set', value: 'https://www.youtube-nocookie.com' }
              ]
            },
            condition: {
              urlFilter: '||youtube-nocookie.com',
              resourceTypes: ['sub_frame', 'xmlhttprequest', 'media', 'other']
            }
          }
        ]
      });
      console.log('[Alarm Extension] Đã cấu hình DeclarativeNetRequest dynamic rules chống lỗi YouTube 153.');
    } catch (e) {
      console.warn('[Alarm Extension] dynamic rules setup notice:', e);
    }
  }
}

// Khởi tạo khi extension được cài đặt hoặc bật
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Alarm Extension] Extension đã được cài đặt thành công với icon đồng hồ báo thức.');
  setupYouTubeRefererRules();
  scheduleAllAlarms();
});

// Chạy lại kiểm tra khi trình duyệt khởi động
chrome.runtime.onStartup.addListener(() => {
  setupYouTubeRefererRules();
  scheduleAllAlarms();
});

// Hàm mở trực tiếp đường link website đã cài đặt (Hỗ trợ chạy ngầm khi đóng toàn bộ Chrome)
function openWebsiteDirectly(rawUrl) {
  let finalUrl = (rawUrl || 'https://vnexpress.net').trim();
  if (!/^https?:\/\//i.test(finalUrl)) {
    finalUrl = 'https://' + finalUrl;
  }
  console.log('[Alarm Extension] Đang mở ngay trang web đã setting:', finalUrl);
  if (typeof chrome !== 'undefined') {
    if (chrome.windows && chrome.windows.getAll) {
      chrome.windows.getAll({ populate: false }, (windows) => {
        if (!windows || windows.length === 0) {
          // Khi người dùng đã bấm X tắt toàn bộ cửa sổ Chrome -> Mở cửa sổ trình duyệt mới
          chrome.windows.create({
            url: finalUrl,
            focused: true,
            state: 'maximized'
          });
        } else {
          // Có sẵn cửa sổ Chrome -> Mở tab mới và đưa lên tiêu điểm
          chrome.tabs.create({ url: finalUrl, active: true }, (tab) => {
            if (tab && tab.windowId && chrome.windows.update) {
              chrome.windows.update(tab.windowId, { focused: true });
            }
          });
        }
      });
    } else if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: finalUrl, active: true });
    }
  }
}

// Đồng bộ lịch báo thức vào chrome.alarms
async function scheduleAllAlarms() {
  await chrome.alarms.clearAll();
  const data = await chrome.storage.local.get(ALARMS_STORAGE_KEY);
  let alarms = data[ALARMS_STORAGE_KEY] || [];
  
  // Mặc định setting tất cả các ngày trong tuần với các alert cũ chưa được setting ngày trong tuần
  let hasUpdate = false;
  alarms = alarms.map(a => {
    if (!a.daysOfWeek || !Array.isArray(a.daysOfWeek) || a.daysOfWeek.length === 0) {
      a.daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
      hasUpdate = true;
    }
    return a;
  });
  if (hasUpdate) {
    await chrome.storage.local.set({ [ALARMS_STORAGE_KEY]: alarms });
  }

  const now = new Date();

  alarms.forEach(alarm => {
    if (!alarm.enabled) return;

    const [hours, minutes] = alarm.time.split(':').map(Number);
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    // Nếu thời gian hôm nay đã qua, đặt sang ngày mai
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    const when = target.getTime();
    chrome.alarms.create(alarm.id, {
      when: when,
      periodInMinutes: 1440 // Lặp lại hàng ngày (24h)
    });

    console.log(`[Alarm Extension] Đã lên lịch mốc ${alarm.time} (${alarm.title}) vào lúc: `, target.toLocaleString());
  });
}

// Bắt sự kiện khi đến giờ reo chuông
chrome.alarms.onAlarm.addListener(async (alarmInfo) => {
  console.log('[Alarm Extension] Chuông reo: ', alarmInfo.name);

  // Nếu là chuông báo lại (snooze)
  if (alarmInfo.name.startsWith('snooze_')) {
    const originalId = alarmInfo.name.replace('snooze_', '');
    const data = await chrome.storage.local.get(ALARMS_STORAGE_KEY);
    const alarms = data[ALARMS_STORAGE_KEY] || [];
    const matched = alarms.find(a => a.id === originalId);
    if (matched && matched.type === 'website' && matched.websiteUrl) {
      openWebsiteDirectly(matched.websiteUrl);
      return;
    }
    openRingTab(originalId, true);
    return;
  }

  const data = await chrome.storage.local.get(ALARMS_STORAGE_KEY);
  const alarms = data[ALARMS_STORAGE_KEY] || [];
  const matched = alarms.find(a => a.id === alarmInfo.name);

  if (matched && matched.enabled) {
    // Mặc định setting tất cả các ngày trong tuần với các alert cũ chưa được setting ngày trong tuần
    const days = (matched.daysOfWeek && Array.isArray(matched.daysOfWeek) && matched.daysOfWeek.length > 0)
      ? matched.daysOfWeek
      : [0, 1, 2, 3, 4, 5, 6];

    const currentDay = new Date().getDay();
    if (!days.includes(currentDay)) {
      console.log(`[Alarm Extension] Bỏ qua vì ngày hôm nay (${currentDay}) không khớp daysOfWeek:`, days);
      return;
    }

    // 🌐 TRƯỜNG HỢP MỞ LINK WEBSITE: Mở luôn trang web có đường link ngay lập tức thay vì chỉ hiển thị thông báo!
    if (matched.type === 'website' && matched.websiteUrl) {
      openWebsiteDirectly(matched.websiteUrl);

      // Thông báo nhẹ không chặn màn hình
      chrome.notifications.create(alarmInfo.name, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '🌐 ĐÃ MỞ WEBSITE THEO HẸN!',
        message: `${matched.title || 'Mốc báo thức'} (${matched.time})\nĐã mở ngay: ${matched.websiteUrl}`,
        priority: 2
      });
      return;
    }

    let actionNotice = 'Đã đến giờ hẹn!';
    if (matched.type === 'tts') {
      const g = matched.voiceGender === 'male' ? 'Giọng Nam 👨' : 'Giọng Nữ 👩';
      actionNotice = `🗣️ Lời nhắc (${g}): ${matched.ttsText ? matched.ttsText.slice(0, 50) + '...' : ''}`;
    } else {
      actionNotice = `🎬 Phát nhạc/video YouTube`;
    }

    // 1. Hiển thị thông báo Chrome Notification với icon đồng hồ báo thức
    chrome.notifications.create(alarmInfo.name, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '⏰ BÁO THỨC ĐANG REO!',
      message: `${matched.title || 'Mốc báo thức'} (${matched.time})\n${actionNotice}`,
      priority: 2,
      requireInteraction: true
    });

    // 2. Mở tab chuông báo thức toàn màn hình (YouTube hoặc TTS giọng Nam/Nữ)
    openRingTab(matched.id, false);
  }
});

// Mở trang reo chuông độc lập ring.html
function openRingTab(alarmId, isSnooze = false) {
  const ringUrl = chrome.runtime.getURL(`ring.html?id=${encodeURIComponent(alarmId)}${isSnooze ? '&snooze=1' : ''}`);
  if (typeof chrome !== 'undefined' && chrome.windows && chrome.windows.create) {
    chrome.windows.create({
      url: ringUrl,
      focused: true,
      state: 'fullscreen'
    }).catch(() => {
      chrome.tabs.create({ url: ringUrl, active: true });
    });
  } else {
    chrome.tabs.create({ url: ringUrl, active: true });
  }
}

// Lắng nghe tin nhắn từ Popup và Options
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'RESCHEDULE_ALARMS') {
    scheduleAllAlarms().then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.action === 'SNOOZE_ALARM') {
    const { alarmId, minutes } = message;
    const when = Date.now() + minutes * 60 * 1000;
    chrome.alarms.create('snooze_' + alarmId, { when });
    sendResponse({ success: true, when });
    return true;
  }

  if (message.action === 'TRIGGER_TEST') {
    chrome.storage.local.get(ALARMS_STORAGE_KEY).then(data => {
      const alarms = data[ALARMS_STORAGE_KEY] || [];
      const matched = alarms.find(a => a.id === message.alarmId);
      if (matched && matched.type === 'website' && matched.websiteUrl) {
        openWebsiteDirectly(matched.websiteUrl);
        sendResponse({ success: true, openedUrl: matched.websiteUrl });
      } else {
        openRingTab(message.alarmId);
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (message.action === 'OPEN_URL') {
    if (message.url) {
      openWebsiteDirectly(message.url);
      sendResponse({ success: true });
      return true;
    }
  }
});

