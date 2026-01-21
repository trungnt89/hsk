let localStream;
let peer;
let qrcode; // Biến để lưu đối tượng QRious

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const peerIdDisplay = document.getElementById('peer-id-display');
const myIdInput = document.getElementById('my-id-input'); // Lấy thêm input của mình
const setIdBtn = document.getElementById('set-id-btn');
const remoteIdInput = document.getElementById('remote-id');
const callBtn = document.getElementById('call-btn');
const qrCodeCanvas = document.getElementById('qr-code');

// Hàm tạo mã QR
function generateQrCode(text) {
    if (!qrcode) {
        qrcode = new QRious({
            element: qrCodeCanvas,
            size: 200,
            value: text
        });
    } else {
        qrcode.value = text;
    }
    console.log("[LOG] Đã tạo QR code cho: " + text);
}

// Hàm khởi tạo Peer với ID tùy chỉnh
function initPeer(customId = null) {
    if (peer) {
        console.log("[LOG] Đang hủy Peer cũ và tạo Peer mới.");
        peer.destroy();
    }

    peer = new Peer(customId, {
        config: { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] },
        debug: 3 // Log mức độ chi tiết của PeerJS
    });

    peer.on('open', (id) => {
        console.log("[LOG] Đã mở cổng kết nối. ID của bạn là: " + id);
        peerIdDisplay.innerText = id;
        
        // Tạo link chia sẻ và cập nhật QR code
        const shareLink = window.location.origin + window.location.pathname + "?call=" + id;
        console.log("[LOG] Link chia sẻ của bạn: " + shareLink);
        generateQrCode(shareLink); // Cập nhật QR code với link gọi
    });

    peer.on('call', (call) => {
        console.log("[LOG] Nhận cuộc gọi từ: " + call.peer);
        if (confirm(`Bạn có muốn nhận cuộc gọi từ ${call.peer} không?`)) { // Thêm xác nhận
            call.answer(localStream);
            call.on('stream', (remoteStream) => {
                remoteVideo.srcObject = remoteStream;
                console.log("[LOG] Đã hiển thị video đối phương.");
            });
            call.on('close', () => {
                console.log("[LOG] Cuộc gọi đã kết thúc.");
                remoteVideo.srcObject = null; // Xóa video khi kết thúc
            });
        } else {
            console.log("[LOG] Từ chối cuộc gọi từ: " + call.peer);
            call.close(); // Đóng cuộc gọi nếu từ chối
        }
    });

    peer.on('error', (err) => {
        console.error("[LOG] Lỗi PeerJS: ", err);
        if(err.type === 'unavailable-id') {
            alert("ID này đã có người dùng, hãy chọn số khác!");
            peerIdDisplay.innerText = "Lỗi ID!";
        } else {
            alert("Có lỗi xảy ra với PeerJS: " + err.message);
        }
    });
}

// 2. Thiết lập ID