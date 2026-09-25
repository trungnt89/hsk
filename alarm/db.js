/**
 * db.js - Quản lý IndexedDB SmartAlarmDB cho Chrome Extension
 */
const IDB_NAME = 'SmartAlarmDB';
const IDB_VERSION = 1;
const STORE_ALARMS = 'alarms';
const STORE_SETTINGS = 'settings';

const DEFAULT_SAMPLES = [
  {
    id: 'seed-1',
    time: '07:00',
    type: 'youtube',
    title: '☀️ Thức Dậy & Chào Ngày Mới (Nhạc Tươi Vui)',
    youtubeUrl: 'https://www.youtube.com/watch?v=fuXfT4Rv_WM',
    vid: 'fuXfT4Rv_WM',
    enabled: true,
    loop: true,
    repeatCount: 10,
  },
  {
    id: 'seed-2',
    time: '08:30',
    type: 'tts',
    title: '💧 Nhắc Uống Nước & Bắt Đầu Làm Việc (Giọng Nữ)',
    ttsText: 'Chào bạn! Đã 8 giờ 30 phút rồi. Hãy uống một cốc nước đầy và bắt đầu làm việc thật tập trung nhé!',
    voiceGender: 'female',
    voiceName: 'vi-VN-HoaiMyNeural',
    voicePitch: 1.1,
    voiceSpeed: 0.95,
    enabled: true,
    loop: false,
    repeatCount: 5,
  },
  {
    id: 'seed-3',
    time: '09:00',
    type: 'website',
    title: '🌐 Mở Bảng Kế Hoạch Công Việc Trello / Notion',
    websiteUrl: 'https://trello.com',
    openMode: 'new_tab',
    enabled: true,
    loop: false,
    repeatCount: 1,
  },
  {
    id: 'seed-4',
    time: '12:00',
    type: 'tts',
    title: '🍱 Giờ Ăn Trưa & Nghỉ Ngơi (Giọng Nam)',
    ttsText: 'Đã 12 giờ trưa rồi! Tạm gác công việc lại để ăn trưa, đi lại thư giãn và nạp năng lượng nào anh bạn.',
    voiceGender: 'male',
    voiceName: 'vi-VN-NamMinhNeural',
    voicePitch: 0.8,
    voiceSpeed: 0.95,
    enabled: false,
    loop: false,
    repeatCount: 3,
  },
  {
    id: 'seed-5',
    time: '17:30',
    type: 'website',
    title: '📰 Đọc Tin Tức Chiều (VnExpress)',
    websiteUrl: 'https://vnexpress.net',
    openMode: 'new_tab',
    enabled: false,
    loop: false,
    repeatCount: 1,
  }
];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_ALARMS)) {
        db.createObjectStore(STORE_ALARMS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function getAllAlarms() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ALARMS, 'readonly');
      const req = tx.objectStore(STORE_ALARMS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get('smart_alarms_v2_light');
      return data['smart_alarms_v2_light'] || [];
    }
    return [];
  }
}

async function saveAlarm(alarm) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ALARMS, 'readwrite');
    const req = tx.objectStore(STORE_ALARMS).put(alarm);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteAlarm(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ALARMS, 'readwrite');
    const req = tx.objectStore(STORE_ALARMS).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function bulkSaveAlarms(alarms) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ALARMS, 'readwrite');
    const store = tx.objectStore(STORE_ALARMS);
    alarms.forEach(a => store.put(a));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearAllAlarms() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ALARMS, 'readwrite');
    const req = tx.objectStore(STORE_ALARMS).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
