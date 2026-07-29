import React, { useState } from "react";
import Tesseract from "tesseract.js";
import { styles as S, T, css, display, mono, font } from "./styles";

/* Per-flat meter capture. Gemini vision API first, Tesseract fallback.
   You already know the flat, so its expected serial is known — we VERIFY
   the photo's serial against it (soft note on mismatch) and read the reading. */

const norm = (s) => String(s || "").replace(/\s+/g, "").replace(/[^\d/]/g, "").toLowerCase();

/* Convert file to base64 (for the API call) */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* Preprocess for Tesseract fallback */
function preprocess(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1400 / img.width, 1);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      const im = ctx.getImageData(0, 0, w, h), d = im.data;
      for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const v = g > 130 ? 255 : g < 90 ? 0 : g;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      ctx.putImageData(im, 0, 0);
      resolve(c);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/* Tesseract fallback */
async function ocrFallback(file) {
  const canvas = await preprocess(file);
  const { data: { text } } = await Tesseract.recognize(canvas, "eng");
  const sm = text.match(/(\d{3,4})\s*[\/|1]\s*(\d{2})/);
  const serial = sm ? `${sm[1]}/${sm[2]}` : "";
  const cleaned = text.replace(/\d{3,4}\s*[\/|1]\s*\d{2}/, " ");
  const runs = (cleaned.match(/\d[\d .]{3,}\d/g) || []).map((s) => s.replace(/[^\d]/g, ""));
  const reading = runs.sort((a, b) => b.length - a.length)[0] || "";
  return { serial, reading, method: "ocr" };
}

/* Primary: Gemini vision API via /api/read-meter serverless function */
async function extractFromImage(file) {
  try {
    const base64 = await fileToBase64(file);
    const resp = await fetch("/api/read-meter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64 }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.serial || data.reading) return { serial: data.serial || "", reading: data.reading || "", method: "gemini" };
    }
  } catch {}
  // fallback to Tesseract if API unavailable (localhost dev, or API error)
  return ocrFallback(file);
}

export default function MeterCapture({ flat, expectedMeter, onApply, onClose }) {
  const [url, setUrl] = useState("");
  const [serial, setSerial] = useState("");
  const [reading, setReading] = useState("");
  const [status, setStatus] = useState("idle"); // idle | reading | done | error

  const onFile = async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    setUrl(URL.createObjectURL(file));
    setStatus("reading"); setSerial(""); setReading("");
    try {
      const r = await extractFromImage(file);
      setSerial(r.serial); setReading(r.reading); setStatus("done");
    } catch { setStatus("error"); }
  };

  const match = serial ? (norm(serial) === norm(expectedMeter)) : null; // null = unknown
  const apply = () => { if (reading !== "") onApply(parseFloat(String(reading).replace(/[^\d.]/g, "")) || 0); onClose(); };

  return (
    <div style={M.back} onClick={onClose}>
      <div style={M.panel} onClick={(e) => e.stopPropagation()}>
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <div style={M.head}>
          <div>
            <div style={M.title}>Flat {flat} — capture meter</div>
            <div style={M.sub}>Expected meter <b style={{ fontFamily: mono }}>{expectedMeter || "—"}</b>. Take or choose a clear photo; we verify the serial and read the reading.</div>
          </div>
          <button style={M.close} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <label className="add" style={{ ...S.addBtn, cursor: "pointer" }}>
            📷 Take photo
            <input type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: "none" }} />
          </label>
          <label style={{ ...S.ghostBtn2, cursor: "pointer" }}>
            Choose from gallery
            <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
          </label>
        </div>

        {url && (
          <div style={M.body}>
            <img src={url} alt="meter" style={M.img} />
            <div style={M.fields}>
              {status === "reading" && <div style={M.note}>Reading photo…</div>}
              {status !== "idle" && status !== "reading" && (
                <div style={{ ...M.verify, ...(match === true ? M.ok : match === false ? M.bad : M.unknown) }}>
                  {match === true ? `✓ Serial ${serial} matches flat ${flat}`
                    : match === false ? `⚠ Photo reads ${serial || "?"}, but flat ${flat}'s meter is ${expectedMeter}. Double-check you photographed the right meter.`
                    : `Couldn't read the serial — check the reading below manually.`}
                </div>
              )}
              <label style={M.lbl}>Current reading</label>
              <input className="cell" style={{ ...S.cellInput, width: "100%", fontSize: 17 }} type="number" autoFocus
                placeholder="type the reading" value={reading} onChange={(e) => setReading(e.target.value)} />
              <div style={M.hint}>Verify against the photo above before applying.</div>
            </div>
          </div>
        )}

        <div style={M.foot}>
          <button style={S.ghostBtn2} onClick={onClose}>Cancel</button>
          <button className="primaryBtn" style={{ ...S.primaryBtn, opacity: reading !== "" ? 1 : .5 }} disabled={reading === ""} onClick={apply}>
            Use this reading
          </button>
        </div>
      </div>
    </div>
  );
}

const M = {
  back: { position: "fixed", inset: 0, background: "rgba(32,35,63,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16, fontFamily: font },
  panel: { background: "#fff", borderRadius: 16, width: "min(560px,100%)", maxHeight: "92vh", overflow: "auto", padding: 22, boxShadow: "0 12px 50px rgba(0,0,0,.2)" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  title: { fontFamily: display, fontWeight: 800, fontSize: 19, letterSpacing: "-.01em" },
  sub: { fontSize: 12.5, color: T.inkSoft, marginTop: 3, lineHeight: 1.45 },
  close: { border: "none", background: "#F1F1F8", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 13, color: T.inkSoft, flexShrink: 0 },
  body: { display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" },
  img: { flex: "1 1 240px", maxWidth: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 10, background: "#000" },
  fields: { flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 8 },
  verify: { padding: "10px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 },
  ok: { background: "#E8F6EE", color: "#1E7F4C" },
  bad: { background: T.owedSoft, color: T.owed },
  unknown: { background: "#FBF3E3", color: "#9A6B15" },
  lbl: { fontSize: 12.5, fontWeight: 600, color: T.ink, marginTop: 4 },
  note: { fontSize: 13, color: T.muted },
  hint: { fontSize: 11.5, color: T.muted },
  foot: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 },
};
