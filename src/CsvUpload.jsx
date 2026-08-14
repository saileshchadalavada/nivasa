import React, { useState, useMemo } from "react";
import Papa from "papaparse";
import { styles as S, T, css, display, mono, font } from "./styles";

/* CSV upload for bulk meter readings.
   Expected format: Flat,Reading (2 columns, with or without header).
   Common/Watchman meter can use "Common", "001", or "common".

   FUNC-06: uses Papa Parse for proper CSV quoting/escaping.
   FUNC-07: strict numeric validation — rejects negative, NaN, multi-decimal. */

const COMMON_ALIASES = new Set(["common", "001", "watchman", "com"]);
const normaliseFlat = (v) => {
  const s = String(v).trim();
  return COMMON_ALIASES.has(s.toLowerCase()) ? "Common" : s;
};

/* FUNC-07: strict numeric validation — returns { value, error } */
function parseReading(raw) {
  const s = String(raw).trim();
  if (s === "") return { value: null, error: "empty" };
  const n = Number(s);
  if (!isFinite(n)) return { value: null, error: `"${s}" is not a valid number` };
  if (n < 0) return { value: null, error: `negative value (${s})` };
  // Reject multiple decimal points (Number("1.2.3") is NaN, already caught, but be explicit)
  if ((s.match(/\./g) || []).length > 1) return { value: null, error: `malformed decimal (${s})` };
  return { value: n, error: null };
}

/* FUNC-06: parse with Papa Parse instead of manual split */
function parseCsv(text) {
  const result = Papa.parse(text.trim(), {
    skipEmptyLines: true,
    dynamicTyping: false, // keep as strings for validation
  });
  if (!result.data || !result.data.length) return [];

  // Detect header row: if second column of first row is not a valid number
  const first = result.data[0];
  const hasHeader = first.length >= 2 && !isFinite(Number(String(first[1]).trim()));
  const dataRows = hasHeader ? result.data.slice(1) : result.data;

  return dataRows.map((cols, lineIdx) => {
    const flat = normaliseFlat(cols[0] || "");
    const rawReading = (cols[1] || "").trim();
    const parsed = parseReading(rawReading);
    return {
      flat,
      reading: rawReading,
      value: parsed.value,
      error: parsed.error,
      line: (hasHeader ? lineIdx + 2 : lineIdx + 1), // 1-based line number
    };
  }).filter((r) => r.flat); // drop rows with no flat
}

