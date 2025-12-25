/* ================= CONFIG ================= */
const PAGE_SIZE = 10;
const BASE_DELAY = 1200;

/* ================= STATE ================= */
let currentPage = Number(localStorage.getItem("hsk_page")) || 0;
let isShuffle = localStorage.getItem("hsk_shuffle") === "1";
let ttsEngine = "browser";
let audioUnlocked = false;
let isPlaying = false;
let currentIndex = 0;
let playQueue = [];

/* ================= DOM ================= */
const listEl = document.getElementById("wordList");
const pageInfo = document.getElementById("pageInfo");
const googleAudio = document.getElementById("googleAudio");
const azureAudio = new Audio();

const shuffleBtn = document.getElementById("shuffleBtn");
const browserBtn = document.getElementById("browserBtn");
const googleBtn = document.getElementById("googleBtn");
const azureBtn = document.getElementById("azureBtn");

/* ================= INDEXED DB ================= */
const DB_NAME = "tts_cache_db";
const STORE_NAME = "audio";
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = () => {
      db = req.result;
      resolve(db);
    };

    req.onerror = () => reject(req.error);
  });
}

function getAudioFromDB(key) {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

function saveAudioToDB(key, blob) {
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(blob, key);
}

/* ================= UTILS ================= */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function getTotalPages() {
  return Math.ceil(WORDS.length / PAGE_SIZE);
}

/* ================= DATA ================= */
function prepareQueue() {
  const start = currentPage * PAGE_SIZE;
  playQueue = WORDS.slice(start, start + PAGE_SIZE);
  if (isShuffle) shuffleArray(playQueue);
}

/* ================= UI ================= */
function render() {
  listEl.innerHTML = "";
  playQueue.forEach((w, i) => {
    const div = document.createElement("div");
    div.className = "word-item";
    div.innerHTML = `
      <div>
        <div class="word-main">${w.hanzi}</div>
        <div class="word-sub">${w.pinyin} – ${w.vi}</div>
      </div>
      <button onclick="speakSingle(${i})">▶</button>
    `;
    listEl.appendChild(div);
  });

  pageInfo.textContent = `Trang ${currentPage + 1} / ${getTotalPages()}`;
  shuffleBtn.classList.toggle("active", isShuffle);
}

function highlight(i) {
  document.querySelectorAll(".word-item").forEach((el, idx) => {
    el.classList.toggle("active", idx === i);
    if (idx === i) el.scrollIntoView({ block: "center" });
  });
}

/* ================= AUDIO ================= */
function unlockAudio() {
  audioUnlocked = true;
  alert("Âm thanh đã kích hoạt");
}

function setTts(type) {
  ttsEngine = type;

  browserBtn.classList.toggle("active", type === "browser");
  googleBtn.classList.toggle("active", type === "google");
  azureBtn.classList.toggle("active", type === "azure");

  stopAuto();
}

function playBlob(blob) {
  const url = URL.createObjectURL(blob);
  azureAudio.pause();
  azureAudio.currentTime = 0;
  azureAudio.src = url;
  azureAudio.play();
}

async function speak(text) {
  if (!audioUnlocked) return;

  /* ===== Browser ===== */
  if (ttsEngine === "browser") {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    speechSynthesis.speak(u);
    return;
  }

  /* ===== Google ===== */
  if (ttsEngine === "google") {
    googleAudio.pause();
    googleAudio.currentTime = 0;
    googleAudio.src =
      "https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=zh-CN&q=" +
      encodeURIComponent(text);
    googleAudio.play();
    return;
  }

  /* ===== Azure + IndexedDB ===== */
  if (ttsEngine === "azure") {
    if (!db) return alert("DB chưa sẵn sàng");

    const cacheKey = `zh-CN-XiaoxiaoNeural_${text}`;
    const cached = await getAudioFromDB(cacheKey);

    if (cached) {
      console.log("🔊 IndexedDB");
      playBlob(cached);
      return;
    }

    console.log("☁️ Azure fetch");
    const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}`);
    if (!res.ok) return alert("Azure TTS lỗi");

    const buffer = await res.arrayBuffer();
    const blob = new Blob([buffer], { type: "audio/mpeg" });

    saveAudioToDB(cacheKey, blob);
    playBlob(blob);
  }
}

/* ================= ACTION ================= */
function speakSingle(i) {
  highlight(i);
  speak(playQueue[i].hanzi);
}

function startAuto() {
  if (!audioUnlocked) return alert("Chưa kích hoạt âm thanh");
  isPlaying = true;
  currentIndex = 0;
  autoNext();
}

function autoNext() {
  if (!isPlaying) return;

  if (currentIndex >= playQueue.length) {
    currentIndex = 0;
    if (isShuffle) {
      shuffleArray(playQueue);
      render();
    }
  }

  highlight(currentIndex);
  speak(playQueue[currentIndex].hanzi);

  const delay = BASE_DELAY + playQueue[currentIndex].hanzi.length * 300;
  setTimeout(() => {
    currentIndex++;
    autoNext();
  }, delay);
}

function stopAuto() {
  isPlaying = false;
  speechSynthesis.cancel();
  googleAudio.pause();
  azureAudio.pause();
}

/* ================= PAGINATION ================= */
function nextPage() {
  if (currentPage < getTotalPages() - 1) {
    currentPage++;
    localStorage.setItem("hsk_page", currentPage);
    stopAuto();
    prepareQueue();
    render();
  }
}

function prevPage() {
  if (currentPage > 0) {
    currentPage--;
    localStorage.setItem("hsk_page", currentPage);
    stopAuto();
    prepareQueue();
    render();
  }
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  localStorage.setItem("hsk_shuffle", isShuffle ? "1" : "0");
  stopAuto();
  prepareQueue();
  render();
}

/* ================= INIT ================= */
prepareQueue();
render();
openDB().then(() => console.log("IndexedDB ready"));
