const { google } = require('googleapis');
const { Readable } = require('stream');

export default async function handler(req, res) {
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
        scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    const { method } = req;
    const { id } = req.query;

    try {
        // --- 1. STREAM FILE (ĐỂ PHÁT NHẠC) ---
        if (method === 'GET' && id) {
            console.log(`[LOG] Đang stream file ID: ${id}`);
            const metadata = await drive.files.get({ fileId: id, fields: 'mimeType, size' });
            const response = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
            
            res.setHeader('Content-Type', metadata.data.mimeType);
            if (metadata.data.size) res.setHeader('Content-Length', metadata.data.size);
            return response.data.pipe(res);
        }

        // --- 2. LIST FILES (LẤY DANH SÁCH MP3) ---
        if (method === 'GET') {
            console.log("[LOG] Truy vấn danh sách file mp3 từ Drive...");
            const response = await drive.files.list({
                q: "mimeType='audio/mpeg' and trashed=false",
                fields: 'files(id, name)',
                pageSize: 20
            });
            return res.status(200).json(response.data.files);
        }

        // --- 3. UPLOAD FILE (LƯU GHI ÂM) ---
        if (method === 'POST') {
            const { name, base64Audio } = req.body;
            console.log(`[LOG] Bắt đầu upload file: ${name}`);

            const buffer = Buffer.from(base64Audio, 'base64');
            const bufferStream = new Readable();
            bufferStream.push(buffer);
            bufferStream.push(null);

            const fileMetadata = {
                name: name.endsWith('.mp3') ? name : `${name}.mp3`,
                mimeType: 'audio/mpeg'
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

            console.log(`[LOG] Upload thành công. File ID mới: ${file.data.id}`);
            return res.status(200).json({ success: true, id: file.data.id });
        }

    } catch (err) {
        console.error(`[LOG] Lỗi tại API: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
}