const { google } = require('googleapis');
const { Readable } = require('stream');

export default async function handler(req, res) {
    // Khởi tạo Auth từ biến môi trường GOOGLE_SERVICE_ACCOUNT_KEY
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
            console.log(`[LOG] Đang stream file ID: ${id}`);
            const metadata = await drive.files.get({ fileId: id, fields: 'mimeType, size' });
            const response = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
            
            res.setHeader('Content-Type', metadata.data.mimeType);
            if (metadata.data.size) res.setHeader('Content-Length', metadata.data.size);
            return response.data.pipe(res);
        }

        // --- 2. LẤY DANH SÁCH (AUDIO & MP4) ---
        if (method === 'GET') {
            console.log("[LOG] Đang truy vấn danh sách Audio và MP4...");
            const response = await drive.files.list({
                // Lọc tất cả audio và video mp4
                q: "(mimeType contains 'audio/' or mimeType = 'video/mp4') and trashed=false",
                fields: 'files(id, name, mimeType)',
                pageSize: 100
            });
            return res.status(200).json(response.data.files);
        }

        // --- 3. GHI FILE (UPLOAD) ---
        // --- 3. GHI FILE (UPLOAD) ---
		if (method === 'POST') {
			const { name, base64Audio } = req.body;
			console.log(`[LOG] Bắt đầu upload file: ${name}`);

			const buffer = Buffer.from(base64Audio, 'base64');
			const bufferStream = new Readable();
			bufferStream.push(buffer);
			bufferStream.push(null);

			const fileMetadata = {
				name: name.endsWith('.mp3') ? name : `${name}.mp3`,
				mimeType: 'audio/mpeg',
				// THÊM DÒNG NÀY: Dán ID thư mục của bạn vào đây
				parents: ['ID_THU_MUC_CUA_BAN'] 
			};

			const media = {
				mimeType: 'audio/mpeg',
				body: bufferStream,
			};

			const file = await drive.files.create({
				resource: fileMetadata,
				media: media,
				fields: 'id',
			});

			console.log(`[LOG] Upload thành công vào thư mục chỉ định. ID: ${file.data.id}`);
			return res.status(200).json({ success: true, id: file.data.id });
		}

    } catch (err) {
        console.error(`[LOG] Lỗi hệ thống: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
}