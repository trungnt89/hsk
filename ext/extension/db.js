/**
 * db.js - Quản lý IndexedDB SmartAlarmDB cho Chrome Extension
 */
const IDB_NAME = 'SmartAlarmDB';
const IDB_VERSION = 1;
const STORE_ALARMS = 'alarms';
const STORE_SETTINGS = 'settings';

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
