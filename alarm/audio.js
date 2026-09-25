/**
 * audio.js - Trình phát âm thanh Azure TTS & Mặc định trình duyệt
 * 1. Nam của Azure (mặc định): vi-VN-NamMinhNeural
 * 2. Nữ của Azure: vi-VN-HoaiMyNeural
 * 3. Mặc định trình duyệt: Web Speech API (window.speechSynthesis)
 * 
 * Sử dụng API Azure TTS theo định dạng:
 * const url = `https://hsk-gilt.vercel.app/api/tts?text=${encodeURIComponent(text)}&lang=${lang}&voice=${voice}&rate=${rate}&token=${encodeURIComponent(authToken)}`;
 */

let currentAudio = null;

function stopSpeaking() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {}
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
}

/**
 * Phát giọng đọc hỗ trợ 3 tùy chọn:
 * 1. Nam của Azure (mặc định)
 * 2. Nữ của Azure
 * 3. Mặc định trình duyệt
 * 
 * @param {string} text - Văn bản cần đọc
 * @param {string} voiceType - 'azure_male' (mặc định) | 'azure_female' | 'browser_default'
 * @param {number} rate - Tốc độ đọc (mặc định 1)
 * @param {string} authToken - Token xác thực cho API Azure TTS
 * @param {Function} onEnd - Callback khi phát xong
 */
function speakTTS(text, voiceType = 'azure_male', rate = 1, authToken = '', onEnd = null) {
  stopSpeaking();
  if (!text || !text.trim()) {
    if (onEnd) onEnd();
    return;
  }

  // Chuẩn hóa loại giọng đọc (tương thích ngược với 'male' / 'female')
  let effectiveType = voiceType;
  if (effectiveType === 'male') effectiveType = 'azure_male';
  if (effectiveType === 'female') effectiveType = 'azure_female';
  if (!effectiveType) effectiveType = 'azure_male';

  // 3. Mặc định trình duyệt
  if (effectiveType === 'browser_default') {
    speakBrowserDefault(text, rate, onEnd);
    return;
  }

  // 1 & 2: Sử dụng Azure TTS (Nam của Azure mặc định hoặc Nữ của Azure)
  const lang = 'vi-VN';
  const voice = effectiveType === 'azure_female' ? 'vi-VN-HoaiMyNeural' : 'vi-VN-NamMinhNeural';
  const token = authToken || (typeof localStorage !== 'undefined' ? (localStorage.getItem('gsheet_auth_token') || '') : '');
  const effectiveRate = rate || 1;

  // Gọi đúng cú pháp URL API theo yêu cầu:
  const url = `https://hsk-gilt.vercel.app/api/tts?text=${encodeURIComponent(text.trim())}&lang=${lang}&voice=${voice}&rate=${effectiveRate}&token=${encodeURIComponent(token)}`;

  const audio = new Audio();
  currentAudio = audio;

  let ended = false;
  const finish = () => {
    if (!ended) {
      ended = true;
      currentAudio = null;
      if (onEnd) onEnd();
    }
  };

  audio.onended = finish;
  audio.onerror = (e) => {
    console.warn('Azure TTS audio playback failed (check token or network). Falling back to browser default voice.', e);
    currentAudio = null;
    speakBrowserDefault(text, rate, onEnd);
  };

  audio.src = url;
  audio.play().catch((err) => {
    console.warn('Azure TTS audio.play() failed. Falling back to browser default voice.', err);
    currentAudio = null;
    speakBrowserDefault(text, rate, onEnd);
  });
}

function speakBrowserDefault(text, rate = 1, onEnd = null) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = 'vi-VN';
      utterance.rate = rate || 1;

      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find(v => v.lang.includes('vi') || v.name.toLowerCase().includes('vietnam'));
      if (viVoice) utterance.voice = viVoice;

      utterance.onend = () => { if (onEnd) onEnd(); };
      utterance.onerror = () => { if (onEnd) onEnd(); };
      window.speechSynthesis.speak(utterance);
      return;
    } catch (e) {
      console.warn('SpeechSynthesis error:', e);
    }
  }
  if (onEnd) onEnd();
}
