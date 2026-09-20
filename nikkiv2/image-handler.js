// =============================================================================
// QUẢN LÝ XỬ LÝ & UPLOAD NHIỀU HÌNH ẢNH (CAMERA, GALLERY, DRAG/DROP, CLIPBOARD)
// Hỗ trợ lưu trữ nhiều ảnh trong 1 bài viết với API Vercel: https://hsk-gilt.vercel.app/api/gRecorder
// =============================================================================

const API_URL = 'https://hsk-gilt.vercel.app/api/gRecorder';
const LESSION_ID = "IMG_";

// Danh sách ảnh đang đính kèm trong bài viết hiện tại:
// Mỗi item: { id: string, url: string (local dataUrl hoặc remote URL), remoteUrl: string, isUploading: boolean, error: boolean }
var attachedImages = [];

// Lightbox state cho duyệt nhiều ảnh
var lightboxImagesList = [];
var lightboxCurrentIndex = 0;

var cameraStream = null;
var currentCameraFacing = 'environment';

/**
 * Chuẩn hóa URL hiển thị hình ảnh (hỗ trợ full URL, dataUrl và fileId)
 */
function getImageDisplayUrl(val) {
    if (!val) return '';
    if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:')) {
        return val;
    }
    return `${API_URL}?action=audio&fileId=${val}`;
}

/**
 * Phân tích chuỗi lưu trữ trong Google Sheet/DB thành mảng các URL ảnh
 * Hỗ trợ: JSON array, mảng có sẵn, chuỗi ngăn cách bởi dấu ||, dấu xuống dòng, hoặc 1 URL đơn lẻ
 */
function parseDiaryImages(imageVal) {
    if (!imageVal) return [];
    if (Array.isArray(imageVal)) {
        return imageVal.map(s => String(s).trim()).filter(Boolean);
    }
    if (typeof imageVal !== 'string') return [];
    const trimmed = imageVal.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.map(s => String(s).trim()).filter(Boolean);
            }
        } catch (e) {
            console.warn("[parseDiaryImages] JSON parse fallback", e);
        }
    }
    if (trimmed.includes('||')) {
        return trimmed.split('||').map(s => s.trim()).filter(Boolean);
    }
    if (trimmed.includes('\n')) {
        return trimmed.split('\n').map(s => s.trim()).filter(Boolean);
    }
    return [trimmed];
}

/**
 * Chuẩn hóa mảng các URL ảnh thành chuỗi để lưu trữ vào Google Sheet/DB
 * - Không có ảnh: trả về ""
 * - 1 ảnh: trả về URL đơn lẻ (tương thích 100% dữ liệu cũ)
 * - Nhiều ảnh: trả về JSON array chuỗi ["url1", "url2", ...]
 */
function serializeDiaryImages(images) {
    if (!images || !images.length) return '';
    const cleanList = images.map(img => (typeof img === 'string' ? img : (img.remoteUrl || img.url))).filter(Boolean);
    if (cleanList.length === 0) return '';
    if (cleanList.length === 1) return cleanList[0];
    return JSON.stringify(cleanList);
}

/**
 * Lấy mảng tất cả các URL ảnh đính kèm hiện tại
 */
function getAttachedImages() {
    return attachedImages
        .map(item => item.remoteUrl || item.url)
        .filter(Boolean);
}

/**
 * Lấy chuỗi biểu diễn ảnh đính kèm hiện tại để lưu vào Nhật ký (cho diary-server.js)
 */
function getAttachedImage() {
    return serializeDiaryImages(getAttachedImages());
}

/**
 * Getter/Setter tương thích ngược cho biến currentAttachedImage
 */
Object.defineProperty(window, 'currentAttachedImage', {
    get: function() {
        return attachedImages.length > 0 ? getAttachedImage() : '';
    },
    set: function(val) {
        if (!val) {
            clearAllAttachedImages();
        } else {
            setAttachedImage(val);
        }
    },
    configurable: true
});

Object.defineProperty(window, 'isUploadingImage', {
    get: function() {
        return checkIsImageUploading();
    },
    configurable: true
});

/**
 * Khởi tạo hoặc cập nhật danh sách ảnh đính kèm (dùng khi sửa bài viết hoặc nạp ảnh)
 */
