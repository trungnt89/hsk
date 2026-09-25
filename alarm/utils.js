/**
 * utils.js - Các tiện ích hỗ trợ phân tích YouTube, định dạng giờ và tính toán lịch reo (JavaScript thuần)
 */
function extractYouTubeId(urlOrId) {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const patterns = [
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube-nocookie\.com\/embed\/([\w-]{11})/,
  ];

  for (const regex of patterns) {
    const match = trimmed.match(regex);
    if (match && match[1]) return match[1];
  }
  return null;
}

function formatTimeHM(date = new Date()) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatTimeHMS(date = new Date()) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
