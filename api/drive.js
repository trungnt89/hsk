const { google } = require('googleapis');
const { Readable } = require('stream');

export default async function handler(req, res) {
    // 1. Lấy Token từ Header Authorization (Bearer <token>)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "Thiếu Token từ trình duyệt." });
    }
    const tokenFromClient = authHeader.split(' ')[1];

    // 2. Khởi tạo OAuth2 Client bằng Client ID/Secret của bạn
    const oauth2Client = new google.auth.OAuth2(
        process.env.OAUTH_CLIENT_ID,
        process.env.OAUTH_CLIENT_SECRET
    );

    // 3. Sử dụng token được gửi từ Client (có thể là access_token hoặc refresh_token)
    oauth2Client.setCredentials({
        access_token: tokenFromClient // Hoặc refresh_token tùy vào cách bạn lấy
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const { method } = req;
    const { id } = req.query;

    try {
        if (method === 'GET' && id) {
            const metadata = await drive.files.get({ fileId: id, fields: 'mimeType, size' });
            const response = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
            res.setHeader('Content-Type', metadata.data.mimeType);
            return response.data.pipe(res);
        }

        if (method === 'GET') {
            const response = await drive.files.list({
                q: "(mimeType contains 'audio/' or mimeType = 'video/mp4') and trashed=false",
                fields: 'files(id, name, mimeType)',
                pageSize: 50
            });
            return res.status(200).json(response.data.files);
        }

        if (method === 'POST') {
            const { name, base64Audio } = req.body;
            const buffer = Buffer.from(base64Audio, 'base64');
            const bufferStream = new Readable();
            bufferStream.push(buffer);
            bufferStream.push(null);

            const fileMetadata = {
                name: name.endsWith('.mp3') ? name : `${name}.mp3`,
                mimeType: 'audio/mpeg',
                parents: ['1Z-YuFfWP5bFhdBdXoXE4qiIlOMpoBB8_'] 
            };

            const media = { mimeType: 'audio/mpeg', body: bufferStream };
            const file = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });
            return res.status(200).json({ success: true, id: file.data.id });
        }
    } catch (err) {
        console.error(`[LOG] Lỗi: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
}

export const config = {
    api: { bodyParser: { sizeLimit: '15mb' } }
};