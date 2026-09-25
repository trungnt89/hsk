// Service Worker Manifest V3 - Smart Alarm Engine v2.1
const ALARMS_STORAGE_KEY = 'smart_alarms_v2_light';
const ASSISTIVE_STORAGE_KEY = 'assistive_enabled';

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
    } catch (e) {
      console.warn('[Alarm Extension] dynamic rules setup notice:', e);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setupYouTubeRefererRules();
  scheduleAllAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  setupYouTubeRefererRules();
  scheduleAllAlarms();
});

function openWebsiteDirectly(rawUrl) {
  let finalUrl = (rawUrl || 'https://vnexpress.net').trim();
  if (!/^https?:\/\//i.test(finalUrl)) {
    finalUrl = 'https://' + finalUrl;
  }
  if (typeof chrome !== 'undefined') {
    if (chrome.windows && chrome.windows.getAll) {
      chrome.windows.getAll({ populate: false }, (windows) => {
        if (!windows || windows.length === 0) {
          chrome.windows.create({
            url: finalUrl,
            focused: true,
            state: 'maximized'
          });
        } else {
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

async function scheduleAllAlarms() {
  await chrome.alarms.clearAll();
  const data = await chrome.storage.local.get(ALARMS_STORAGE_KEY);
  let alarms = data[ALARMS_STORAGE_KEY] || [];
  
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

    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    chrome.alarms.create(alarm.id, {
      when: target.getTime(),
      periodInMinutes: 1440
    });
  });
}

chrome.alarms.onAlarm.addListener(async (alarmInfo) => {
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
    const days = (matched.daysOfWeek && Array.isArray(matched.daysOfWeek) && matched.daysOfWeek.length > 0)
      ? matched.daysOfWeek
      : [0, 1, 2, 3, 4, 5, 6];

    const currentDay = new Date().getDay();
    if (!days.includes(currentDay)) {
      return;
    }

    if (matched.type === 'website' && matched.websiteUrl) {
      openWebsiteDirectly(matched.websiteUrl);
      chrome.notifications.create(alarmInfo.name, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '🌐 ĐÃ MỞ WEBSITE THEO HẸN!',
        message: `${matched.title || 'Mốc báo thức'} (${matched.time})\nĐã mở: ${matched.websiteUrl}`,
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

    chrome.notifications.create(alarmInfo.name, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '⏰ BÁO THỨC ĐANG REO!',
      message: `${matched.title || 'Mốc báo thức'} (${matched.time})\n${actionNotice}`,
      priority: 2,
      requireInteraction: true
    });

    openRingTab(matched, false);
  }
});

function openRingTab(alarmOrId, isSnooze = false) {
  let query = '';
  if (alarmOrId && typeof alarmOrId === 'object') {
    const p = new URLSearchParams();
    if (alarmOrId.id) p.set('id', alarmOrId.id);
    if (alarmOrId.type) p.set('type', alarmOrId.type);
    if (alarmOrId.title) p.set('title', alarmOrId.title);
    if (alarmOrId.vid) p.set('vid', alarmOrId.vid);
    if (alarmOrId.youtubeUrl) p.set('youtubeUrl', alarmOrId.youtubeUrl);
    if (alarmOrId.ttsText) p.set('ttsText', alarmOrId.ttsText);
    if (alarmOrId.ttsVoiceType) p.set('ttsVoiceType', alarmOrId.ttsVoiceType);
    if (alarmOrId.voiceGender) p.set('voiceGender', alarmOrId.voiceGender);
    if (alarmOrId.voiceSpeed) p.set('voiceSpeed', String(alarmOrId.voiceSpeed));
    if (alarmOrId.repeatCount !== undefined) p.set('repeatCount', String(alarmOrId.repeatCount));
    if (alarmOrId.loop !== undefined) p.set('loop', String(alarmOrId.loop));
    if (isSnooze) p.set('snooze', '1');
    query = p.toString();
  } else {
    query = `id=${encodeURIComponent(alarmOrId || '')}${isSnooze ? '&snooze=1' : ''}`;
  }

  const ringUrl = chrome.runtime.getURL(`ring.html?${query}`);
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
      const matched = alarms.find(a => a.id === message.alarmId) || message.alarmData;
      if (matched && matched.type === 'website' && matched.websiteUrl) {
        openWebsiteDirectly(matched.websiteUrl);
        sendResponse({ success: true, openedUrl: matched.websiteUrl });
      } else if (matched) {
        openRingTab(matched, false);
        sendResponse({ success: true });
      } else {
        openRingTab(message.alarmId, false);
        sendResponse({ success: true });
      }
    });
    return true;
  }
});
