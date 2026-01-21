let localStream;
const peer = new Peer(); // Tạo một ID ngẫu nhiên từ server PeerJS

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const peerIdDisplay = document.getElementById('peer-id-display');
const callBtn = document.getElementById('call-btn');
const remoteIdInput = document.getElementById('remote-id');

// 1. Lấy luồng video từ Camera
async function initMedia() {
    console.log("[LOG] Đang yêu cầu quyền truy cập thiết bị...");
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        console.log("[LOG] Camera đã sẵn sàng.");
    } catch (err) {
        console.error("[LOG] Lỗi truy cập camera: ", err);
        alert("Vui lòng cho phép quyền truy cập Camera");
    }
}

// 2. Sự kiện khi PeerJS khởi tạo xong
peer.on('open', (id) => {
    console.log("[LOG] Đã kết nối tới Signaling Server. ID của bạn là: " + id);
    peerIdDisplay.innerText = id;
});

// 3. Xử lý khi có cuộc gọi đến (Người nhận)
peer.on('call', (call) => {
    console.log("[LOG] Có cuộc gọi đến từ: " + call.peer);
    
    // Trả lời cuộc gọi bằng stream của mình
    call.answer(localStream);
    
    call.on('stream', (remoteStream) => {
        console.log("[LOG] Đã nhận được stream của người gọi.");
        remoteVideo.srcObject = remoteStream;
    });
});

// 4. Xử lý khi chủ động gọi (Người gọi)
callBtn.addEventListener('click', () => {
    const remoteId = remoteIdInput.value;
    if (!remoteId) {
        alert("Vui lòng nhập ID người nhận");
        return;
    }

    console.log("[LOG] Đang gọi tới: " + remoteId);
    const call = peer.call(remoteId, localStream);

    call.on('stream', (remoteStream) => {
        console.log("[LOG] Người nhận đã bắt máy, đang hiển thị video.");
        remoteVideo.srcObject = remoteStream;
    });

    call.on('error', (err) => {
        console.error("[LOG] Lỗi cuộc gọi: ", err);
    });
});

// Khởi chạy camera ngay khi load trang
initMedia();