function setAttachedImage(imageVal) {
    const urls = parseDiaryImages(imageVal);
    attachedImages = urls.map(url => ({
        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        url: url,
        remoteUrl: url,
        isUploading: false,
        error: false
    }));
    renderAttachedImagesPreview();
}

/**
 * Xóa một ảnh đính kèm theo id (hoặc xóa toàn bộ nếu không truyền id)
 */
function removeAttachedImage(id) {
    if (!id) {
        clearAllAttachedImages();
        return;
    }
    attachedImages = attachedImages.filter(item => item.id !== id);
    renderAttachedImagesPreview();
}

/**
 * Xóa toàn bộ ảnh đính kèm
 */
function clearAllAttachedImages() {
    attachedImages = [];
    const gInput = document.getElementById('imageInputGallery');
    const cInput = document.getElementById('imageInputCamera');
    if (gInput) gInput.value = '';
    if (cInput) cInput.value = '';
    renderAttachedImagesPreview();
}

/**
 * Cập nhật giao diện xem trước nhiều ảnh trong write-card
 */
function renderAttachedImagesPreview() {
    const container = document.getElementById('imagePreviewContainer');
    const listEl = document.getElementById('previewImagesList');
    const metaEl = document.getElementById('previewImgMeta');
    const hintEl = document.querySelector('.preview-img-hint');

    if (!container) return;

    if (attachedImages.length === 0) {
        container.style.display = 'none';
        if (listEl) listEl.innerHTML = '';
        if (metaEl) metaEl.innerText = 'Ảnh đính kèm';
        return;
    }

    container.style.display = 'block';

    const uploadingCount = attachedImages.filter(img => img.isUploading).length;
    if (metaEl) {
        if (uploadingCount > 0) {
            metaEl.innerHTML = `<span style="color:#d97706; font-weight:600;">⏳ Đang tải ${uploadingCount}/${attachedImages.length} ảnh lên máy chủ...</span>`;
            if (hintEl) hintEl.innerText = 'Vui lòng đợi ảnh tải lên hoàn tất trước khi lưu.';
        } else {
            metaEl.innerHTML = `<span style="color:#059669; font-weight:600;">☁️ Đã đính kèm ${attachedImages.length} ảnh</span>`;
            if (hintEl) hintEl.innerText = 'Bấm vào ảnh để xem to • Bấm ✕ để gỡ ảnh • Có thể thêm tiếp ảnh khác';
        }
    }

    if (listEl) {
        listEl.innerHTML = attachedImages.map((item, index) => {
            const displayUrl = getImageDisplayUrl(item.remoteUrl || item.url);
            const isUploading = item.isUploading;
            const isError = item.error;

            return `
                <div class="preview-thumb-item ${isUploading ? 'uploading' : ''} ${isError ? 'error' : ''}" id="thumb-${item.id}">
                    <img src="${displayUrl}" alt="Ảnh ${index + 1}" onclick="openAttachedImageViewer('${item.id}')" />
                    <button type="button" class="btn-remove-thumb" onclick="removeAttachedImage('${item.id}')" title="Xóa ảnh này">✕</button>
                    ${isUploading ? '<div class="thumb-upload-overlay"><div class="thumb-spinner"></div></div>' : ''}
                    ${isError ? '<div class="thumb-error-badge" title="Lỗi tải ảnh">⚠️</div>' : ''}
                </div>
            `;
        }).join('') + `
            <div class="preview-add-more-card" onclick="handleGalleryClick()" title="Chọn thêm ảnh">
                <span class="add-icon">＋</span>
                <span class="add-text">Thêm ảnh</span>
            </div>
        `;
    }

    if (typeof expandWriteCard === 'function') expandWriteCard();
}

/**
 * Kiểm tra có ảnh nào đang trong quá trình upload không
 */
function checkIsImageUploading() {
    return attachedImages.some(img => img.isUploading);
}

/**
 * Chờ tất cả các ảnh đang upload hoàn thành
 */
async function waitForImageUpload(timeoutMs = 30000) {
    const startTime = Date.now();
    while (checkIsImageUploading()) {
        if (Date.now() - startTime > timeoutMs) {
            console.warn("[waitForImageUpload] Timeout waiting for image upload");
            break;
        }
        await new Promise(r => setTimeout(r, 200));
    }
    return !checkIsImageUploading();
}

