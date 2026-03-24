/**
 * Japanese Lookup & Vocabulary Manager
 * Default Engine: MyMemory
 */
const JapaneseLookup = (() => {
  // SETTINGS
  const CONFIG = {
    engine: 'mymemory', // Mặc định là mymemory
    gas_url: "https://script.google.com/macros/s/AKfycbxRsR4M3R0rjz3i0u2kz6Pg-ME3IeDYs8-7GE0MrjRaakfxQBory3JMtjjgVw3lTbqI/exec",
    google_api: "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&dt=rm&q=",
    mymemory_api: "https://api.mymemory.translated.net/get?langpair=ja|vi&q="
  };

  const style = document.createElement('style');
  style.textContent = `
    .ja-lookup-popup {
      position: fixed; z-index: 99999; background: #fff; border: 1px solid #2563eb;
      border-radius: 12px; padding: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      font-family: system-ui, -apple-system; width: 240px; pointer-events: auto;
      max-height: 250px; overflow-y: auto; visibility: hidden; display: none;
    }
    .ja-lookup-word { color: #1e40af; font-size: 1.2em; font-weight: bold; display: block; }
    .ja-lookup-romaji { color: #64748b; font-size: 0.9em; font-style: italic; display: block; margin-bottom: 5px; }
    .ja-lookup-meaning { color: #0f172a; font-size: 1em; border-top: 1px solid #eee; padding-top: 5px; margin-top: 5px; }
    .ja-engine-tag { font-size: 9px; color: #94a3b8; text-transform: uppercase; float: right; background: #f1f5f9; padding: 2px 5px; border-radius: 4px; }
    /* ... (giữ nguyên các style history btn và modal từ phiên bản trước) ... */
    .ja-history-btn { position: fixed; bottom: 80px; right: 20px; width: 50px; height: 50px; background: #2563eb; color: white; border-radius: 50%; border: none; cursor: pointer; z-index: 9999; font-size: 24px; display: flex; align-items: center; justify-content: center; }
    .ja-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; align-items: center; justify-content: center; }
    .ja-modal-content { background: white; width: 95%; max-width: 500px; height: 85vh; border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; }
    .ja-highlight { color: #dc2626 !important; font-weight: bold; border-bottom: 1px dashed #dc2626; cursor: help; }
  `;
  document.head.appendChild(style);

  let popup = null;

  const createUI = () => {
    if (!popup) {
      popup = document.createElement('div');
      popup.className = 'ja-lookup-popup';
      document.body.appendChild(popup);
    }
  };

  async function lookup(text, x, y) {
    if (!text) return;
    createUI();

    // Hiển thị trạng thái chờ và tính toán vị trí chống tràn lề
    popup.style.display = 'block';
    popup.style.visibility = 'hidden';
    popup.innerHTML = `<span class="ja-engine-tag">${CONFIG.engine}</span><div>Đang dịch...</div>`;
    
    // Đợi 1 chút để DOM cập nhật offsetHeight
    setTimeout(async () => {
        let posX = Math.max(10, Math.min(x, window.innerWidth - popup.offsetWidth - 15));
        let posY = y + 10;
        if (posY + popup.offsetHeight > window.innerHeight) {
            posY = y - popup.offsetHeight - 10;
        }
        
        popup.style.left = `${posX}px`;
        popup.style.top = `${posY}px`;
        popup.style.visibility = 'visible';

        try {
          let meaning = "", romaji = "";
          
          if (CONFIG.engine === 'mymemory') {
            const res = await fetch(CONFIG.mymemory_api + encodeURIComponent(text), {
              "headers": {
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.9,ja;q=0.8"
              },
              "method": "GET",
              "mode": "cors"
            });
            const data = await res.json();
            meaning = data.responseData.translatedText;
            romaji = "MyMemory Engine";
          } else {
            const res = await fetch(CONFIG.google_api + encodeURIComponent(text));
            const data = await res.json();
            meaning = data[0][0][0];
            romaji = (data[0].find(i => i[3]))?.[3] || "";
          }

          popup.innerHTML = `
            <span class="ja-engine-tag">${CONFIG.engine}</span>
            <b class="ja-lookup-word">${text}</b>
            <i class="ja-lookup-romaji">${romaji}</i>
            <div class="ja-lookup-meaning">${meaning}</div>
          `;

          // Ghi log (giữ nguyên logic cũ của bạn)
          fetch(CONFIG.gas_url, { 
            method: "POST", 
            mode: "no-cors", 
            body: JSON.stringify({ action: "saveWord", word: text, romaji: romaji, meaning: meaning }) 
          });

        } catch (e) {
          popup.innerHTML = "Lỗi kết nối API dịch.";
          console.error(e);
        }
    }, 50);
  }

  return {
    init: () => {
      createUI();
      const handleSelection = (e) => {
        const sel = window.getSelection();
        const text = sel.toString().trim();
        // Kiểm tra ký tự tiếng Nhật
        if (text && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          lookup(text, rect.left, rect.bottom);
        }
      };
      document.addEventListener('mouseup', handleSelection);
      document.addEventListener('touchend', handleSelection);
      document.addEventListener('mousedown', (e) => { 
        if (popup && !popup.contains(e.target)) popup.style.display = 'none'; 
      });
    },
    // Hàm hỗ trợ đổi engine nhanh từ console
    toggleEngine: () => {
        CONFIG.engine = (CONFIG.engine === 'google') ? 'mymemory' : 'google';
        console.log("Đã đổi sang dùng:", CONFIG.engine);
    }
  };
})();

JapaneseLookup.init();