
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  // 1. Lấy hoặc khởi tạo đối tượng options (args[1])
  let url = args[0];
  let options = args[1] || {};

  // 2. Khởi tạo đối tượng headers nếu chưa có
  options.headers = options.headers || {};

  // 3. Lấy token từ sessionStorage (hoặc nơi bạn lưu trữ)
  const token = sessionStorage.getItem('token');

  // 4. Nếu có token, tự động thêm vào Header
  if (token) {
    // Nếu options.headers là một đối tượng Headers thuần của Fetch API
    if (options.headers instanceof Headers) {
      options.headers.set('Authorization', `${token}`);
    } else {
      // Nếu options.headers là một Object thường {}
      options.headers['Authorization'] = `${token}`;
    }
  }

  // Cập nhật lại args[1] trước khi gọi fetch gốc
  args[1] = options;

  try {
    // Gọi fetch gốc với args đã được thêm Header
    const response = await originalFetch(...args);

    // Bắt lỗi 401 tại đây
    if (response.status === 401) {
      console.warn("Token không hợp lệ hoặc hết hạn! Đang chuyển hướng...");
      
      // Xóa token cũ nếu cần
      sessionStorage.removeItem('token'); 
      
      // Chuyển hướng về trang login
      window.location.href = 'https://hsk-gilt.vercel.app/index.html';
    }
    return response;
  } catch (error) {
    return Promise.reject(error);
  }
};
