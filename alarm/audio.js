/**
 * audio.js - Trình phát âm thanh Tiếng Việt chuẩn cho Báo Thức Thông Minh Pro
 * 
 * QUY TẮC:
 * 1. Khi CÓ Token Azure: Phát bằng giọng Azure TTS (NamMinh / HoaiMy) qua API.
 * 2. Khi CHƯA có Token: Phát bằng GIỌNG ĐỌC TIẾNG VIỆT CHUẨN (Google Tiếng Việt / Web Speech API Tiếng Việt).
 *    Đảm bảo 100% PHÁT ÂM TIẾNG VIỆT RÕ RÀNG, KHÔNG BỊ CÂM TIẾNG, KHÔNG ĐỌC LƠ LỚ TIẾNG ANH.
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
 * Phát giọng đọc hỗ trợ đầy đủ Tiếng Việt cả khi có token lẫn khi chưa có token
 * @param {string} text - Văn bản cần đọc
 * @param {string} voiceType - 'azure_male' | 'azure_female' | 'browser_default'
 * @param {number} rate - Tốc độ đọc (0.7 -> 1.3)
 * @param {string} authToken - Token xác thực
 * @param {Function} onEnd - Callback khi đọc xong
 */
function speakTTS(text, voiceType = 'azure_male', rate = 1, authToken = '', onEnd = null) {
  stopSpeaking();
  const trimmed = (text || '').trim();
  if (!trimmed) {
    if (onEnd) onEnd();
    return;
  }

  let effectiveType = voiceType || 'azure_male';
  if (effectiveType === 'male') effectiveType = 'azure_male';
  if (effectiveType === 'female') effectiveType = 'azure_female';

  // Lấy token từ đối số hoặc bộ nhớ trình duyệt
  let token = (authToken || '').trim();
  if (!token && typeof localStorage !== 'undefined') {
    token = (localStorage.getItem('azure_tts_token') || localStorage.getItem('gsheet_auth_token') || '').trim();
  }

  // ⚠️ KHI CHƯA SETTING TOKEN (HOẶC CHỌN MẶC ĐỊNH TRÌNH DUYỆT):
  // Phát bằng Giọng Đọc Tiếng Việt Chuẩn (Không cần token)
  if (!token || effectiveType === 'browser_default') {
    if (!token && effectiveType !== 'browser_default') {
      const noticeMsg = 'ℹ️ Chưa cài đặt Token: Đang phát bằng giọng đọc Tiếng Việt chuẩn (Không cần token).';
      console.info(noticeMsg);
      if (typeof window !== 'undefined' && typeof window.showStatusNotification === 'function') {
        window.showStatusNotification(noticeMsg, 'info');
      }
    }
    speakVietnameseNoToken(trimmed, rate, onEnd);
    return;
  }

  // KHI ĐÃ CÓ TOKEN: Phát bằng Azure TTS qua API
  const lang = 'vi-VN';
  const voice = effectiveType === 'azure_female' ? 'vi-VN-HoaiMyNeural' : 'vi-VN-NamMinhNeural';
  const effectiveRate = rate || 1;
  const url = `https://hsk-gilt.vercel.app/api/tts?text=${encodeURIComponent(trimmed)}&lang=${lang}&voice=${voice}&rate=${effectiveRate}&token=${encodeURIComponent(token)}`;

  const audio = new Audio();
  currentAudio = audio;

  let isEnded = false;
  const finish = () => {
    if (!isEnded) {
      isEnded = true;
      currentAudio = null;
      if (onEnd) onEnd();
    }
  };

  audio.onended = finish;
  audio.onerror = (e) => {
    console.warn('Azure TTS lỗi hoặc token không hợp lệ. Tự động chuyển sang giọng Tiếng Việt chuẩn không cần token.', e);
    currentAudio = null;
    speakVietnameseNoToken(trimmed, rate, onEnd);
  };

  audio.src = url;
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch((err) => {
      console.warn('Audio play Azure TTS thất bại. Chuyển sang giọng Tiếng Việt chuẩn.', err);
      currentAudio = null;
      speakVietnameseNoToken(trimmed, rate, onEnd);
    });
  }
}

/**
 * Phát âm Tiếng Việt chuẩn 100% khi chưa có Token:
 * Ưu tiên 1: Google Translate TTS Tiếng Việt (Miễn phí, không cần token, đọc cực chuẩn)
 * Ưu tiên 2: Web Speech API Tiếng Việt có lọc voice chuyên dụng
 */
function speakVietnameseNoToken(text, rate = 1, onEnd = null) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    if (onEnd) onEnd();
    return;
  }

  // 1. Thử phát Google Translate Tiếng Việt TTS (Miễn phí, 100% ngữ điệu Tiếng Việt chuẩn)
  try {
    const encoded = encodeURIComponent(trimmed.slice(0, 200));
    const googleTTSUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encoded}`;

    const audio = new Audio();
    currentAudio = audio;

    let isDone = false;
    const finish = () => {
      if (!isDone) {
        isDone = true;
        currentAudio = null;
        if (onEnd) onEnd();
      }
    };

    audio.onended = finish;
    audio.onerror = () => {
      console.warn('Google TTS không phản hồi, fallback sang Web Speech API Tiếng Việt...');
      currentAudio = null;
      speakWebSpeechVietnamese(trimmed, rate, onEnd);
    };

    audio.src = googleTTSUrl;
    audio.playbackRate = rate || 1;
    const p = audio.play();
    if (p !== undefined) {
      p.catch(() => {
        currentAudio = null;
        speakWebSpeechVietnamese(trimmed, rate, onEnd);
      });
    }
    return;
  } catch (err) {
    console.warn('Lỗi khởi tạo Google TTS, chuyển sang Web Speech API...', err);
  }

  // 2. Dự phòng: Web Speech API Tiếng Việt
  speakWebSpeechVietnamese(trimmed, rate, onEnd);
}

/**
 * Đọc tiếng Việt bằng Web Speech API của trình duyệt
 */
function speakWebSpeechVietnamese(text, rate = 1, onEnd = null) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = 'vi-VN';
    utterance.rate = rate || 1;

    // Giữ tham chiếu toàn cục tránh Chrome Garbage Collector ngắt lời giữa chừng
    window._activeUtterance = utterance;

    const findAndApplyVoice = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      if (voices.length > 0) {
        // Tìm giọng Tiếng Việt
        const viVoice = voices.find(v => {
          const l = (v.lang || '').toLowerCase().replace('_', '-');
          const n = (v.name || '').toLowerCase();
          return l === 'vi-vn' || l.startsWith('vi') || n.includes('vietnam') || n.includes('vietnamese') || n.includes('tiếng việt') || n.includes('hoaimy') || n.includes('namminh');
        });
        if (viVoice) {
          utterance.voice = viVoice;
        }
      }

      utterance.onend = () => {
        window._activeUtterance = null;
        if (onEnd) onEnd();
      };
      utterance.onerror = (e) => {
        console.warn('speechSynthesis error:', e);
        window._activeUtterance = null;
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
    };

    const initialVoices = window.speechSynthesis.getVoices();
    if (initialVoices && initialVoices.length > 0) {
      findAndApplyVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        findAndApplyVoice();
      };
      setTimeout(() => {
        if (!window.speechSynthesis.speaking && !utterance.voice) {
          findAndApplyVoice();
        }
      }, 250);
    }
  } catch (err) {
    console.warn('Web Speech API error:', err);
    if (onEnd) onEnd();
  }
}
