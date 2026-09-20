// =============================================================================
// NIKKI DIARY & AI - ĐIỂM KHỞI CHẠY CHÍNH (APP ENTRY POINT)
// Điều phối các module: highlight-handler, voice-handler, text-ai-handler,
// diary-handler, image-handler, crud.js.
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("[Nikki App] Khởi tạo hệ thống...");

    // 1. Khởi tạo nạp từ vựng Mazii từ IndexedDB để tô màu chữ tức thì
    if (typeof initWordHighlightFromDB === 'function') {
        initWordHighlightFromDB();
    }

    // 2. Khởi tạo tải danh sách nhật ký từ máy chủ / IndexedDB
    if (typeof initApp === 'function') {
        initApp();
    }

    // 3. Khởi tạo cài đặt giọng đọc TTS & thiết lập tab ban đầu
    if (typeof loadTTSSettings === 'function') {
        loadTTSSettings();
    }

    // 4. Khởi tạo tính năng kéo thả & paste ảnh từ clipboard
    if (typeof initImageDropAndPaste === 'function') {
        initImageDropAndPaste();
    }

    // 5. Khởi tạo các sự kiện cho thẻ soạn thảo nhật ký
    if (typeof initDiaryEvents === 'function') {
        initDiaryEvents();
    }
});
