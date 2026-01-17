/**
 * HÀM LẤY TẤT CẢ ẢNH TRONG THƯ MỤC DRIVE
 */
function getSlideImages() {
  try {
    // IMAGE_FOLDER_ID phải được định nghĩa trong file CONFIG
    const folderId = CONFIG.IMAGE_FOLDER_ID; 
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    const images = [];

    // Các định dạng ảnh hỗ trợ
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    while (files.hasNext()) {
      let file = files.next();
      if (allowedTypes.includes(file.getMimeType())) {
        images.push({
          id: file.getId(),
          name: file.getName(),
          url: "https://drive.google.com/uc?export=view&id=" + file.getId()
        });
      }
    }
    
    writeLog("DRIVE_FETCH", `Lấy danh sách ảnh thành công: ${images.length} tệp`);
    console.log(images);
    return images;
  } catch (e) {
    writeLog("DRIVE_ERR", "Không thể lấy ảnh từ Drive: " + e.message);
    return [];
  }
}