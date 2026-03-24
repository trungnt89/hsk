/**
 * Japanese Lookup & Vocabulary Manager
 * Fixed: Full Module Integration
 */
const JapaneseLookup = (() => {
  const CONFIG = {
    engine: 'mymemory',
    gas_url: "https://script.google.com/macros/s/AKfycbxRsR4M3R0rjz3i0u2kz6Pg-ME3IeDYs8-7GE0MrjRaakfxQBory3JMtjjgVw3lTbqI/exec",
    google_api: "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&dt=rm&q=",
    mymemory_api: "https://api.mymemory.translated.net/get?langpair=ja|vi&q="
  };

  const style = document.createElement('style');
  style.textContent = `
    .ja-lookup-popup {
      position: fixed; z-index: 999999; background: #fff; border: 1px solid #2563eb;
      border-radius: 12px; padding: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      font-family: system-ui, -apple-system; width: 240px; display: none;
    }
    .ja-lookup-word { color: #1e40af; font-size: 1.2em; font-weight: bold; display: block; }
    .ja-lookup-meaning { color: #0f172a; font-size: 1em; border-top: 1px solid #eee; padding-top: 5px; margin-top: 5px; }
    .ja-history-btn { 
      position: fixed; bottom: 80px; right: 20px; width: 50px; height: 50px; 
      background: #2563eb; color: white; border-radius: 50%; border: none; 
      cursor: pointer; z-index: 9999; font-size: 24px; display: flex; align-items: center; justify-content: center; 
    }
    .ja-modal { 
      display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.6); z-index: 1000000; align-items: center; justify-content: center; 
    }
    .ja-modal-content { background: white; width: 95%; max-width: 500px; height: 85vh; border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; }
    .ja-modal-header { padding: 15px; border-bottom: 2px solid #2563eb; display: flex; justify-content: space-between; align-items: center; }
    #ja-word-list { flex: 1; overflow-y: auto; padding: 15px; }
    .ja-engine-tag { font-size: 9px; color: #94a3b8; float: right; background: #f1f5f9; padding: 2px 5px; border-radius: 4px; }
  `;
  document.head.appendChild(style);

  let popup = null, modal = null;

  const createUI = () => {
    // Popup tra từ
    if (!document.querySelector('.ja-lookup-popup')) {
      popup = document.createElement('div');
      popup.className = 'ja-lookup-popup';
      document.body.appendChild(popup);
    }
    
    // Nút lịch sử
    if (!document.querySelector('.ja-history-btn')) {
      const btn = document.createElement('button');
      btn.className = 'ja-history-btn';
      btn.innerHTML = '📚';
      btn.onclick = () => JapaneseLookup.openManager();
      document.body.appendChild(btn);
    }

    // Modal quản lý
    if (!document.querySelector('.ja-modal')) {
      modal = document.createElement('div');
      modal.className = 'ja-modal';
      modal.innerHTML = `
        <div class="ja-modal-content">
          <div class="ja-modal-header">
            <h3 style="margin:0;">Từ vựng đã lưu</h3>
            <button onclick="this.closest('.ja-modal').style.display='none'" style="border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
          </div>
          <div id="ja-word-list">Đang tải...</div>
        </div>`;
      document.body.appendChild(modal);
    }
  };

  async function lookup(text, x, y) {
    if (!text) return;
    createUI();
    
    popup.style.display = 'block';
    popup.style.visibility = 'hidden';
    popup.innerHTML = `<span class="ja-engine-tag">${CONFIG.engine}</span><div>Đang tra...</div>`;
    
    setTimeout(async () => {
      let posX = Math.max(10, Math.min(x, window.innerWidth - 250));
      let posY = (y + 150 > window.innerHeight) ? (y - 130) : (y + 10);
      popup.style.left = `${posX}px`;
      popup.style.top = `${posY}px`;
      popup.style.visibility = 'visible';

      try {
        let meaning = "", romaji = "";
        if (CONFIG.engine === 'mymemory') {
          const res = await fetch(CONFIG.mymemory_api + encodeURIComponent(text));
          const data = await res.json();
          meaning = data.responseData.translatedText;
        } else {
          const res = await fetch(CONFIG.google_api + encodeURIComponent(text));
          const data = await res.json();
          meaning = data[0][0][0];
        }

        popup.innerHTML = `
          <span class="ja-engine-tag">${CONFIG.engine}</span>
          <b class="ja-lookup-word">${text}</b>
          <div class="ja-lookup-meaning">${meaning}</div>
        `;

        // Ghi log vào GAS
        fetch(CONFIG.gas_url, { 
          method: "POST", mode: "no-cors", 
          body: JSON.stringify({ action: "saveWord", word: text, meaning: meaning }) 
        });
      } catch (e) {
        popup.innerHTML = "Lỗi kết nối API.";
      }
    }, 50);
  }

  // Xuất các hàm ra ngoài window để gọi được từ button/onclick
  window.JapaneseLookup = {
    init: () => {
      createUI();
      const handleSelection = () => {
        const sel = window.getSelection();
        const text = sel.toString().trim();
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
      console.log("[Log] Japanese Lookup đã sẵn sàng.");
    },
    openManager: async () => {
      const m = document.querySelector('.ja-modal');
      m.style.display = 'flex';
      const list = document.getElementById('ja-word-list');
      try {
        const res = await fetch(CONFIG.gas_url + "?type=words&_t=" + Date.now());
        const words = await res.json();
        list.innerHTML = words.reverse().map(w => `
          <div style="padding:10px; border-bottom:1px solid #eee;">
            <b>${w.word}</b>: ${w.meaning}
          </div>
        `).join('') || "Chưa có từ nào.";
      } catch (e) { list.innerHTML = "Không thể tải dữ liệu."; }
    }
  };

  return window.JapaneseLookup;
})();

// Khởi chạy
JapaneseLookup.init();