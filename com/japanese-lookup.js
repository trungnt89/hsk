/**
 * Japanese Lookup & Vocabulary Manager
 * Link GAS: https://script.google.com/macros/s/AKfycbxRsR4M3R0rjz3i0u2kz6Pg-ME3IeDYs8-7GE0MrjRaakfxQBory3JMtjjgVw3lTbqI/exec
 */

const JapaneseLookup = (() => {
  const GAS_URL = "https://script.google.com/macros/s/AKfycbxRsR4M3R0rjz3i0u2kz6Pg-ME3IeDYs8-7GE0MrjRaakfxQBory3JMtjjgVw3lTbqI/exec";
  const TRANSLATE_API = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&dt=rm&q=";
  
  const style = document.createElement('style');
  style.textContent = `
    .ja-lookup-popup {
      position: absolute; z-index: 99999; background: #fff; border: 1px solid #2563eb;
      border-radius: 12px; padding: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      font-family: system-ui, -apple-system; width: 220px; pointer-events: auto;
    }
    .ja-lookup-word { color: #1e40af; font-size: 1.2em; font-weight: bold; display: block; }
    .ja-lookup-romaji { color: #64748b; font-size: 0.9em; font-style: italic; display: block; margin-bottom: 5px; }
    .ja-lookup-meaning { color: #0f172a; font-size: 1em; border-top: 1px solid #eee; padding-top: 5px; }

    .ja-history-btn {
      position: fixed; bottom: 80px; right: 20px; width: 50px; height: 50px;
      background: #2563eb; color: white; border-radius: 50%; border: none;
      cursor: pointer; z-index: 9999; font-size: 24px; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
    }

    .ja-modal {
      display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.6); z-index: 10000; align-items: center; justify-content: center;
    }
    .ja-modal-content {
      background: white; width: 95%; max-width: 500px; max-height: 85vh;
      border-radius: 20px; padding: 20px; overflow-y: auto; position: relative;
    }
    .ja-word-item {
      padding: 12px; border-bottom: 1px solid #f1f5f9; display: flex;
      justify-content: space-between; align-items: center; gap: 10px;
    }
    .ja-btn-group { display: flex; gap: 8px; flex-shrink: 0; }
    .ja-btn-sm { padding: 6px 10px; border-radius: 6px; border: 1px solid #ddd; cursor: pointer; font-size: 12px; background: #fff; }
    .ja-edit-input { width: 100%; padding: 8px; margin: 4px 0; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; }
  `;
  document.head.appendChild(style);

  let popup = null, modal = null;

  const createUI = () => {
    if (!popup) {
      popup = document.createElement('div');
      popup.className = 'ja-lookup-popup';
      popup.style.display = 'none';
      document.body.appendChild(popup);
    }
    if (!document.querySelector('.ja-history-btn')) {
      const btn = document.createElement('button');
      btn.className = 'ja-history-btn';
      btn.innerHTML = '📚';
      btn.onclick = openManager;
      document.body.appendChild(btn);
    }
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'ja-modal';
      modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
      modal.innerHTML = `
        <div class="ja-modal-content">
          <h3 style="margin-top:0; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">Từ vựng đã lưu</h3>
          <div id="ja-word-list">Đang tải dữ liệu...</div>
          <button onclick="this.closest('.ja-modal').style.display='none'" style="width:100%; padding:12px; margin-top:15px; border-radius:10px; border:none; background:#f1f5f9; font-weight:bold; cursor:pointer;">Đóng</button>
        </div>`;
      document.body.appendChild(modal);
    }
  };

  async function callGAS(data) {
    return fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(data) });
  }

  async function openManager() {
    createUI();
    modal.style.display = 'flex';
    const list = document.getElementById('ja-word-list');
    list.innerHTML = "Đang đồng bộ với Cloud...";
    try {
      const res = await fetch(GAS_URL + "?type=words&_t=" + Date.now());
      const words = await res.json();
      if (!words || words.length === 0) {
        list.innerHTML = "Chưa có từ vựng nào được lưu.";
        return;
      }
      list.innerHTML = words.reverse().map(item => `
        <div class="ja-word-item" id="word-row-${item.id}">
          <div style="flex:1">
            <strong style="color:#1e40af; font-size: 1.1em;">${item.word}</strong> 
            <span style="color:#64748b; font-size: 0.85em;">${item.romaji ? `[${item.romaji}]` : ''}</span>
            <div style="font-size:0.95em; color:#334155; margin-top: 3px;">${item.meaning}</div>
          </div>
          <div class="ja-btn-group">
            <button class="ja-btn-sm" onclick="JapaneseLookup.editWord(${item.id}, \`${item.word}\`, \`${item.romaji}\`, \`${item.meaning}\`)">✏️</button>
            <button class="ja-btn-sm" style="color:#dc2626" onclick="JapaneseLookup.deleteWord(${item.id})">🗑</button>
          </div>
        </div>
      `).join('');
    } catch (e) { 
      list.innerHTML = "Lỗi kết nối server hoặc chưa có dữ liệu."; 
      console.error(e);
    }
  }

  // Đối tượng global để xử lý sự kiện trong HTML động
  window.JapaneseLookup = {
    deleteWord: async (id) => {
      if (!confirm("Bạn có chắc muốn xóa từ này khỏi danh sách?")) return;
      console.log(`[Log] Deleting word ID: ${id}`);
      await callGAS({ action: "deleteWord", id: id });
      const row = document.getElementById(`word-row-${id}`);
      if (row) row.style.opacity = '0.3';
      setTimeout(openManager, 500);
    },
    editWord: (id, word, romaji, meaning) => {
      const row = document.getElementById(`word-row-${id}`);
      row.innerHTML = `
        <div style="width:100%">
          <input id="edit-w-${id}" class="ja-edit-input" value="${word}" placeholder="Từ gốc">
          <input id="edit-r-${id}" class="ja-edit-input" value="${romaji}" placeholder="Phiên âm">
          <input id="edit-m-${id}" class="ja-edit-input" value="${meaning}" placeholder="Nghĩa">
          <div style="display:flex; gap:5px; margin-top:5px">
            <button class="ja-btn-sm" style="background:#2563eb; color:white; border:none; flex:1" onclick="JapaneseLookup.saveEdit(${id})">Lưu</button>
            <button class="ja-btn-sm" style="flex:1" onclick="JapaneseLookup.openManager()">Hủy</button>
          </div>
        </div>`;
    },
    saveEdit: async (id) => {
      const data = {
        action: "updateWord", id: id,
        word: document.getElementById(`edit-w-${id}`).value,
        romaji: document.getElementById(`edit-r-${id}`).value,
        meaning: document.getElementById(`edit-m-${id}`).value
      };
      console.log(`[Log] Updating word ID: ${id}`);
      await callGAS(data);
      setTimeout(openManager, 800);
    },
    openManager: openManager
  };

  async function lookup(text, x, y) {
    if (!text || !/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) return;
    createUI();
    popup.innerHTML = `<div style="font-size: 12px; color: #666;">Đang dịch...</div>`;
    popup.style.display = 'block';
    popup.style.left = `${Math.min(x + window.pageXOffset, window.innerWidth - 240)}px`;
    popup.style.top = `${y + window.pageYOffset + 20}px`;

    try {
      const res = await fetch(TRANSLATE_API + encodeURIComponent(text));
      const data = await res.json();
      const meaning = data[0][0][0];
      let romaji = (data[0].find(i => i[3]))?.[3] || "";

      popup.innerHTML = `
        <span class="ja-lookup-word">${text}</span>
        <span class="ja-lookup-romaji">${romaji ? `[ ${romaji} ]` : ''}</span>
        <div class="ja-lookup-meaning">🇻🇳 ${meaning}</div>`;

      // Tự động lưu vào GAS
      callGAS({ 
        action: "saveWord", 
        word: text, 
        romaji: romaji, 
        meaning: meaning, 
        source: window.location.pathname.split('/').pop() 
      });
      console.log(`[Log] Auto-saved: ${text}`);
    } catch (e) { 
      console.error("Lookup failed", e);
      popup.style.display = 'none'; 
    }
  }

  return {
    init: () => {
      createUI();
      // Xử lý bôi đen
      document.addEventListener('mouseup', () => {
        const sel = window.getSelection();
        const selectedText = sel.toString().trim();
        if (selectedText) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          lookup(selectedText, rect.left, rect.bottom);
        }
      });
      // Click ra ngoài để đóng popup
      document.addEventListener('mousedown', (e) => {
        if (popup && !popup.contains(e.target) && !e.target.classList.contains('ja-history-btn')) {
          popup.style.display = 'none';
        }
      });
    }
  };
})();

// Khởi tạo module
JapaneseLookup.init();
export default JapaneseLookup;