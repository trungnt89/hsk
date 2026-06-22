export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { method, query, body } = req;
    const p = { ...query, ...body };
	
	const token   = p.token;
	if(token != process.env.PWTOKEN){
		return res.status(400).json({ error: "Token "+token+" is invalid!" });
	}else{
		 return res.status(200).json({ sucess: "true" });
	}
}

