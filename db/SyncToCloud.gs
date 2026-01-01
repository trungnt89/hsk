// Google Apps Script Code
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const folder = getFolder();
  // Xóa file cũ nếu tồn tại và tạo file mới với tên là KEY
  const files = folder.getFilesByName(data.key);
  while (files.hasNext()) { files.next().setTrashed(true); }
  folder.createFile(data.key, JSON.stringify(data.value), MimeType.PLAIN_TEXT);
  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  const key = e.parameter.key;
  const folder = getFolder();
  const files = folder.getFilesByName(key);
  if (files.hasNext()) {
    const content = files.next().getBlob().getDataAsString();
    return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput("null").setMimeType(ContentService.MimeType.TEXT);
}

function getFolder() {
  const folderName = "IndexedDB_Sync";
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}