const { google } = require('googleapis');
const { Readable } = require('stream');

export default async function handler(req, res) {
    // Khởi tạo Auth từ biến môi trường
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
        scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    const { method } = req;
    const { id } = req.query;

    try {
        // --- 1. PHÁT FILE (STREAM) ---
        if (method === 'GET' && id) {
            const metadata = await drive.files.get({ fileId: id, fields: 'mimeType, size' });
            const response = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
            
            res.setHeader('Content-Type', metadata.data.mimeType);
            if (metadata.data.size) res.setHeader('Content-Length', metadata.data.size);
            return response.data.pipe(res);
        }

        // --- 2. LẤY DANH SÁCH (AUDIO & MP4) ---
        if (method === 'GET') {
            const response = await drive.files.list({
                q: "(mimeType contains 'audio/' or mimeType = 'video/mp4') and trashed=false",
                fields: 'files(id, name, mimeType)',
                pageSize: 100,
                supportsAllDrives: true,
                includeItemsFromAllDrives: true
            });
            return res.status(200).json(response.data.files);
        }

        // --- 3. GHI FILE (UPLOAD) ---
        // --- 3. GHI FILE (UPLOAD) ---
		if (method === 'POST') {
			const { name, base64Audio } = req.body;
			const buffer = Buffer.from(base64Audio, 'base64');
			const bufferStream = new Readable();
			bufferStream.push(buffer);
			bufferStream.push(null);

			const fileMetadata = {
				name: name.endsWith('.mp3') ? name : `${name}.mp3`,
				mimeType: 'audio/mpeg',
				// Đảm bảo ID thư mục này là chính xác
				parents: ['1Z-YuFfWP5bFhdBdXoXE4qiIlOMpoBB8_'] 
			};

			const media = {
				mimeType: 'audio/mpeg',
				body: bufferStream,
			};

			// CHỈNH SỬA QUAN TRỌNG Ở ĐÂY
			const file = await drive.files.create({
				resource: fileMetadata,
				media: media,
				fields: 'id',
				// Bắt buộc thêm 2 dòng này để làm việc với thư mục được chia sẻ
				supportsAllDrives: true,
				keepRevisionForever: false
			});

			console.log(`[LOG] Upload thành công. ID: ${file.data.id}`);
			return res.status(200).json({ success: true, id: file.data.id });
		}

    } catch (err) {
        console.error(`[LOG] Lỗi hệ thống: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
}

// Cấu hình giới hạn dung lượng để upload được file ghi âm dài
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '15mb',
        },
    },
};