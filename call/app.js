/**
 * APP: Safari Optimized Video Call
 * Quy tắc: Ghi log đầy đủ, fix lỗi auto-play trên iOS Safari.
 */

let localStream;
let peer;
let currentCall = null;

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const peerIdDisplay = document.getElementById('peer-id-display');
const myIdInput = document.getElementById('my-id-input');
const remoteIdInput = document.getElementById('remote-id');
const qrcodeDiv = document.getElementById('qrcode');
const callBtn = document.getElementById('call-btn');
const endBtn = document.getElementById('end-btn');

// 1. Khởi tạo Media - Safari yêu cầu quyền cụ thể
async function startMedia() {
    console.log("[LOG] Safari: Đang yêu cầu Media Access...");
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user" }, // Ưu tiên camera trước cho mobile
            audio: true 
        });
        localStream = stream;
        localVideo.srcObject = stream;
        
        // Fix lỗi Safari không tự chạy video dù đã có autoplay
        localVideo.play().catch(e => console.log("[LOG] Safari Autoplay Blocked:", e));
        
        console.log("[LOG] Media khởi tạo thành công.");
    } catch (e) {
        console.error("[LOG] Lỗi Media thiết bị:", e);
        alert("Lỗi: Safari yêu cầu HTTPS và quyền Camera/Micro.");
    }
}

// 2. Tạo QR Code
function updateQRCode(id) {
    const url = `${window.location.origin}${window.location.pathname}?call=${id}`;
    qrcodeDiv.innerHTML = "";
    new QRCode(qrcodeDiv, { text: url, width: 150, height: 150 });
    console.log("[LOG] QR đã sẵn sàng cho ID:", id);
}

// 3. Logic xử lý cuộc gọi
function setupCallListeners(call) {
    currentCall = call;
    callBtn.style.display = "none";
    endBtn.style.display = "block";

    call.on('stream', (rStream) => {
        console.log("[LOG] Nhận luồng video từ đối phương.");
        remoteVideo.srcObject = rStream;
        remoteVideo.play().catch(e => console.log("[LOG] Remote Video Play Error:", e));
    });

    call.on('close', () => {
        console.log("[LOG] Cuộc gọi kết thúc từ phía bên kia.");
        cleanupAfterCall();
    });

    call.on('error', (err) => {
        console.error("[LOG] Lỗi cuộc gọi:", err);
        cleanupAfterCall();
    });
}

function cleanupAfterCall() {
    console.log("[LOG] Đang ngắt kết nối và dọn dẹp...");
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
    
    // Sử dụng STUN của Google để vượt qua NAT trên mạng di động 4G/5G
    peer = new Peer(customId, {
        config: { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] }
    });

    peer.on('open', (id) => {
        console.log("[LOG] Đã kết nối PeerServer. ID:", id);
        peerIdDisplay.innerText = id;
        updateQRCode(id);
    });

    peer.on('call', (call) => {
        console.log("[LOG] Có cuộc gọi đến từ:", call.peer);
        if (confirm("Chấp nhận cuộc gọi từ " + call.peer + "?")) {
            call.answer(localStream);
            setupCallListeners(call);
        }
    });

    peer.on('error', (err) => {
        console.error("[LOG] PeerJS Error:", err.type);
    });
}

// 5. Sự kiện tương tác
document.getElementById('set-id-btn').onclick = () => {
    const val = myIdInput.value.trim();
    if (val) initPeer(val);
};

callBtn.onclick = () => {
    const rId = remoteIdInput.value.trim();
    if (!rId) return alert("Vui lòng nhập ID người nhận.");
    console.log("[LOG] Bắt đầu gọi tới:", rId);
    const call = peer.call(rId, localStream);
    setupCallListeners(call);
};

endBtn.onclick = () => {
    console.log("[LOG] Bạn đã nhấn nút Kết thúc.");
    cleanupAfterCall();
};

// Khởi chạy
window.onload = async () => {
    await startMedia();
    initPeer();
    
    const autoCallId = new URLSearchParams(window.location.search).get('call');
    if (autoCallId) {
        remoteIdInput.value = autoCallId;
        console.log("[LOG] Tự động gọi sau 2s...");
        setTimeout(() => callBtn.click(), 2000);
    }
};