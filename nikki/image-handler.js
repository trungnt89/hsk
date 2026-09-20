// =============================================================================
// QUẢN LÝ XỬ LÝ & UPLOAD HÌNH ẢNH (CAMERA, GALLERY, DRAG/DROP, CLIPBOARD)
// Tích hợp API Vercel / Google Drive: https://hsk-gilt.vercel.app/api/gRecorder
// =============================================================================

const API_URL = 'https://hsk-gilt.vercel.app/api/gRecorder';
const LESSION_ID = "IMG_";

// Biến toàn cục quản lý trạng thái ảnh
var currentAttachedImage = '';
var isUploadingImage = false;
var pendingImageUploadPromise = null;

var cameraStream = null;
var currentCameraFacing = 'environment';

/**
 * Lấy URL ảnh đính kèm hiện tại để lưu vào Nhật ký
 */
function getAttachedImage() {
    return currentAttachedImage || '';
}

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
 * Cập nhật giao diện xem trước ảnh trong write-card
 */
function setAttachedImage(imageSrc, isUploading = false, statusText = '') {
    currentAttachedImage = imageSrc || '';
    const container = document.getElementById('imagePreviewContainer');
    const imgEl = document.getElementById('imagePreviewImg');
    const metaEl = document.getElementById('previewImgMeta');
    const hintEl = document.querySelector('.preview-img-hint');

    if (currentAttachedImage) {
        if (imgEl) imgEl.src = getImageDisplayUrl(currentAttachedImage);
        if (metaEl) {
            if (isUploading) {
                metaEl.innerHTML = '<span style="color:#d97706; font-weight:600;">⏳ Đang tải ảnh lên máy chủ...</span>';
                if (hintEl) hintEl.innerText = 'Vui lòng đợi giây lát...';
            } else {
                metaEl.innerHTML = statusText || '<span style="color:#059669; font-weight:600;">☁️ Đã lưu trên máy chủ</span>';
                if (hintEl) hintEl.innerText = 'Bấm vào ảnh để xem to • Bấm ✕ để gỡ bỏ';
            }
        }
        if (container) container.style.display = 'flex';
        if (typeof expandWriteCard === 'function') expandWriteCard();
    } else {
        removeAttachedImage();
    }
}

/**
 * Xóa ảnh đính kèm hiện tại
 */
function removeAttachedImage() {
    currentAttachedImage = '';
    isUploadingImage = false;
    pendingImageUploadPromise = null;

    const container = document.getElementById('imagePreviewContainer');
    const imgEl = document.getElementById('imagePreviewImg');
    const metaEl = document.getElementById('previewImgMeta');
    if (container) container.style.display = 'none';
    if (imgEl) imgEl.src = '';
    if (metaEl) metaEl.innerText = 'Ảnh đính kèm';

    const gInput = document.getElementById('imageInputGallery');
    const cInput = document.getElementById('imageInputCamera');
    if (gInput) gInput.value = '';
    if (cInput) cInput.value = '';
}

/**
 * Kiểm tra trạng thái đang tải ảnh
 */
function checkIsImageUploading() {
    return isUploadingImage;
}

/**
 * Chờ tiến trình upload ảnh hoàn tất
 */
async function waitForImageUpload() {
    if (pendingImageUploadPromise) {
        try {
            await pendingImageUploadPromise;
            return true;
        } catch (err) {
            console.error("[Image Upload Wait Error]", err);
            return false;
        }
    }
    return true;
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
 * Gửi yêu cầu tải ảnh lên API gRecorder giống trong image.html
 */
async function uploadImageToApi(imageData, fileName) {
    const name = fileName || `IMG_${Date.now()}.png`;
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
 * Xử lý ảnh: hiển thị xem trước tức thì và upload lên máy chủ ở background
 */
async function processAndUploadImage(dataUrl, fileName) {
    setAttachedImage(dataUrl, true);
    isUploadingImage = true;

    const task = (async () => {
        try {
            const uploadedUrl = await uploadImageToApi(dataUrl, fileName);
            currentAttachedImage = uploadedUrl;
            setAttachedImage(uploadedUrl, false, '<span style="color:#059669; font-weight:600;">☁️ Đã lưu trên máy chủ</span>');
            return uploadedUrl;
        } catch (err) {
            console.error("[LOG] Lỗi upload ảnh:", err);
            setAttachedImage(dataUrl, false, '<span style="color:#dc2626; font-weight:600;">⚠️ Lưu tạm cục bộ (Không thể gửi lên máy chủ)</span>');
            alert("Lỗi khi tải ảnh lên máy chủ: " + (err.message || err));
            throw err;
        } finally {
            isUploadingImage = false;
            pendingImageUploadPromise = null;
        }
    })();

    pendingImageUploadPromise = task;
    return task;
}

/**
 * Xử lý khi người dùng chọn file từ thư viện hoặc camera
 */
async function handleImageFileSelect(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    try {
        const dataUrl = await compressImage(file);
        await processAndUploadImage(dataUrl, file.name);
    } catch (err) {
        console.error("[Image Select Error]", err);
        alert("Không thể tải ảnh này. Vui lòng chọn tệp ảnh khác.");
    } finally {
        input.value = '';
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
 * Mở camera
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
 * Quản lý Camera Modal (không méo hình giống image.html)
 */
async function openCameraModal() {
    const modal = document.getElementById('cameraModal');
    if (!modal) return;
    modal.classList.add('active');
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
                    console.log(`[LOG] Camera Res: ${canvas.width}x${canvas.height}`);
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

/**
 * Chụp ảnh từ Camera Modal
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
    closeCameraModal();

    try {
        await processAndUploadImage(imageData, `IMG_${Date.now()}.png`);
    } catch (err) {
        console.error("[Capture Error]", err);
    }
}

/**
 * Modal phóng to xem ảnh (Lightbox)
 */
function openImageViewer(src) {
    if (!src) return;
    const modal = document.getElementById('imageLightboxModal');
    const img = document.getElementById('lightboxImage');
    if (img) img.src = getImageDisplayUrl(src);
    if (modal) modal.classList.add('active');
}

function closeImageViewer() {
    const modal = document.getElementById('imageLightboxModal');
    const img = document.getElementById('lightboxImage');
    if (modal) modal.classList.remove('active');
    if (img) img.src = '';
}

/**
 * Hỗ trợ kéo thả & dán ảnh trực tiếp từ clipboard
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
        if (dt && dt.files && dt.files[0]) {
            const file = dt.files[0];
            if (file.type.startsWith('image/')) {
                try {
                    const dataUrl = await compressImage(file);
                    await processAndUploadImage(dataUrl, file.name);
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
                        await processAndUploadImage(dataUrl, `IMG_PASTE_${Date.now()}.png`);
                        if (typeof expandWriteCard === 'function') expandWriteCard();
                    } catch (err) {
                        console.error("[Paste Image Error]", err);
                    }
                }
                break;
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeImageViewer();
            closeCameraModal();
        }
    });
}
