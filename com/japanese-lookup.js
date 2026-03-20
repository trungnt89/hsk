/**
 * Japanese Lookup Module - Kanji Support Version
 * Chức năng: Tự động trích xuất Romaji từ Kanji và dịch nghĩa.
 */

const JapaneseLookup = (() => {
  // Thêm dt=rm để yêu cầu Google trả về Transliteration (Romaji cho Kanji)
  const TRANSLATE_API = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&dt=rm&q=";
  
  const style = document.createElement('style');
  style.textContent = `
    .ja-lookup-popup {
      position: absolute; z-index: 10000; background: #fff; border: 2px solid #2563eb;
      border-radius: 12px; padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);
      font-family: system-ui, -apple-system, sans-serif; max-width: 280px;
      pointer-events: none; line-height: 1.4;
    }
    .ja-lookup-word { color: #1e40af; font-weight: bold; font-size: 1.25em; display: block; margin-bottom: 2px; }
    .ja-lookup-romaji { color: #64748b; font-size: 0.95em; font-style: italic; display: block; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
    .ja-lookup-meaning { color: #0f172a; font-size: 1em; font-weight: 500; }
  `;
  document.head.appendChild(style);

  let popup = null;

  function createPopup() {
    if (popup) return;
    popup = document.createElement('div');
    popup.className = 'ja-lookup-popup';
    popup.style.display = 'none';
    document.body.appendChild(popup);
  }

  function isJapanese(text) {
    return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
  }

  async function lookup(text, x, y) {
    if (!text || !isJapanese(text)) return;

    createPopup();
    popup.innerHTML = `<div class="ja-lookup-meaning">⌛ Đang tra Kanji...</div>`;
    popup.style.left = `${x}px`;
    popup.style.top = `${y + 25}px`;
    popup.style.display = 'block';

    try {
      const res = await fetch(TRANSLATE_API + encodeURIComponent(text));
      const data = await res.json();
      
      const meaning = data[0][0][0];
      let romaji = "";

      // Thuật toán quét mảng: Tìm kiếm chuỗi Romaji trong cấu trúc đa tầng của Google
      if (data[0]) {
        for (let i = 0; i < data[0].length; i++) {
          // Google thường để Romaji ở index 3 hoặc 2 của các mảng con cuối cùng
          if (data[0][i][3]) {
            romaji = data[0][i][3];
            break;
          }
        }
      }

      popup.innerHTML = `
        <span class="ja-lookup-word">${text}</span>
        <span class="ja-lookup-romaji">${romaji ? `[ ${romaji} ]` : '[ Không có cách đọc ]'}</span>
        <div class="ja-lookup-meaning">🇻🇳 ${meaning}</div>
      `;
    } catch (e) {
      popup.innerHTML = `<div class="ja-lookup-meaning">❌ Lỗi kết nối</div>`;
    }
  }

  function init() {
    document.addEventListener('mouseup', (e) => {
      let selectedText = window.getSelection().toString().trim();
      if (selectedText && isJapanese(selectedText)) {
        lookup(selectedText, e.pageX, e.pageY);
      } else {
        if (popup) popup.style.display = 'none';
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (popup && e.target !== popup) popup.style.display = 'none';
    });
  }

  return { init };
})();

JapaneseLookup.init();
export default JapaneseLookup;