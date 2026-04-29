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
        if (method === 'GET' && id) {
            const metadata = await drive.files.get({ fileId: id, fields: 'mimeType, size' });
            const response = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
            res.setHeader('Content-Type', metadata.data.mimeType);
            if (metadata.data.size) res.setHeader('Content-Length', metadata.data.size);
            return response.data.pipe(res);
        }

        if (method === 'GET') {
            const response = await drive.files.list({
                q: "(mimeType contains 'audio/' or mimeType = 'video/mp4') and trashed=false",
                fields: 'files(id, name, mimeType)',
                pageSize: 100
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

            const media = {
                mimeType: 'audio/mpeg',
                body: bufferStream,
            };

            const file = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id',
            });

            return res.status(200).json({ success: true, id: file.data.id });
        }

    } catch (err) {
        console.error(`[LOG] Lỗi: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
}

// QUAN TRỌNG: Cấu hình giới hạn dung lượng body cho Vercel
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', 
    },
  },
};