/**
 * Nén và chỉnh kích thước ảnh để tối ưu tốc độ tải lên
 */
function compressImage(fileOrBlob, maxDimension = 1280, initialQuality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxDimension) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', initialQuality);
                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error("Lỗi tải hình ảnh để nén"));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("Lỗi đọc tệp ảnh"));
        reader.readAsDataURL(fileOrBlob);
    });
}

/**
 * Gửi yêu cầu tải ảnh lên API gRecorder
 */
async function uploadImageToApi(imageData, fileName) {
    const name = fileName || `IMG_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
    console.log("[LOG] Bắt đầu upload ảnh lên API:", API_URL, name);

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: "uploadImage",
            name: name,
            base64Audio: imageData,
            lessionId: LESSION_ID
        })
    });

    if (!response.ok) {
        throw new Error(`Upload ảnh thất bại (Mã lỗi ${response.status})`);
    }

    const data = await response.json();
    console.log("[LOG] Upload ảnh thành công:", data);

    if (data && data.fileId) {
        return `${API_URL}?action=audio&fileId=${data.fileId}`;
    }
    throw new Error("API không trả về fileId");
}

/**
 * Thêm một ảnh vào danh sách đính kèm và tự động upload lên API
 */
async function addImageAndUpload(dataUrl, fileName) {
    const item = {
        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        url: dataUrl,
        remoteUrl: '',
        isUploading: true,
        error: false
    };

    attachedImages.push(item);
    renderAttachedImagesPreview();

    try {
        const uploadedUrl = await uploadImageToApi(dataUrl, fileName);
        item.remoteUrl = uploadedUrl;
        item.isUploading = false;
        item.error = false;
    } catch (err) {
        console.error("[LOG] Lỗi upload ảnh:", err);
        item.isUploading = false;
        item.error = true;
        alert("Lỗi tải ảnh lên máy chủ: " + (err.message || err));
    } finally {
        renderAttachedImagesPreview();
    }
    return item;
}

/**
 * Xử lý khi người dùng chọn một hoặc nhiều file từ máy (Gallery / File Picker)
 */
async function handleImageFileSelect(input) {
    if (!input.files || input.files.length === 0) return;
    const files = Array.from(input.files);
    input.value = '';

    for (const file of files) {
        try {
            const dataUrl = await compressImage(file);
            // Kích hoạt upload song song từng ảnh
            addImageAndUpload(dataUrl, file.name);
        } catch (err) {
            console.error("[Image Select Error]", err);
            alert("Không thể đọc tệp ảnh: " + file.name);
        }
    }
}

/**
 * Mở chọn ảnh từ thư viện
 */
function handleGalleryClick() {
    const input = document.getElementById('imageInputGallery');
    if (input) input.click();
}

/**
 * Mở camera (hỗ trợ mobile trực tiếp và camera modal desktop)
 */
function handleCameraClick() {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        const camInput = document.getElementById('imageInputCamera');
        if (camInput) camInput.click();
    } else {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            openCameraModal();
        } else {
            const camInput = document.getElementById('imageInputCamera');
            if (camInput) camInput.click();
        }
    }
}

/**
 * Quản lý Camera Modal
 */
async function openCameraModal() {
    const modal = document.getElementById('cameraModal');
    if (!modal) return;
    modal.classList.add('active');
    updateCameraModalStatus();
    await startCameraStream();
}

async function startCameraStream() {
    stopCameraStream();
    try {
        const constraints = {
            video: {
                facingMode: { ideal: currentCameraFacing },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('cameraVideo');
        const canvas = document.getElementById('cameraCanvas');
        if (video) {
            video.srcObject = cameraStream;
            video.onloadedmetadata = () => {
                const track = cameraStream.getVideoTracks()[0];
                const settings = track ? track.getSettings() : {};
                if (canvas) {
                    canvas.width = settings.width || video.videoWidth || 1280;
                    canvas.height = settings.height || video.videoHeight || 720;
                }
            };
            video.play();
        }
    } catch (err) {
        console.warn("[Camera Stream Error]", err);
        closeCameraModal();
        const camInput = document.getElementById('imageInputCamera');
        if (camInput) camInput.click();
    }
}

function stopCameraStream() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    const video = document.getElementById('cameraVideo');
    if (video) video.srcObject = null;
}

function closeCameraModal() {
    stopCameraStream();
    const modal = document.getElementById('cameraModal');
    if (modal) modal.classList.remove('active');
}

async function switchCameraFacing() {
    currentCameraFacing = (currentCameraFacing === 'environment') ? 'user' : 'environment';
    await startCameraStream();
}

function updateCameraModalStatus() {
    const titleEl = document.querySelector('.camera-modal-title');
    if (titleEl) {
        const count = attachedImages.length;
        titleEl.innerText = count > 0 ? `📷 Chụp ảnh (Đã có ${count} ảnh)` : '📷 Chụp ảnh từ camera';
    }
}

/**
 * Chụp ảnh từ Camera Modal (có thể chụp liên tục nhiều ảnh)
 */
async function captureFromCamera() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas') || document.createElement('canvas');
    if (!video || !video.videoWidth) {
        alert("Camera chưa sẵn sàng. Vui lòng thử lại.");
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/png');
    
    // Hiệu ứng flash khi chụp
    if (video.parentElement) {
        video.parentElement.style.opacity = '0.3';
        setTimeout(() => { video.parentElement.style.opacity = '1'; }, 100);
    }

    // Thêm ảnh vào danh sách đính kèm
    addImageAndUpload(imageData, `IMG_CAM_${Date.now()}.png`);
    updateCameraModalStatus();

    // Hiển thị thông báo nhanh
    const btnCapture = document.querySelector('.btn-cam-capture');
    if (btnCapture) {
        const origText = btnCapture.innerText;
        btnCapture.innerText = '✓ Đã chụp!';
        btnCapture.style.background = '#059669';
        setTimeout(() => {
            btnCapture.innerText = origText;
            btnCapture.style.background = '';
        }, 1200);
    }
}

/**
 * Mở xem ảnh phóng to trong write-card
 */
function openAttachedImageViewer(id) {
    const idx = attachedImages.findIndex(item => item.id === id);
    const urls = attachedImages.map(item => item.remoteUrl || item.url);
    openImageViewer(urls, idx >= 0 ? idx : 0);
}

/**
 * Modal phóng to xem ảnh (Lightbox) hỗ trợ duyệt nhiều ảnh
 */
function openImageViewer(srcOrList, initialIndex = 0) {
    let images = [];
    if (Array.isArray(srcOrList)) {
        images = srcOrList;
    } else if (typeof srcOrList === 'string') {
        images = parseDiaryImages(srcOrList);
    }

    if (!images || images.length === 0) return;

    lightboxImagesList = images;
    lightboxCurrentIndex = Math.max(0, Math.min(initialIndex, images.length - 1));

    updateLightboxView();

    const modal = document.getElementById('imageLightboxModal');
    if (modal) modal.classList.add('active');
}

function updateLightboxView() {
    const img = document.getElementById('lightboxImage');
    const counter = document.getElementById('lightboxCounter');
    const prevBtn = document.getElementById('lightboxPrevBtn');
    const nextBtn = document.getElementById('lightboxNextBtn');

    if (!lightboxImagesList || lightboxImagesList.length === 0) return;

    const currentUrl = lightboxImagesList[lightboxCurrentIndex];
    if (img) img.src = getImageDisplayUrl(currentUrl);

    const total = lightboxImagesList.length;
    if (total > 1) {
        if (counter) {
            counter.innerText = `${lightboxCurrentIndex + 1} / ${total}`;
            counter.style.display = 'block';
        }
        if (prevBtn) prevBtn.style.display = 'flex';
        if (nextBtn) nextBtn.style.display = 'flex';
    } else {
        if (counter) counter.style.display = 'none';
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    }
}

function lightboxPrev(e) {
    if (e) e.stopPropagation();
    if (!lightboxImagesList || lightboxImagesList.length <= 1) return;
    lightboxCurrentIndex = (lightboxCurrentIndex - 1 + lightboxImagesList.length) % lightboxImagesList.length;
    updateLightboxView();
}

function lightboxNext(e) {
    if (e) e.stopPropagation();
    if (!lightboxImagesList || lightboxImagesList.length <= 1) return;
    lightboxCurrentIndex = (lightboxCurrentIndex + 1) % lightboxImagesList.length;
    updateLightboxView();
}

function closeImageViewer() {
    const modal = document.getElementById('imageLightboxModal');
    const img = document.getElementById('lightboxImage');
    if (modal) modal.classList.remove('active');
    if (img) img.src = '';
    lightboxImagesList = [];
    lightboxCurrentIndex = 0;
}

/**
 * Tạo khối HTML hiển thị danh sách ảnh cho 1 bài viết trong nhật ký
 */
function renderDiaryImagesHtml(imageVal) {
    const images = parseDiaryImages(imageVal);
    if (!images || images.length === 0) return '';

    const total = images.length;
    // Mã hóa mảng ảnh để truyền an toàn vào onclick
    const encodedJson = encodeURIComponent(JSON.stringify(images));

    if (total === 1) {
        const url = images[0];
        return `
            <div class="diary-image-wrapper single-img" onclick="event.stopPropagation(); openImageViewer(decodeURIComponent('${encodedJson}'), 0)" title="Bấm để xem ảnh phóng to">
                <img src="${getImageDisplayUrl(url)}" alt="Ảnh nhật ký" loading="lazy" class="diary-image" />
                <span class="image-zoom-badge">🔍 Xem ảnh</span>
            </div>
        `;
    }

    // Nhiều ảnh: hiển thị theo dạng lưới gallery
    const gridClass = total === 2 ? 'gallery-grid-2' : (total === 3 ? 'gallery-grid-3' : 'gallery-grid-multi');
    const maxVisible = 4;
    const visibleImages = images.slice(0, maxVisible);
    const remaining = total - maxVisible;

    const itemsHtml = visibleImages.map((url, idx) => {
        const isLast = idx === maxVisible - 1 && remaining > 0;
        return `
            <div class="diary-gallery-item" onclick="event.stopPropagation(); openImageViewer(decodeURIComponent('${encodedJson}'), ${idx})" title="Xem ảnh ${idx + 1}/${total}">
                <img src="${getImageDisplayUrl(url)}" alt="Ảnh ${idx + 1}" loading="lazy" class="gallery-thumb-img" />
                ${isLast ? `<div class="gallery-more-overlay">+${remaining}</div>` : ''}
            </div>
        `;
    }).join('');

    return `
        <div class="diary-gallery-container ${gridClass}">
            <div class="diary-gallery-grid">
                ${itemsHtml}
            </div>
            <span class="image-zoom-badge">🖼️ ${total} ảnh</span>
        </div>
    `;
}

/**
 * Hỗ trợ kéo thả & dán nhiều ảnh từ clipboard
 */
function initImageDropAndPaste() {
    const card = document.querySelector('.write-card');
    if (!card) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        card.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.style.borderColor = 'var(--primary-color)';
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        card.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.style.borderColor = '';
        }, false);
    });

    card.addEventListener('drop', async (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
            const files = Array.from(dt.files).filter(f => f.type.startsWith('image/'));
            for (const file of files) {
                try {
                    const dataUrl = await compressImage(file);
                    addImageAndUpload(dataUrl, file.name);
                } catch (err) {
                    console.error("[Drop Image Error]", err);
                }
            }
        }
    });

    document.addEventListener('paste', async (e) => {
        const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    try {
                        const dataUrl = await compressImage(file);
                        addImageAndUpload(dataUrl, `IMG_PASTE_${Date.now()}.png`);
                        if (typeof expandWriteCard === 'function') expandWriteCard();
                    } catch (err) {
                        console.error("[Paste Image Error]", err);
                    }
                }
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeImageViewer();
            closeCameraModal();
        } else if (e.key === 'ArrowLeft') {
            const modal = document.getElementById('imageLightboxModal');
            if (modal && modal.classList.contains('active')) {
                lightboxPrev();
            }
        } else if (e.key === 'ArrowRight') {
            const modal = document.getElementById('imageLightboxModal');
            if (modal && modal.classList.contains('active')) {
                lightboxNext();
            }
        }
    });
}
