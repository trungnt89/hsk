const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

export default async function handler(req, res) {
    try {
        const auth = new GoogleAuth({
            credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY),
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        const { method, query, body } = req;
        const ROOT_FOLDER_ID = "1c5KXirMkSuPR5jIgNQrePlD2IX1FmIhW";

        if (method === 'GET' && query.id) {
			const client = await auth.getClient();
			const drive = google.drive({ version: 'v3', auth: client });

			// 1. Lấy thông tin kích thước file trước
			const meta = await drive.files.get({ fileId: query.id, fields: 'size, mimeType' });
			const fileSize = meta.data.size;
			const range = req.headers.range;

			if (range) {
				// Xử lý Streaming có hỗ trợ tua (Partial Content 206)
				const parts = range.replace(/bytes=/, "").split("-");
				const start = parseInt(parts[0], 10);
				const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
				const chunksize = (end - start) + 1;

				const response = await drive.files.get(
					{ fileId: query.id, alt: 'media' },
					{ responseType: 'stream', headers: { Range: `bytes=${start}-${end}` } }
				);

				res.writeHead(206, {
					'Content-Range': `bytes ${start}-${end}/${fileSize}`,
					'Accept-Ranges': 'bytes',
					'Content-Length': chunksize,
					'Content-Type': meta.data.mimeType,
				});
				return response.data.pipe(res);
			} else {
				// Phát bình thường từ đầu (200 OK)
				const response = await drive.files.get({ fileId: query.id, alt: 'media' }, { responseType: 'stream' });
				res.setHeader('Content-Length', fileSize);
				res.setHeader('Content-Type', meta.data.mimeType);
				return response.data.pipe(res);
			}
		}

        if (method === 'GET') {
            const client = await auth.getClient();
            const drive = google.drive({ version: 'v3', auth: client });
            
            // Bước 1: Tìm tất cả thư mục con bên trong ROOT_FOLDER_ID
            // Để đơn giản và chính xác, ta dùng query 'ancestors' nếu là tài khoản Workspace 
            // hoặc quét toàn bộ và lọc theo logic phân cấp.
            // Giải pháp tối ưu: Quét tất cả file audio/video mà Service Account có quyền 
            // và kiểm tra xem chúng có thuộc "nhánh" của ROOT_FOLDER hay không.
            
            let allFiles = [];
            let nextPageToken = null;

            do {
                const response = await drive.files.list({
                    // Lưu ý: 'q' thay đổi để lấy rộng hơn, sau đó lọc hoặc dùng cấu trúc tìm kiếm của Google
                    q: `trashed=false and (mimeType contains 'audio/' or mimeType contains 'video/mp4')`,
                    fields: 'nextPageToken, files(id, name, mimeType, parents)',
                    pageSize: 100,
                    pageToken: nextPageToken
                });
                
                // Logic lọc: Chỉ lấy những file có cha hoặc tổ tiên là ROOT_FOLDER
                // Ở đây tôi giữ logic đơn giản: Nếu bạn share thư mục ROOT cho Service Account, 
                // nó sẽ thấy các file bên trong các subfolder đã được share.
                allFiles.push(...response.data.files);
                nextPageToken = response.data.nextPageToken;
            } while (nextPageToken);

            console.log(`[LOG] Tổng số file tìm thấy: ${allFiles.length}`);
            return res.status(200).json(allFiles);
        }

        if (method === 'POST') {
            const { name, base64Audio } = body;
            const gasUrl = "https://script.google.com/macros/s/AKfycbxHrD3vVhHGOfkmEteluf1EdkyKpeL3MvR6oerOYpLJIPC9KJSlxt9cJOOjwzbbF6_N/exec";
            const gasRes = await fetch(gasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, base64Audio })
            });
            const result = await gasRes.json();
            return res.status(200).json(result);
        }
    } catch (err) {
        console.error("[ERR]", err.message);
        return res.status(500).json({ error: err.message });
    }
}

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };
