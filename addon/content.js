// Tạo một thẻ div mới
const overlay = document.createElement('div');

// Thiết lập style cho div (Logic hiển thị to tướng giữa màn hình)
Object.assign(overlay.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: '999999',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '40px',
    borderRadius: '20px',
    fontSize: '100px',
    fontWeight: 'bold',
    fontFamily: 'Arial, sans-serif',
    pointerEvents: 'none', // Cho phép click xuyên qua chữ
    textAlign: 'center',
    boxShadow: '0 0 50px rgba(0,0,0,0.5)'
});

// Gán nội dung
overlay.innerText = 'HELLO WORLD';

// Thêm vào body của trang web hiện tại
document.body.appendChild(overlay);

// Tự động xóa sau 5 giây để không làm phiền trải nghiệm
setTimeout(() => {
    overlay.remove();
}, 5000);