import React, { useState } from "react";
import { DEFAULT_FLOORS, DEFAULT_PER_FLOOR, buildFlatsForSetup } from "./seedData";
import { createBuilding } from "./data";
import { styles as S, T, css, display, font, mono } from "./styles";

/* Founder building setup. adminUid = current user's uid. */
export default function Setup({ adminUid, username, existingNames = [], onDone, onCancel }) {
  const [step, setStep] = useState(1);
  const [d, setD] = useState({ name: "", state: "", city: "", pincode: "", address: "", mapLink: "" });
  const [floors, setFloors] = useState(DEFAULT_FLOORS);
  const [perFloor, setPerFloor] = useState(DEFAULT_PER_FLOOR);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k, v) => setD((o) => ({ ...o, [k]: v }));
  const preview = buildFlatsForSetup(parseInt(floors) || 1, parseInt(perFloor) || 1, false).filter((f) => !f.isCommon);

  const finish = async () => {
    setErr("");
    if (!d.name.trim()) { setStep(1); return setErr("Building name is required."); }
    const f = parseInt(floors); const pf = parseInt(perFloor);
    if (!f || f < 1 || f > 99) { setStep(3); return setErr("Number of floors must be between 1 and 99."); }
    if (!pf || pf < 1 || pf > 20) { setStep(3); return setErr("Flats per floor must be between 1 and 20."); }
    if (existingNames.some((n) => n.trim().toLowerCase() === d.name.trim().toLowerCase())) {
      setStep(1); return setErr(`You already have a building called "${d.name.trim()}". Use a different name.`);
    }
    setBusy(true);
    try {
      const bid = await createBuilding({ details: d, floors: f, perFloor: pf, adminUid, username, prefill: false });
      onDone(bid);
    } catch (e) {
      setErr("Couldn't create the building. " + (e?.message || ""));
      setBusy(false);
    }
  };

  return (
    <div style={P.wrap}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div style={P.card}>
        <div style={P.steps}>
          {["Building", "Location", "Layout"].map((s, i) => (
            <span key={s} style={{ ...P.step, ...(step === i + 1 ? P.stepOn : {}) }}>{i + 1}. {s}</span>
          ))}
        </div>

        {step === 1 && (
          <>
            <h2 style={P.h}>Name your building</h2>
            <Field label="Building name" value={d.name} onChange={(v) => set("name", v)} placeholder="e.g. Nivasa Residency" />
            <Row>
              <div style={P.typeCard}>Single block <span style={P.typeOn}>selected</span></div>
              <div style={{ ...P.typeCard, opacity: .5 }}>Multiple blocks <span style={P.soon}>soon</span></div>
            </Row>
            <Nav back={onCancel} next={() => setStep(2)} />
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={P.h}>Where is it?</h2>
            <Row>
              <Field label="State" value={d.state} onChange={(v) => set("state", v)} />
              <Field label="City" value={d.city} onChange={(v) => set("city", v)} />
            </Row>
            <Field label="Pincode" value={d.pincode} onChange={(v) => set("pincode", v.replace(/\D/g, "").slice(0, 6))} />
            <Field label="Address" value={d.address} onChange={(v) => set("address", v)} textarea />
            <Field label="Google Maps link" value={d.mapLink} onChange={(v) => set("mapLink", v)} placeholder="https://maps.app.goo.gl/…" />
            <Nav back={() => setStep(1)} next={() => setStep(3)} />
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={P.h}>Floors & flats</h2>
            <Row>
              <Field label="Number of floors" type="number" value={floors}
                onChange={(v) => setFloors(v === "" ? "" : parseInt(v) || "")} />
              <Field label="Flats per floor" type="number" value={perFloor}
                onChange={(v) => setPerFloor(v === "" ? "" : parseInt(v) || "")} />
            </Row>

            <div style={P.previewBox}>
              <div style={P.previewLabel}>{preview.length} flats · known ones are pre-filled and editable later</div>
              <div style={P.grid}>
                {preview.map((f) => (
                  <span key={f.flat} style={{ ...P.chip, ...(f.name ? P.chipKnown : {}) }}>
                    {f.flat}{f.name ? ` · ${f.name.split(" ")[0]}` : ""}
                  </span>
                ))}
              </div>
            </div>
            {err && <div style={P.err}>{err}</div>}
            <Nav back={() => setStep(2)} finish={finish} busy={busy} />
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type, textarea }) {
  return (
    <label style={P.field}>
      <span style={P.label}>{label}</span>
      {textarea
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} style={{ ...P.input, resize: "vertical" }} />
        : <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
            style={{ ...P.input, fontFamily: type === "number" ? mono : font }} />}
    </label>
  );
}
const Row = ({ children }) => <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{children}</div>;
function Nav({ back, next, finish, busy }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, gap: 10 }}>
      {back ? <button style={P.ghost} onClick={back}>Back</button> : <span />}
      {next && <button className="primaryBtn" style={S.primaryBtn} onClick={next}>Continue</button>}
      {finish && <button className="primaryBtn" style={S.primaryBtn} onClick={finish} disabled={busy}>
        {busy ? "Creating…" : "Create building"}</button>}
    </div>
  );
}

const P = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: font, padding: 20 },
  card: { background: "#fff", borderRadius: 18, padding: "30px 30px", width: "min(560px,100%)", border: `1px solid ${T.line}`, boxShadow: "0 8px 40px rgba(20,36,43,.06)" },
  steps: { display: "flex", gap: 14, marginBottom: 18, fontSize: 12.5, color: T.muted, flexWrap: "wrap" },
  step: { fontWeight: 600 },
  stepOn: { color: T.water },
  h: { fontFamily: display, fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", margin: "0 0 16px" },
  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, flex: 1, minWidth: 140 },
  label: { fontSize: 12.5, fontWeight: 600, color: T.ink },
  input: { width: "100%", padding: "10px 12px", border: `1px solid ${T.line}`, borderRadius: 9, fontSize: 14.5, background: "#fff", color: T.ink, fontFamily: font },
  typeCard: { flex: 1, minWidth: 140, border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" },
  typeOn: { fontSize: 11, color: T.water, fontWeight: 700 },
  soon: { fontSize: 11, color: T.muted },
  previewBox: { background: "#F6F9F8", borderRadius: 12, padding: 14, marginTop: 4 },
  prefillRow: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: T.inkSoft, margin: "4px 0 12px", lineHeight: 1.4, cursor: "pointer" },
  prefillBox: { display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
    background: T.waterSoft, border: `1.5px solid ${T.water}`, borderRadius: 12, padding: "12px 14px", margin: "6px 0 14px" },
  previewLabel: { fontSize: 12, color: T.inkSoft, marginBottom: 10 },
  grid: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { fontFamily: mono, fontSize: 12, padding: "4px 8px", borderRadius: 6, background: "#fff", border: `1px solid ${T.line}`, color: T.inkSoft },
  chipKnown: { color: T.water, borderColor: T.waterSoft, background: T.waterSoft },
  ghost: { background: "transparent", border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13.5, cursor: "pointer", color: T.inkSoft, fontFamily: font },
  err: { marginTop: 12, background: T.owedSoft, color: T.owed, padding: "9px 12px", borderRadius: 9, fontSize: 13 },
};
