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

  const prompt = `You are reading an Indian GLOBTECH water meter. The meter has a round white dial face inside a brass ring, mounted on a blue pipe.

DIAL FACE LAYOUT (top to bottom):
- Top: "GLOBTECH" brand name
- Below that: THE ODOMETER — a row of digit wheels in small boxes showing the water reading. Left digits are BLACK (whole kL), rightmost digits are RED/PINK (decimal kL). This is marked with "H" on the left and "KL" on the right.
- Middle: a rotating star/gear indicator
- Below that: text like "CONFIRMING TO ISO 4064", "Class B-20mm", "Multijet Magnetic", "IP 68"
- A small red circular sub-dial (×0.0001)
- Bottom: "IS779:1994", ISI logo, and a "CM/L" number like "CM/L 6200106987"

IMPORTANT - DO NOT CONFUSE THESE:
- The ODOMETER (top, digit wheels in boxes) = the water READING I need
- The CM/L number (bottom, printed text) = a certification/model number, IGNORE IT
- The reading is typically 5-8 digits showing hundreds of kL, like "00682.056"

SERIAL NUMBER:
- Stamped/engraved INTO the brass rim EDGE (not printed on the dial face)
- Usually vertical text on the left or bottom rim
- Format: "NNNN/NN" like "5043/22" or "4438/22"
- It is physically stamped into the metal, not printed

WHAT TO RETURN:
- "serial": the NNNN/NN from the brass rim edge
- "reading": the odometer digits as a decimal number (e.g. "682.056" from black 00682 + red 056). Convert to litres by multiplying by 1000 (so 682.056 KL becomes "682056"). Return the number in LITRES.

Return ONLY valid JSON, no markdown, no backticks:
{"serial": "NNNN/NN", "reading": "NNNNNN.N", "confidence": "high|medium|low"}

If you cannot read the serial, set serial to "".
If you cannot read the reading, set reading to "".`;

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