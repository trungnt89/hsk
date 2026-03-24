/**
 * Japanese Lookup & Vocabulary Manager - Mazii API Integrated
 */

const JapaneseLookup = (() => {
  const GAS_URL = "https://script.google.com/macros/s/AKfycbxRsR4M3R0rjz3i0u2kz6Pg-ME3IeDYs8-7GE0MrjRaakfxQBory3JMtjjgVw3lTbqI/exec";
  const MAZII_API = "https://api.mazii.net/api/gtrans";
  
  const style = document.createElement('style');
  style.textContent = `
    .ja-lookup-popup {
      position: absolute; z-index: 99999; background: #fff; border: 1px solid #2563eb;
      border-radius: 12px; padding: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      font-family: system-ui, -apple-system; width: 220px; pointer-events: auto;
    }
    .ja-lookup-word { color: #1e40af; font-size: 1.2em; font-weight: bold; display: block; }
    .ja-lookup-meaning { color: #0f172a; font-size: 1em; border-top: 1px solid #eee; padding-top: 5px; margin-top: 5px; }
    .ja-history-btn {
      position: fixed; bottom: 80px; right: 20px; width: 50px; height: 50px;
      background: #2563eb; color: white; border-radius: 50%; border: none;
      cursor: pointer; z-index: 9999; font-size: 24px; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
      display: flex; align-items: center; justify-content: center;
    }
    .ja-modal {
      display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.6); z-index: 10000; align-items: center; justify-content: center;
    }
    .ja-modal-content {
      background: white; width: 95%; max-width: 500px; height: 85vh;
      border-radius: 20px; display: flex; flex-direction: column; overflow: hidden;
    }
    .ja-modal-header { padding: 20px; border-bottom: 2px solid #2563eb; position: relative; }
    #ja-word-list { flex: 1; overflow-y: auto; padding: 20px; }
    .ja-close-modal { position: absolute; top: 18px; right: 15px; border: none; background: #f1f5f9; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; }
    .ja-highlight { color: #dc2626 !important; font-weight: bold; border-bottom: 1px dashed #dc2626; cursor: help; }
    .ja-word-item { padding: 12px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
    .ja-edit-input { width: 100%; padding: 8px; margin: 4px 0; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; }
    .ja-btn-sm { padding: 6px 10px; border-radius: 6px; border: 1px solid #ddd; background: #fff; cursor: pointer; }
  `;
  document.head.appendChild(style);

  let popup = null, modal = null;
  let globalSavedWords = [];

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
      btn.onclick = () => window.JapaneseLookup.openManager();
      document.body.appendChild(btn);
    }
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'ja-modal';
      modal.innerHTML = `
        <div class="ja-modal-content">
          <div class="ja-modal-header">
            <button class="ja-close-modal" onclick="this.closest('.ja-modal').style.display='none'">✕</button>
            <h3 style="margin:0;">Từ vựng đã lưu</h3>
          </div>
          <div id="ja-word-list">Đang tải dữ liệu...</div>
        </div>`;
      document.body.appendChild(modal);
    }
  };

  async function callGAS(data) {
    return fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(data) });
  }

  function highlightSavedWords(targetNode = document.body) {
    if (!globalSavedWords || globalSavedWords.length === 0) return;
    const sortedWords = [...new Set(globalSavedWords.map(item => item.word))].sort((a, b) => b.length - a.length);
    const walker = document.createTreeWalker(targetNode, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement.closest('.ja-lookup-popup, .ja-modal, .ja-history-btn, script, style, .ja-highlight, textarea, input')) continue;
      nodes.push(node);
    }
    nodes.forEach(node => {
      let text = node.nodeValue;
      if (!text || !text.trim()) return;
      let changed = false;
      sortedWords.forEach(word => {
        if (text.includes(word)) {
          const regex = new RegExp(word, 'g');
          text = text.replace(regex, `<span class="ja-highlight">${word}</span>`);
          changed = true;
        }
      });
      if (changed) {
        const span = document.createElement('span');
        span.innerHTML = text;
        if (node.parentNode) node.parentNode.replaceChild(span, node);
      }
    });
  }

  async function openManager() {
    createUI();
    modal.style.display = 'flex';
    const list = document.getElementById('ja-word-list');
    list.innerHTML = "Đang đồng bộ...";
    try {
      const res = await fetch(GAS_URL + "?type=words&_t=" + Date.now());
      globalSavedWords = await res.json();
      if (!globalSavedWords || globalSavedWords.length === 0) { list.innerHTML = "Trống."; return; }
      list.innerHTML = globalSavedWords.slice().reverse().map(item => `
        <div class="ja-word-item" id="word-row-${item.id}">
          <div style="flex:1">
            <strong style="color:#1e40af;">${item.word}</strong> 
            <small style="color:#64748b;">${item.romaji ? `[${item.romaji}]` : ''}</small>
            <div style="font-size:0.9em;">${item.meaning}</div>
          </div>
          <div style="display:flex; gap:5px;">
            <button class="ja-btn-sm" onclick="JapaneseLookup.editWord(${item.id}, \`${item.word}\`, \`${item.romaji}\`, \`${item.meaning}\`)">✏️</button>
            <button class="ja-btn-sm" style="color:red" onclick="JapaneseLookup.deleteWord(${item.id})">🗑</button>
          </div>
        </div>
      `).join('');
    } catch (e) { console.error(e); }
  }

  window.JapaneseLookup = {
    deleteWord: async (id) => {
      if (!confirm("Xóa từ này?")) return;
      document.getElementById(`word-row-${id}`)?.remove();
      callGAS({ action: "deleteWord", id: id });
    },
    editWord: (id, word, romaji, meaning) => {
      const row = document.getElementById(`word-row-${id}`);
      row.innerHTML = `<div style="width:100%"><input id="edit-w-${id}" class="ja-edit-input" value="${word}"><input id="edit-r-${id}" class="ja-edit-input" value="${romaji}"><input id="edit-m-${id}" class="ja-edit-input" value="${meaning}"><button onclick="JapaneseLookup.saveEdit(${id})">Lưu</button></div>`;
    },
    saveEdit: async (id) => {
      const data = { action: "updateWord", id: id, word: document.getElementById(`edit-w-${id}`).value, romaji: document.getElementById(`edit-r-${id}`).value, meaning: document.getElementById(`edit-m-${id}`).value };
      await callGAS(data);
      openManager();
    },
    openManager: openManager
  };

  async function lookup(text, x, y) {
    if (!text) return;
    createUI();
    popup.style.display = 'block';
    popup.innerHTML = "Đang tra Mazii...";
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    popup.style.left = `${Math.min(x + scrollX, window.innerWidth - 240)}px`;
    popup.style.top = `${y + scrollY + 20}px`;

    try {
      const res = await fetch(MAZII_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, source: "ja", target: "vi" })
      });
      const data = await res.json();
      const meaning = data.data || "Không có kết quả";

      popup.innerHTML = `
        <b class="ja-lookup-word">${text}</b>
        <div class="ja-lookup-meaning">🇲🇿 ${meaning}</div>`;

      callGAS({ action: "saveWord", word: text, romaji: "", meaning: meaning });
      
      if (!globalSavedWords.some(w => w.word === text)) {
         globalSavedWords.push({ word: text });
         highlightSavedWords(document.body);
      }
    } catch (e) { popup.style.display = 'none'; }
  }

  return {
    init: async () => {
      createUI();
      try {
        const res = await fetch(GAS_URL + "?type=words&_t=" + Date.now());
        globalSavedWords = await res.json();
        highlightSavedWords(document.body);
        let debounceTimer = null;
        const observer = new MutationObserver(() => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => highlightSavedWords(document.body), 800);
        });
        observer.observe(document.body, { childList: true, subtree: true });
      } catch (e) { console.error(e); }

      const handleSelection = () => {
        setTimeout(() => {
          const sel = window.getSelection();
          const text = sel.toString().trim();
          if (text && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            lookup(text, rect.left, rect.bottom);
          }
        }, 150);
      };
      document.addEventListener('touchend', handleSelection);
      document.addEventListener('mouseup', handleSelection);
      document.addEventListener('mousedown', (e) => { if (popup && !popup.contains(e.target)) popup.style.display = 'none'; });
    }
  };
})();

JapaneseLookup.init();
export default JapaneseLookup;