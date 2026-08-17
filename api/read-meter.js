/* Vercel serverless function: reads a water meter photo via Gemini vision.
   Expects POST { image: "base64..." }
   Returns { serial, reading, confidence }
   Requires GEMINI_API_KEY env var in Vercel.

   Module system: CommonJS (see api/package.json). */

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: "Missing image (base64)" });

  const prompt = `This is a GLOBTECH water meter photo. Return ONLY a JSON object, nothing else. No explanation, no markdown.

Extract:
1. "serial" — stamped on the BRASS RIM EDGE (e.g. "5043/22"). NOT on the dial face.
2. "reading" — from the ODOMETER WHEELS at the top of the dial (black digits = whole kL, red digits = decimals). Multiply by 1000 to convert to litres. IGNORE the "CM/L" number printed at the bottom of the dial — that is a certification number, not the reading.

Example: if odometer shows 00682.05, return reading as "682050".

{"serial": "", "reading": "", "confidence": "high"}`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/jpeg", data: image } },
            ],
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 300,
          },
        }),
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(502).json({ error: "Gemini API error", detail: err.slice(0, 500) });
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();

    try {
      const parsed = JSON.parse(clean);
      return res.status(200).json({
        serial: parsed.serial || "",
        reading: parsed.reading || "",
        confidence: parsed.confidence || "unknown",
      });
    } catch {
      return res.status(200).json({ serial: "", reading: "", confidence: "low", raw: clean.slice(0, 200) });
    }
  } catch (e) {
    return res.status(502).json({ error: "Failed to call Gemini", detail: e.message });
  }
};
