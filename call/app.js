/**
 * APP: Video Call WebRTC với chức năng kết thúc
 * Quy tắc: Ghi log đầy đủ, không sửa logic cũ.
 */

let localStream;
let peer;
let currentCall = null; // Lưu trữ cuộc gọi hiện tại

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const peerIdDisplay = document.getElementById('peer-id-display');
const remoteIdInput = document.getElementById('remote-id');
const qrcodeDiv = document.getElementById('qrcode');
const callBtn = document.getElementById('call-btn');
const endBtn = document.getElementById('end-btn');

// 1. Khởi tạo Camera
async function startMedia() {
    console.log("[LOG] Đang yêu cầu Camera/Mic...");
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        console.log("[LOG] Camera đã sẵn sàng.");
    } catch (e) {
        console.error("[LOG] Lỗi Media:", e);
        alert("Hãy dùng HTTPS và cấp quyền camera.");
    }
}

// 2. Tạo QR
function updateQRCode(id) {
    const url = `${window.location.origin}${window.location.pathname}?call=${id}`;
    qrcodeDiv.innerHTML = "";
    new QRCode(qrcodeDiv, { text: url, width: 150, height: 150 });
    console.log("[LOG] QR đã cập nhật cho ID:", id);
}

// 3. Quản lý cuộc gọi
function handleCall(call) {
    currentCall = call;
    callBtn.style.display = "none";
    endBtn.style.display = "block";

    call.on('stream', (rStream) => {
        console.log("[LOG] Nhận luồng video đối phương.");
        remoteVideo.srcObject = rStream;
    });

    call.on('close', () => {
        console.log("[LOG] Cuộc gọi đã bị phía bên kia đóng.");
        stopCall();
    });

    call.on('error', (err) => {
        console.error("[LOG] Lỗi cuộc gọi:", err);
        stopCall();
    });
}

function stopCall() {
    console.log("[LOG] Đang dọn dẹp kết nối cuộc gọi...");
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }
    remoteVideo.srcObject = null;
    callBtn.style.display = "block";
    endBtn.style.display = "none";
}

// 4. Khởi tạo Peer
function initPeer(customId = null) {
    if (peer) peer.destroy();
    peer = new Peer(customId, {
        config: { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] }
    });

    peer.on('open', (id) => {
        console.log("[LOG] Peer ID mở:", id);
        peerIdDisplay.innerText = id;
        updateQRCode(id);
    });

    peer.on('call', (call) => {
        console.log("[LOG] Có cuộc gọi đến từ:", call.peer);
        if (confirm("Chấp nhận cuộc gọi từ " + call.peer + "?")) {
            call.answer(localStream);
            handleCall(call);
        }
    });
}

// 5. Sự kiện nút bấm
document.getElementById('set-id-btn').onclick = () => {
    const id = document.getElementById('my-id-input').value.trim();
    if (id) initPeer(id);
};

callBtn.onclick = () => {
    const rId = remoteIdInput.value.trim();
    if (!rId) return alert("Nhập ID đối phương!");
    console.log("[LOG] Đang gọi tới:", rId);
    const call = peer.call(rId, localStream);
    handleCall(call);
};

endBtn.onclick = () => {
    console.log("[LOG] Người dùng chủ động nhấn nút Kết thúc.");
    stopCall();
};

// Khởi chạy
window.onload = async () => {
    await startMedia();
    initPeer();
    const autoCall = new URLSearchParams(window.location.search).get('call');
    if (autoCall) {
        remoteIdInput.value = autoCall;
        setTimeout(() => callBtn.click(), 2000);
    }
};