export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }

    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, error: "Token is required" });
        }

        if (token !== process.env.PWTOKEN) {
            return res.status(401).json({ success: false, error: "Invalid token" });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}
