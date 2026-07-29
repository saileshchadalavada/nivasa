import React, { useState } from "react";
import Tesseract from "tesseract.js";
import { styles as S, T, css, display, mono, font } from "./styles";

/* Bulk meter scanner — Gemini vision API first, Tesseract.js fallback.
   Upload multiple photos; auto-matches serial to flat; confirm before applying. */

const norm = (s) => String(s || "").replace(/\s+/g, "").replace(/[^\d/]/g, "").toLowerCase();

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

async function ocrFallback(file) {
  const canvas = await preprocess(file);
  const { data: { text } } = await Tesseract.recognize(canvas, "eng");
  const sm = text.match(/(\d{3,4})\s*[\/|1]\s*(\d{2})/);
  const serial = sm ? `${sm[1]}/${sm[2]}` : "";
  const cleaned = text.replace(/\d{3,4}\s*[\/|1]\s*\d{2}/, " ");
  const runs = (cleaned.match(/\d[\d .]{3,}\d/g) || []).map((s) => s.replace(/[^\d]/g, ""));
  const reading = runs.sort((a, b) => b.length - a.length)[0] || "";
  return { serial, reading };
}

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
      if (data.serial || data.reading) return { serial: data.serial || "", reading: data.reading || "" };
    }
  } catch {}
  return ocrFallback(file);
}

