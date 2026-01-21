/**
 * APP: Video Call WebRTC (Vercel Ready)
 * Rules: Full logging, No logic change unless requested.
 */

let localStream;
let peer;
let qrcodeInstance = null;

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const peerIdDisplay = document.getElementById('peer-id-display');
const myIdInput = document.getElementById('my-id-input');
const remoteIdInput = document.getElementById('remote-id');
const qrcodeDiv = document.getElementById('qrcode');

// 1. Khởi tạo Camera
async function startMedia() {
    console.log("[LOG] Khởi động Media Devices...");
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        console.log("[LOG] Camera & Mic đã sẵn sàng.");
    } catch (error) {
        console.error("[LOG] Lỗi Camera:", error);
        alert("Không thể mở Camera. Vui lòng kiểm tra quyền HTTPS.");
    }
}

// 2. Hàm tạo QR Code
function updateQRCode(id) {
    const callUrl = `${window.location.origin}${window.location.pathname}?call=${id}`;
    console.log("[LOG] Cập nhật mã QR cho link:", callUrl);
    
    qrcodeDiv.innerHTML = ""; // Clear cũ
    new QRCode(qrcodeDiv, {
        text: callUrl,
        width: 150,
        height: 150
    });
}

// 3. Khởi tạo PeerJS
function initPeer(customId = null) {
    console.log("[LOG] Đang thiết lập Peer với ID:", customId || "Ngẫu nhiên");
    
    if (peer) peer.destroy();

    peer = new Peer(customId, {
        config: { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] },
        debug: 1
    });

    peer.on('open', (id) => {
        console.log("[LOG] Kết nối Signaling thành công. ID của bạn là:", id);
        peerIdDisplay.innerText = id;
        updateQRCode(id);
    });

    peer.on('call', (call) => {
        console.log("[LOG] Đang nhận cuộc gọi từ:", call.peer);
        call.answer(localStream);
        call.on('stream', (rStream) => {
            console.log("[LOG] Luồng video đối phương đã bắt đầu.");
            remoteVideo.srcObject = rStream;
        });
    });

    peer.on('error', (err) => {
        console.error("[LOG] Lỗi Peer:", err.type);
        if (err.type === 'unavailable-id') alert("ID này đã có người dùng!");
    });
}

// 4. Xử lý sự kiện
document.getElementById('set-id-btn').onclick = () => {
    const id = myIdInput.value.trim();
    if (id) initPeer(id);
};

document.getElementById('call-btn').onclick = () => {
    const rId = remoteIdInput.value.trim();
    if (!rId || !localStream) {
        console.warn("[LOG] Chưa nhập ID đối phương hoặc chưa bật Camera.");
        return;
    }
    
    console.log("[LOG] Đang thực hiện gọi tới:", rId);
    const call = peer.call(rId, localStream);
    call.on('stream', (rStream) => {
        remoteVideo.srcObject = rStream;
    });
};

// 5. Chạy khi tải trang
window.onload = async () => {
    await startMedia();
    
    // Kiểm tra URL xem có yêu cầu gọi tự động không
    const params = new URLSearchParams(window.location.search);
    const autoCall = params.get('call');

    initPeer(); // Tạo Peer mặc định

    if (autoCall) {
        console.log("[LOG] Tự động điền ID gọi:", autoCall);
        remoteIdInput.value = autoCall;
        setTimeout(() => {
            console.log("[LOG] Tự động nhấn nút gọi sau 2s...");
            document.getElementById('call-btn').click();
        }, 2000);
    }
};