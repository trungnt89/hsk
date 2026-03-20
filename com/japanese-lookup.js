/**
 * Japanese Lookup Module - Cross-platform Version
 * Hỗ trợ: Desktop, iPhone (Safari/Chrome), Android.
 */

const JapaneseLookup = (() => {
  const TRANSLATE_API = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&dt=rm&q=";
  
  const style = document.createElement('style');
  style.textContent = `
    .ja-lookup-popup {
      position: absolute; z-index: 99999; background: #fff; border: 1px solid #2563eb;
      border-radius: 12px; padding: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      font-family: system-ui, -apple-system; max-width: 250px;
      pointer-events: auto; line-height: 1.4; font-weight: normal;
    }
    .ja-lookup-word { color: #1e40af; font-size: 1.2em; display: block; margin-bottom: 2px; }
    .ja-lookup-romaji { color: #64748b; font-size: 0.9em; font-style: italic; display: block; margin-bottom: 6px; }
    .ja-lookup-meaning { color: #0f172a; font-size: 1em; white-space: pre-wrap; }
    /* Đảm bảo text trong popup không bị bôi đen ngược lại */
    .ja-lookup-popup * { user-select: none; -webkit-user-select: none; }
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
    popup.innerHTML = `<div class="ja-lookup-meaning">⌛...</div>`;
    
    // Xử lý vị trí để không bị tràn màn hình mobile
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const posX = Math.min(x + scrollX, window.innerWidth - 260); 
    
    popup.style.left = `${posX}px`;
    popup.style.top = `${y + scrollY + 20}px`;
    popup.style.display = 'block';

    try {
      const res = await fetch(TRANSLATE_API + encodeURIComponent(text));
      const data = await res.json();
      
      const meaning = data[0][0][0];
      let romaji = "";
      if (data[0]) {
        for (let i = 0; i < data[0].length; i++) {
          if (data[0][i][3]) { romaji = data[0][i][3]; break; }
        }
      }

      popup.innerHTML = `
        <span class="ja-lookup-word">${text}</span>
        <span class="ja-lookup-romaji">${romaji ? `[ ${romaji} ]` : ''}</span>
        <div class="ja-lookup-meaning">🇻🇳 ${meaning}</div>
      `;
    } catch (e) {
      popup.style.display = 'none';
    }
  }

  function handleSelection(e) {
    // Đợi một chút để hệ thống cập nhật Selection trên iOS
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      if (selectedText && isJapanese(selectedText)) {
        // Lấy tọa độ điểm chạm hoặc chuột
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        lookup(selectedText, rect.left, rect.bottom);
      } else {
        if (popup) popup.style.display = 'none';
      }
    }, 100);
  }

  function init() {
    // Hỗ trợ cả Desktop (mouseup) và Mobile (touchend)
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);

    document.addEventListener('mousedown', (e) => {
      if (popup && !popup.contains(e.target)) popup.style.display = 'none';
    });
  }

  return { init };
})();

JapaneseLookup.init();
export default JapaneseLookup;