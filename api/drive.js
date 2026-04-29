const { google } = require('googleapis');
const { Readable } = require('stream');

export default async function handler(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Thiếu Refresh Token" });

    const clientRefreshToken = authHeader.split(' ')[1];
    const oauth2Client = new google.auth.OAuth2(
        process.env.OAUTH_CLIENT_ID,
        process.env.OAUTH_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ refresh_token: clientRefreshToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    try {
        const { method, query, body } = req;

        // 1. LẤY DANH SÁCH FILE AUDIO
        if (method === 'GET' && !query.id) {
            const response = await drive.files.list({
                q: "trashed=false and (mimeType contains 'audio/' or mimeType = 'video/mp4')",
                fields: 'files(id, name, mimeType)',
                pageSize: 50
            });
            return res.status(200).json(response.data.files);
        }

        // 2. TẢI FILE ĐỂ PHÁT
        if (method === 'GET' && query.id) {
            const response = await drive.files.get({ fileId: query.id, alt: 'media' }, { responseType: 'stream' });
            res.setHeader('Content-Type', 'audio/mpeg');
            return response.data.pipe(res);
        }

        // 3. UPLOAD FILE GHI ÂM
        if (method === 'POST') {
            const { name, base64Audio } = body;
            const buffer = Buffer.from(base64Audio, 'base64');
            const bufferStream = new Readable();
            bufferStream.push(buffer);
            bufferStream.push(null);

            const fileMetadata = {
                name: name.endsWith('.mp3') ? name : `${name}.mp3`,
                mimeType: 'audio/mpeg',
                parents: ['1KCfoWrPS5RtDzsFFWINH3_Xq8MApjXlm'] // ID Thư mục của bạn
            };

            const media = { mimeType: 'audio/mpeg', body: bufferStream };
            await drive.files.create({ resource: fileMetadata, media: media, fields: 'id' });
            return res.status(200).json({ success: true });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };