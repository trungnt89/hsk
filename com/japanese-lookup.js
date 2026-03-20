/**
 * Japanese Lookup Module (Updated: With Romaji Reading)
 * Chức năng: Click vào văn bản tiếng Nhật để hiện cách đọc (Romaji) và dịch.
 */

const JapaneseLookup = (() => {
  const TRANSLATE_API = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&q=";
  
  const style = document.createElement('style');
  style.textContent = `
    .ja-lookup-popup {
      position: absolute;
      z-index: 10000;
      background: #fff;
      border: 1px solid #2563eb;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 280px;
      pointer-events: none;
      line-height: 1.5;
    }
    .ja-lookup-reading { 
      color: #1e40af; 
      font-weight: bold; 
      font-size: 1.1em; 
      margin-bottom: 6px; 
      border-bottom: 1px dashed #cbd5e1; 
      padding-bottom: 6px; 
    }
    .ja-lookup-meaning { 
      color: #334155; 
      font-size: 0.95em; 
    }
  `;
  document.head.appendChild(style);

  let popup = null;

  function createPopup() {
    popup = document.createElement('div');
    popup.className = 'ja-lookup-popup';
    popup.style.display = 'none';
    document.body.appendChild(popup);
  }

  function isJapanese(text) {
    return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(text);
  }

  async function lookup(text, x, y) {
    if (!text || !isJapanese(text)) return;

    popup.innerHTML = `<div class="ja-lookup-meaning">🔍 Đang tra cứu...</div>`;
    popup.style.left = `${x}px`;
    popup.style.top = `${y + 20}px`;
    popup.style.display = 'block';
    popup.style.opacity = '1';

    try {
      const res = await fetch(TRANSLATE_API + encodeURIComponent(text));
      const data = await res.json();
      
      const translatedText = data[0][0][0];
      // Google API thường trả về Romaji ở data[0][1][3]
      const romaji = (data[0][1] && data[0][1][3]) ? data[0][1][3] : "";

      popup.innerHTML = `
        <div class="ja-lookup-reading">
          ${text} 
          ${romaji ? `<br><span style="font-weight:normal; color:#64748b; font-size:0.85em;">[ ${romaji} ]</span>` : ''}
        </div>
        <div class="ja-lookup-meaning">🇻🇳 ${translatedText}</div>
      `;
    } catch (e) {
      popup.innerHTML = `<div class="ja-lookup-meaning">❌ Lỗi kết nối</div>`;
    }
  }

  function init() {
    createPopup();

    document.addEventListener('click', (e) => {
      let selectedText = window.getSelection().toString().trim();
      
      // Nếu không bôi đen, cố gắng lấy từ dưới vị trí click
      if (!selectedText) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range) {
          range.expand('word');
          selectedText = range.toString().trim();
        }
      }

      if (selectedText && isJapanese(selectedText)) {
        lookup(selectedText, e.pageX, e.pageY);
      } else {
        popup.style.display = 'none';
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (popup && e.target !== popup) {
        popup.style.display = 'none';
      }
    });
  }

  return { init };
})();

JapaneseLookup.init();
export default JapaneseLookup;