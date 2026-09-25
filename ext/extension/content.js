// content.js - Nhúng toàn bộ options.html lên màn hình hiện tại khi Assistive bật
(function() {
  const STORAGE_KEY_ASSISTIVE = 'assistive_enabled';
  let containerEl = null;

  function initAssistive() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

    chrome.storage.local.get([STORAGE_KEY_ASSISTIVE], (data) => {
      if (data && data[STORAGE_KEY_ASSISTIVE] === true) {
        showAssistiveOverlay();
      }
    });

    // Lắng nghe thay đổi từ storage
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes[STORAGE_KEY_ASSISTIVE]) {
        const isEnabled = changes[STORAGE_KEY_ASSISTIVE].newValue === true;
        if (isEnabled) {
          showAssistiveOverlay();
        } else {
          hideAssistiveOverlay();
        }
      }
    });

    // Lắng nghe tin nhắn trực tiếp từ popup
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.action === 'TOGGLE_ASSISTIVE') {
        if (msg.enabled) {
          showAssistiveOverlay();
        } else {
          hideAssistiveOverlay();
        }
        sendResponse({ success: true });
      }
    });
  }

  function createAssistiveElements() {
    if (document.getElementById('smart-alarm-assistive-root')) {
      return document.getElementById('smart-alarm-assistive-root');
    }

    const root = document.createElement('div');
    root.id = 'smart-alarm-assistive-root';

    const iconUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('icons/icon48.png')
      : '';
    const optionsUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('options.html?assistive=1')
      : 'options.html?assistive=1';

    root.innerHTML = `
      <div class="smart-alarm-assistive-bar" id="smartAlarmDragBar">
        <div class="smart-alarm-assistive-title">
          <img src="${iconUrl}" alt="Alarm">
          <span>Báo Thức Thông Minh Pro (Toàn màn hình)</span>
        </div>
        <div class="smart-alarm-assistive-actions">
          <button type="button" class="smart-alarm-assistive-btn" id="btnMinimizeAssistive" title="Thu nhỏ thành nút tròn">_</button>
          <button type="button" class="smart-alarm-assistive-btn close" id="btnCloseAssistive" title="Đóng toàn màn hình">✕ Đóng</button>
        </div>
      </div>
      <iframe class="smart-alarm-assistive-frame" src="${optionsUrl}" allow="autoplay; microphone"></iframe>
      <div class="smart-alarm-floating-badge" id="btnRestoreAssistive" title="Nhấn để mở bảng báo thức">
        <span>⏰ Báo Thức Pro</span>
      </div>
    `;

    document.documentElement.appendChild(root);

    // Kéo thả thanh tiêu đề
    setupDrag(root, root.querySelector('#smartAlarmDragBar'));

    // Nút thu nhỏ
    const btnMin = root.querySelector('#btnMinimizeAssistive');
    const badge = root.querySelector('#btnRestoreAssistive');
    btnMin.addEventListener('click', (e) => {
      e.stopPropagation();
      root.classList.add('minimized');
    });

    // Mở lại từ badge
    badge.addEventListener('click', () => {
      root.classList.remove('minimized');
    });

    // Nút tắt
    const btnClose = root.querySelector('#btnCloseAssistive');
    btnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.storage.local.set({ [STORAGE_KEY_ASSISTIVE]: false });
      hideAssistiveOverlay();
    });

    return root;
  }

  function showAssistiveOverlay() {
    containerEl = createAssistiveElements();
    if (containerEl) {
      containerEl.classList.remove('hidden');
    }
  }

  function hideAssistiveOverlay() {
    if (containerEl) {
      containerEl.classList.add('hidden');
    }
  }

  function setupDrag(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (!handle) return;

    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      if (e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;

      const newTop = element.offsetTop - pos2;
      const newLeft = element.offsetLeft - pos1;

      // Giới hạn trong viewport
      const maxLeft = window.innerWidth - element.offsetWidth - 10;
      const maxTop = window.innerHeight - element.offsetHeight - 10;

      element.style.top = Math.max(10, Math.min(newTop, maxTop)) + 'px';
      element.style.left = Math.max(10, Math.min(newLeft, maxLeft)) + 'px';
      element.style.bottom = 'auto';
      element.style.right = 'auto';
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  // Khởi chạy khi trang tải xong
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAssistive);
  } else {
    initAssistive();
  }
})();