function downloadTemplate() {
  const lines = [
    "Flat,Reading",
    "101,819408.1",
    "102,353641.6",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "meter-readings-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function CsvUpload({ existingFlats, onApply, onClose }) {
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState([]);
  const [step, setStep] = useState("input");
  const [target, setTarget] = useState("curr");  // "curr" or "prev"

  const flatSet = useMemo(() => new Set(existingFlats.map((f) => f.flat)), [existingFlats]);

  const doParse = () => {
    const parsed = parseCsv(raw);
    // Check for duplicate flats
    const seen = new Set();
    parsed.forEach((r) => {
      if (seen.has(r.flat)) {
        r.error = r.error || `duplicate flat ${r.flat}`;
      }
      seen.add(r.flat);
    });
    setRows(parsed);
    setStep("preview");
  };

  const onFile = (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setRaw(reader.result); };
    reader.readAsText(file);
    e.target.value = "";
  };

  const matched = rows.filter((r) => flatSet.has(r.flat));
  const unmatched = rows.filter((r) => !flatSet.has(r.flat));
  const validRows = matched.filter((r) => !r.error && r.value != null);
  const errorRows = matched.filter((r) => r.error);

  const apply = () => {
    const map = {};
    validRows.forEach((r) => {
      if (r.value > 0) map[r.flat] = r.value;
    });
    onApply(map, target);
    onClose();
  };

  return (
    <div style={M.back} onClick={onClose}>
      <div style={M.panel} onClick={(e) => e.stopPropagation()}>
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <div style={M.head}>
          <div>
            <div style={M.title}>Upload meter readings</div>
            <div style={M.sub}>
              Paste or upload a CSV with two columns: <b>Flat, Reading</b>.
              Use <code style={{ fontFamily: mono, background: "#F1F1F8", padding: "1px 5px", borderRadius: 4 }}>Common</code> or
              <code style={{ fontFamily: mono, background: "#F1F1F8", padding: "1px 5px", borderRadius: 4 }}>001</code> for the watchman meter.
            </div>
          </div>
          <button style={M.close} onClick={onClose}>✕</button>
        </div>

        {step === "input" && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label className="add" style={{ ...S.addBtn, cursor: "pointer" }}>
                📁 Choose CSV file
                <input type="file" accept=".csv,.tsv,.txt" onChange={onFile} style={{ display: "none" }} />
              </label>
              <button style={M.templateBtn} onClick={() => downloadTemplate()}>
                ⬇ Download template
              </button>
              <span style={{ fontSize: 12.5, color: T.muted }}>or paste below</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {["curr", "prev"].map((t) => (
                <button key={t} onClick={() => setTarget(t)}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13.5,
                    border: `1.5px solid ${target === t ? T.water : T.line}`,
                    background: target === t ? T.waterSoft : "#fff",
                    color: target === t ? T.water : T.inkSoft, fontFamily: font }}>
                  {t === "curr" ? "Current readings" : "Previous readings (initial setup)"}
                </button>
              ))}
            </div>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={"Flat,Reading\n101,819408.1\n102,353641.6\n201,548577.6"}
              rows={10}
              style={M.textarea}
            />
            <div style={{ fontSize: 12, color: T.muted, marginTop: 6, lineHeight: 1.4 }}>
              Standard CSV format (quoted fields and escaped commas are supported).
            </div>
            <div style={M.foot}>
              <button style={S.ghostBtn2} onClick={onClose}>Cancel</button>
              <button className="primaryBtn" style={{ ...S.primaryBtn, opacity: raw.trim() ? 1 : 0.5 }}
                disabled={!raw.trim()} onClick={doParse}>
                Preview readings
              </button>
            </div>
          </>
        )}

        {step === "preview" && (
          <>
            {unmatched.length > 0 && (
              <div style={M.warn}>
                {unmatched.length} row{unmatched.length > 1 ? "s" : ""} didn't match a flat:{" "}
                {unmatched.map((r) => r.flat).join(", ")}. These will be skipped.
              </div>
            )}
            {errorRows.length > 0 && (
              <div style={M.errBox}>
                {errorRows.length} row{errorRows.length > 1 ? "s have" : " has"} invalid readings and will be skipped:
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {errorRows.map((r) => (
                    <li key={r.flat}>Line {r.line}, Flat {r.flat}: {r.error}</li>
                  ))}
                </ul>
              </div>
            )}
            {matched.length === 0 && (
              <div style={M.warn}>No rows matched any flat. Check the flat numbers in your CSV.</div>
            )}
            {matched.length > 0 && (
              <div style={{ ...S.tableWrap, maxHeight: 360, overflowY: "auto" }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Flat</th>
                      <th style={{ ...S.th, textAlign: "right" }}>{target === "curr" ? "Current reading" : "Previous reading"}</th>
                      <th style={{ ...S.th, textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matched.map((r) => (
                      <tr key={r.flat}>
                        <td style={{ ...S.td, fontWeight: 600 }}>{r.flat}</td>
                        <td style={{ ...S.td, textAlign: "right", fontFamily: mono }}>{r.reading}</td>
                        <td style={{ ...S.td, textAlign: "center" }}>
                          {r.error
                            ? <span style={{ color: T.owed, fontSize: 12, fontWeight: 600 }} title={r.error}>✗ {r.error}</span>
                            : <span style={{ color: T.money, fontSize: 12, fontWeight: 600 }}>✓ ready</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={M.foot}>
              <button style={S.ghostBtn2} onClick={() => setStep("input")}>← Back</button>
              <span style={{ display: "flex", gap: 10 }}>
                <button style={S.ghostBtn2} onClick={onClose}>Cancel</button>
                <button className="primaryBtn" style={{ ...S.primaryBtn, opacity: validRows.length ? 1 : 0.5 }}
                  disabled={!validRows.length} onClick={apply}>
                  Apply {validRows.length} {target === "curr" ? "current" : "previous"} reading{validRows.length !== 1 ? "s" : ""}
                </button>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const M = {
  back: { position: "fixed", inset: 0, background: "rgba(32,35,63,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16, fontFamily: font },
  panel: { background: "#fff", borderRadius: 16, width: "min(560px,100%)", maxHeight: "90vh", overflow: "auto", padding: 22, boxShadow: "0 12px 50px rgba(0,0,0,.2)" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  title: { fontFamily: display, fontWeight: 800, fontSize: 19, letterSpacing: "-.01em" },
  sub: { fontSize: 12.5, color: T.inkSoft, marginTop: 3, lineHeight: 1.45, maxWidth: 440 },
  close: { border: "none", background: "#F1F1F8", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 13, color: T.inkSoft, flexShrink: 0 },
  textarea: { width: "100%", padding: "12px 14px", border: `1px solid ${T.line}`, borderRadius: 10, fontSize: 14, fontFamily: mono, background: "#FAFBFE", color: T.ink, resize: "vertical", lineHeight: 1.5 },
  templateBtn: { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: T.water, fontFamily: font },
  warn: { marginBottom: 12, background: "#FBF3E3", color: "#9A6B15", padding: "10px 14px", borderRadius: 9, fontSize: 13, lineHeight: 1.4 },
  errBox: { marginBottom: 12, background: T.owedSoft || "#FEF2F2", color: T.owed || "#D94343", padding: "10px 14px", borderRadius: 9, fontSize: 13, lineHeight: 1.4 },
  foot: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 16 },
};
