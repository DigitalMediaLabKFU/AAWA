export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
  
    const key   = process.env.GEMINI_KEY;              // ← секрет
    const model = 'gemini-2.5-flash-preview-05-20';                        // или 'gemini-1.5-flash'
    const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  
    try {
      const upstream = await fetch(url, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(req.body)
      });
  
      res.status(upstream.status).send(await upstream.text());
    } catch (err) {
      console.error('proxy error', err);
      res.status(500).json({ error: 'proxy failure' });
    }
  }
  