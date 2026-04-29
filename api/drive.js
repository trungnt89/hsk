const { google } = require('googleapis');
const { Readable } = require('stream');

export default async function handler(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Yêu cầu đăng nhập." });

    const token = authHeader.split(' ')[1];
    const oauth2Client = new google.auth.OAuth2(
        process.env.OAUTH_CLIENT_ID,
        process.env.OAUTH_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ access_token: token });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    try {
        const { method } = req;

        // --- LẤY DANH SÁCH FILE ---
        if (method === 'GET') {
            const response = await drive.files.list({
                q: "trashed=false and (mimeType contains 'audio/' or mimeType = 'video/mp4')",
                fields: 'files(id, name, mimeType)',
                pageSize: 50
            });
            return res.status(200).json(response.data.files);
        }

        // --- LƯU FILE GHI ÂM (MP3) ---
        if (method === 'POST') {
            const { name, base64Audio } = req.body;
            const buffer = Buffer.from(base64Audio, 'base64');
            const bufferStream = new Readable();
            bufferStream.push(buffer);
            bufferStream.push(null);

            const fileMetadata = {
                name: name.endsWith('.mp3') ? name : `${name}.mp3`,
                mimeType: 'audio/mpeg',
                parents: ['1Z-YuFfWP5bFhdBdXoXE4qiIlOMpoBB8_'] // ID thư mục của bạn
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
        console.error("[LOG] Lỗi:", err.message);
        return res.status(500).json({ error: err.message });
    }
}

export const config = {
    api: { bodyParser: { sizeLimit: '15mb' } }
};