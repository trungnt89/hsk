// Google Sheet API Cloud Sync Helper for Chrome Extension
const URL_VERCEL_API = 'https://hsk-gilt.vercel.app/api/gSheet';
const SPREAD_ALARM = '1HNJrXP3JzAwH6AdDHKVSBv1izYSPCu8nksb1BFdNDuc';
let SHEET_ALARM = 'Sheet1';

async function getStoredAuthToken() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get('gsheet_auth_token');
      if (data && data.gsheet_auth_token) return data.gsheet_auth_token.trim();
    }
  } catch (e) {}

  try {
    const val = localStorage.getItem('gsheet_auth_token');
    if (val) return val.trim();
  } catch (e) {}

  return '';
}

async function setStoredAuthToken(token) {
  const trimmed = (token || '').trim();
  try {
    localStorage.setItem('gsheet_auth_token', trimmed);
  } catch (e) {}

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ 'gsheet_auth_token': trimmed });
    }
  } catch (e) {}
}

async function callAPI(params) {
  const token = await getStoredAuthToken();
  if (!token) {
    throw new Error('Chưa thiết lập Token Authorization. Vui lòng nhập Token và bấm "Lưu Token" trong phần Cài Đặt!');
  }

  const res = await fetch(URL_VERCEL_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authorization': token
    },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Google Sheet API lỗi (${res.status}): ${txt || res.statusText}`);
  }
  return await res.json();
}

function createRowData(alarm) {
  const days = alarm.daysOfWeek && Array.isArray(alarm.daysOfWeek) && alarm.daysOfWeek.length > 0
    ? alarm.daysOfWeek
    : [0, 1, 2, 3, 4, 5, 6];

  return [
    alarm.id || ('alarm_' + Date.now()),
    alarm.time || '07:00',
    alarm.type || 'tts',
    alarm.title || '',
    alarm.youtubeUrl || '',
    alarm.vid || '',
    alarm.ttsText || '',
    alarm.language || 'vi-VN',
    alarm.enabled !== false,
    alarm.loop || false,
    alarm.websiteUrl || '',
    alarm.openMode || 'new_tab',
    alarm.ttsVoiceType || 'azure_male',
    alarm.voiceSpeed !== undefined ? Number(alarm.voiceSpeed) : 1.0,
    alarm.repeatCount !== undefined ? Number(alarm.repeatCount) : 1,
    JSON.stringify(days)
  ];
}

function rowToAlarm(row) {
  if (!row || !Array.isArray(row) || row.length === 0) return null;
  const idStr = String(row[0] || '').trim();
  if (!idStr || idStr.toLowerCase() === 'id' || idStr.toLowerCase() === 'id alarm') return null;

  let timeStr = String(row[1] || '07:00').trim();
  if (/^\d:\d\d$/.test(timeStr)) {
    timeStr = '0' + timeStr;
  }

  let days = [0, 1, 2, 3, 4, 5, 6];
  if (row[15]) {
    try {
      const parsed = typeof row[15] === 'string' ? JSON.parse(row[15]) : row[15];
      if (Array.isArray(parsed) && parsed.length > 0) {
        days = parsed.map(Number);
      }
    } catch {
      days = [0, 1, 2, 3, 4, 5, 6];
    }
  }

  const enabledVal = row[8];
  const isEnabled = enabledVal === true || enabledVal === 'TRUE' || enabledVal === 'true' || enabledVal === 1 || enabledVal === '1';

  const loopVal = row[9];
  const isLoop = loopVal === true || loopVal === 'TRUE' || loopVal === 'true' || loopVal === 1 || loopVal === '1';

  const rawType = String(row[2] || 'tts').toLowerCase();
  const type = (rawType === 'website' || rawType === 'youtube') ? rawType : 'tts';

  const rawVoiceType = String(row[12] || 'azure_male');
  const ttsVoiceType = (rawVoiceType === 'azure_female' || rawVoiceType === 'web_speech') ? rawVoiceType : 'azure_male';

  const rawOpenMode = String(row[11] || 'new_tab');
  const openMode = (rawOpenMode === 'active_tab' || rawOpenMode === 'new_window') ? rawOpenMode : 'new_tab';

  return {
    id: idStr,
    time: timeStr,
    type,
    title: String(row[3] || ''),
    youtubeUrl: row[4] ? String(row[4]) : undefined,
    vid: row[5] ? String(row[5]) : undefined,
    ttsText: row[6] ? String(row[6]) : undefined,
    language: row[7] ? String(row[7]) : 'vi-VN',
    enabled: isEnabled,
    loop: isLoop,
    websiteUrl: row[10] ? String(row[10]) : undefined,
    openMode,
    ttsVoiceType,
    voiceSpeed: row[13] !== undefined && row[13] !== '' ? Number(row[13]) : 1.0,
    repeatCount: row[14] !== undefined && row[14] !== '' ? Number(row[14]) : 1,
    daysOfWeek: days
  };
}

async function fetchAlarmsFromSheet() {
  const res = await callAPI({
    sheet: SHEET_ALARM,
    act: 'read',
    spread: SPREAD_ALARM
  });

  const values = res?.values || [];
  const alarms = [];

  for (const row of values) {
    const item = rowToAlarm(row);
    if (item) alarms.push(item);
  }

  return alarms;
}

async function addAlarmToSheet(alarm) {
  const rowData = createRowData(alarm);
  return await callAPI({
    act: 'add',
    sheet: SHEET_ALARM,
    spread: SPREAD_ALARM,
    data: JSON.stringify(rowData)
  });
}

async function updateAlarmInSheet(alarm) {
  const rowData = createRowData(alarm);
  return await callAPI({
    act: 'updateByPosVal',
    pos: 0,
    val: alarm.id,
    sheet: SHEET_ALARM,
    spread: SPREAD_ALARM,
    data: JSON.stringify(rowData)
  });
}

async function deleteAlarmFromSheet(id) {
  return await callAPI({
    act: 'deleteByPosVal',
    pos: 0,
    val: id,
    sheet: SHEET_ALARM,
    spread: SPREAD_ALARM
  });
}

async function pushAllAlarmsToSheet(alarmsList) {
  const res = await callAPI({
    sheet: SHEET_ALARM,
    act: 'read',
    spread: SPREAD_ALARM
  });

  const existingRows = res?.values || [];
  const existingIds = new Set();
  for (const row of existingRows) {
    if (row && row[0]) existingIds.add(String(row[0]).trim());
  }

  let count = 0;
  for (const alarm of alarmsList) {
    const rowData = createRowData(alarm);
    if (existingIds.has(alarm.id)) {
      await callAPI({
        act: 'updateByPosVal',
        pos: 0,
        val: alarm.id,
        sheet: SHEET_ALARM,
        spread: SPREAD_ALARM,
        data: JSON.stringify(rowData)
      });
    } else {
      await callAPI({
        act: 'add',
        sheet: SHEET_ALARM,
        spread: SPREAD_ALARM,
        data: JSON.stringify(rowData)
      });
    }
    count++;
  }
  return count;
}
