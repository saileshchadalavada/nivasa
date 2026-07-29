/* Vercel serverless function: reads a water meter photo via Gemini Flash vision.
   Expects POST { image: "base64..." }
   Returns { serial, reading, confidence }
   Requires GEMINI_API_KEY env var in Vercel. */

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: "Missing image (base64)" });

  const prompt = `You are reading an Indian apartment building water meter (GLOBTECH brand).

Look at this meter photo and extract TWO things:

1. SERIAL: The meter serial number stamped on the brass rim (format like "4438/22" or "5310/22"). Look at the rim/edge of the meter face, usually at the bottom.

2. READING: The odometer reading in kL. Black digits are whole kL, red digits are the decimal fraction. Read all digits left to right. If a digit is between two numbers (mid-roll), pick the lower one.

Return ONLY valid JSON, no markdown, no backticks:
{"serial": "NNNN/NN", "reading": "NNNNN.N", "confidence": "high|medium|low"}

If you cannot read the serial, set it to "".
If you cannot read the reading, set it to "".`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
          generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
        }),
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(502).json({ error: "Gemini API error", detail: err.slice(0, 300) });
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
      return res.status(200).json({ serial: "", reading: "", confidence: "low", raw: clean });
    }
  } catch (e) {
    return res.status(502).json({ error: "Failed to call Gemini", detail: e.message });
  }
}