export default function MeterScan({ meters, onApply, onClose }) {
  const [rows, setRows] = useState([]);   // {name, file, url, serial, flat, reading, status}
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(null); // enlarged row index

  const runOcr = async (file, i) => {
    setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, status: "reading" } : r));
    try {
      const { serial, reading } = await extractFromImage(file);
      const match = meters.find((m) => m.meter && norm(m.meter) === norm(serial));
      setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, serial, reading, flat: r.flat || (match ? match.flat : ""), status: "done" } : r));
    } catch {
      setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, status: "error" } : r));
    }
  };

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = ""; // allow re-selecting the same file / re-capturing
    if (!files.length) return;
    setBusy(true);
    let base = 0;
    setRows((rs) => { base = rs.length; return [...rs, ...files.map((f) => ({ name: f.name, file: f, url: URL.createObjectURL(f), serial: "", flat: "", reading: "", status: "reading" }))]; });
    for (let i = 0; i < files.length; i++) await runOcr(files[i], base + i);
    setBusy(false);
  };

  const setRow = (i, k, v) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const apply = () => {
    const map = {};
    rows.forEach((r) => { if (r.flat && r.reading !== "") map[r.flat] = parseFloat(String(r.reading).replace(/[^\d.]/g, "")) || 0; });
    onApply(map);
    onClose();
  };
  const applicable = rows.filter((r) => r.flat && r.reading !== "").length;

  return (
    <div style={M.back} onClick={onClose}>
      <div style={M.panel} onClick={(e) => e.stopPropagation()}>
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <div style={M.head}>
          <div>
            <div style={M.title}>Scan meter photos</div>
            <div style={M.sub}>Bulk-upload photos. We try to auto-read the serial + reading; tap any photo to enlarge and type the reading yourself. Nothing saves until you Apply.</div>
          </div>
          <button style={M.close} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label className="add" style={{ ...S.addBtn, display: "inline-block", cursor: busy ? "default" : "pointer", opacity: busy ? .6 : 1 }}>
            {busy ? "Reading photos…" : "📁 Choose photos"}
            <input type="file" accept="image/*" multiple onChange={onFiles} disabled={busy} style={{ display: "none" }} />
          </label>
          <label className="add" style={{ ...S.ghostBtn2, display: "inline-block", cursor: busy ? "default" : "pointer", opacity: busy ? .6 : 1 }}>
            📷 Take photo
            <input type="file" accept="image/*" capture="environment" onChange={onFiles} disabled={busy} style={{ display: "none" }} />
          </label>
        </div>

        {rows.length > 0 && (
          <div style={{ ...S.tableWrap, marginTop: 14, maxHeight: 380, overflowY: "auto" }}>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Photo</th><th style={S.th}>Serial read</th><th style={S.th}>Flat</th>
                <th style={{ ...S.th, textAlign: "right" }}>Reading</th><th style={{ ...S.th, textAlign: "center" }}>Status</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={S.td}>
                      <button onClick={() => setZoom(i)} title="Tap to enlarge" style={{ padding: 0, border: "none", background: "none", cursor: "zoom-in" }}>
                        <img src={r.url} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 6, display: "block" }} />
                      </button>
                    </td>
                    <td style={{ ...S.td, fontFamily: mono, fontSize: 12.5, color: T.muted }}>{r.status === "reading" ? "…" : (r.serial || "—")}</td>
                    <td style={{ ...S.td, padding: "4px 8px" }}>
                      <select value={r.flat} onChange={(e) => setRow(i, "flat", e.target.value)} style={S.cellSelect}>
                        <option value="">— pick flat —</option>
                        {meters.map((m) => <option key={m.flat} value={m.flat}>{m.flat}{m.meter ? ` (${m.meter})` : ""}</option>)}
                      </select>
                    </td>
                    <td style={{ ...S.td, padding: "4px 8px", textAlign: "right" }}>
                      <input className="cell" style={S.cellInput} type="number" value={r.reading} placeholder="type…" onChange={(e) => setRow(i, "reading", e.target.value)} />
                    </td>
                    <td style={{ ...S.td, textAlign: "center", whiteSpace: "nowrap" }}>
                      {r.status === "reading" ? <span style={{ color: T.muted, fontSize: 12 }}>reading…</span>
                        : r.flat && r.reading !== "" ? <span style={{ color: T.money, fontSize: 12, fontWeight: 600 }}>✓ ready</span>
                        : <button onClick={() => setZoom(i)} style={{ ...S.ghostBtn2, padding: "5px 10px", fontSize: 12 }}>Enlarge & type</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={M.foot}>
          <span style={{ fontSize: 12.5, color: T.muted }}>OCR is a helper — always verify readings against the photo.</span>
          <span style={{ display: "flex", gap: 10 }}>
            <button style={S.ghostBtn2} onClick={onClose}>Cancel</button>
            <button className="primaryBtn" style={{ ...S.primaryBtn, opacity: applicable ? 1 : .5 }} disabled={!applicable} onClick={apply}>
              Apply {applicable ? `${applicable} reading${applicable > 1 ? "s" : ""}` : "readings"}
            </button>
          </span>
        </div>
      </div>

      {zoom !== null && rows[zoom] && (
        <div style={M.zoomBack} onClick={(e) => { e.stopPropagation(); setZoom(null); }}>
          <img src={rows[zoom].url} alt="meter" style={M.zoomImg} onClick={(e) => e.stopPropagation()} />
          <div style={M.zoomEdit} onClick={(e) => e.stopPropagation()}>
            <select value={rows[zoom].flat} onChange={(e) => setRow(zoom, "flat", e.target.value)} style={{ ...S.cellSelect, minWidth: 150 }}>
              <option value="">— pick flat —</option>
              {meters.map((m) => <option key={m.flat} value={m.flat}>{m.flat}{m.meter ? ` (${m.meter})` : ""}</option>)}
            </select>
            <input className="cell" style={{ ...S.cellInput, width: 140, fontSize: 16 }} type="number" autoFocus
              placeholder="reading" value={rows[zoom].reading} onChange={(e) => setRow(zoom, "reading", e.target.value)} />
            <button style={M.zoomNext} onClick={(e) => { e.stopPropagation(); setZoom(zoom + 1 < rows.length ? zoom + 1 : null); }}>
              {zoom + 1 < rows.length ? "Next photo →" : "Done"}
            </button>
          </div>
          <button style={M.zoomClose} onClick={(e) => { e.stopPropagation(); setZoom(null); }}>✕ Close</button>
        </div>
      )}
    </div>
  );
}

const M = {
  back: { position: "fixed", inset: 0, background: "rgba(32,35,63,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16, fontFamily: font },
  panel: { background: "#fff", borderRadius: 16, width: "min(720px,100%)", maxHeight: "90vh", overflow: "auto", padding: 22, boxShadow: "0 12px 50px rgba(0,0,0,.2)" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  title: { fontFamily: display, fontWeight: 800, fontSize: 19, letterSpacing: "-.01em" },
  sub: { fontSize: 12.5, color: T.inkSoft, marginTop: 3, maxWidth: 520, lineHeight: 1.45 },
  close: { border: "none", background: "#F1F1F8", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 13, color: T.inkSoft, flexShrink: 0 },
  foot: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 16 },
  zoomBack: { position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, zIndex: 80, padding: 16 },
  zoomImg: { maxWidth: "96vw", maxHeight: "66vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 8px 40px rgba(0,0,0,.5)" },
  zoomEdit: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center", background: "#fff", padding: "12px 16px", borderRadius: 12 },
  zoomNext: { background: T.brandDark, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: display },
  zoomClose: { background: "rgba(255,255,255,.9)", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: display },
};
