/**
 * Japanese Lookup Module
 * Chức năng: Click vào văn bản tiếng Nhật để hiện cách đọc và dịch.
 * Cách nhúng: <script type="module" src="path/to/japanese-lookup.js"></script>
 */

const JapaneseLookup = (() => {
  // Cấu hình API (Có thể thay đổi sang API Google Translate hoặc tương đương)
  const TRANSLATE_API = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&q=";
  
  // Tạo Style cho Popup
  const style = document.createElement('style');
  style.textContent = `
    .ja-lookup-popup {
      position: absolute;
      z-index: 10000;
      background: #fff;
      border: 1px solid #4a7cff;
      border-radius: 8px;
      padding: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 250px;
      pointer-events: none;
      transition: opacity 0.2s;
    }
    .ja-lookup-reading { color: #2563eb; font-weight: bold; font-size: 0.9em; margin-bottom: 4px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .ja-lookup-meaning { color: #333; font-size: 0.85em; line-height: 1.4; }
  `;
  document.head.appendChild(style);

  let popup = null;

  function createPopup() {
    popup = document.createElement('div');
    popup.className = 'ja-lookup-popup';
    popup.style.display = 'none';
    document.body.appendChild(popup);
  }

  // Kiểm tra xem text có chứa ký tự tiếng Nhật không
  function isJapanese(text) {
    return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(text);
  }

  async function lookup(text, x, y) {
    if (!text || !isJapanese(text)) return;

    popup.innerHTML = `<div class="ja-lookup-meaning">Đang tra cứu...</div>`;
    popup.style.left = `${x}px`;
    popup.style.top = `${y + 20}px`;
    popup.style.display = 'block';
    popup.style.opacity = '1';

    try {
      const res = await fetch(TRANSLATE_API + encodeURIComponent(text));
      const data = await res.json();
      
      const translatedText = data[0][0][0];
      // Một số API translate trả về transliteration ở data[0][1] (tùy phiên bản API)
      const reading = data[0][1] ? data[0][1][3] : "Tra cứu thành công";

      popup.innerHTML = `
        <div class="ja-lookup-reading">${text}</div>
        <div class="ja-lookup-meaning">${translatedText}</div>
      `;
    } catch (e) {
      popup.innerHTML = `<div class="ja-lookup-meaning">Lỗi kết nối API</div>`;
    }
  }

  function init() {
    createPopup();

    document.addEventListener('click', (e) => {
      // Lấy đoạn văn bản được chọn hoặc từ được click vào
      let selectedText = window.getSelection().toString().trim();
      
      // Nếu không bôi đen, lấy từ dưới con trỏ chuột (thử nghiệm)
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

    // Click ra ngoài để đóng
    document.addEventListener('mousedown', (e) => {
      if (popup && e.target !== popup) {
        popup.style.display = 'none';
      }
    });
  }

  return { init };
})();

// Tự động khởi chạy khi load
JapaneseLookup.init();
export default JapaneseLookup;