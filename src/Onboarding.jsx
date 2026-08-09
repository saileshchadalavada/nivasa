import React, { useState, useMemo } from "react";
import { claimFlatWithDetails, setMemberFlat, updateMembership } from "./data";
import { styles as S, T, css, display, font } from "./styles";

/* New member picks their flat within a specific building (bid). */
export default function Onboarding({ bid, uid, username, flats, config, onDone, onSignOut }) {
  const [picked, setPicked] = useState(null);
  const [name, setName] = useState("");
  const [meter, setMeter] = useState("");
  const [residentType, setResidentType] = useState("owner");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const residential = useMemo(() => flats.filter((f) => !f.isCommon), [flats]);
  const perFloor = config?.perFloor || 3;
  const byFloor = useMemo(() => {
    const m = new Map();
    residential.forEach((f) => { (m.get(f.floor) || m.set(f.floor, []).get(f.floor)).push(f); });
    return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([, list]) => list.sort((a, b) => a.unit - b.unit));
  }, [residential]);

  const pick = (f) => { if (f.claimedByUid) return; setPicked(f.flat); setName(f.name || ""); setMeter(f.meter || ""); setErr(""); };

  const confirm = async () => {
    if (!name.trim()) return setErr("Add the owner / resident name.");
    setBusy(true);
    try {
      await claimFlatWithDetails(bid, picked, uid, { name: name.trim(), meter: meter.trim() });
      await setMemberFlat(bid, uid, picked);
      await updateMembership(bid, uid, { residentType, phone: phone.trim() || null });
      onDone();
    } catch (e) { setErr("Couldn't save — that flat may have just been claimed."); setBusy(false); }
  };

  return (
    <div style={O.wrap}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div style={O.bar}>
        <span style={O.barTitle}>{config?.name || "Nivasa"}</span>
        <span style={O.barSub}>Welcome, {username}</span>
      </div>
      <div style={O.body}>
        {!picked ? (
          <>
            <h2 style={O.h}>Select your flat</h2>
            <p style={O.sub}>Tap your flat. Greyed tiles are already taken.</p>
            <div style={{ ...S.tileGrid, gridTemplateColumns: `repeat(${perFloor}, 1fr)`, maxWidth: 420, margin: "0 auto" }}>
              {byFloor.flatMap((row) => row).map((f) => {
                const taken = !!f.claimedByUid;
                return (
                  <button key={f.flat} className="tile" disabled={taken} onClick={() => pick(f)}
                    style={{ ...S.tile, background: taken ? "#C9CAD8" : T.water,
                      boxShadow: taken ? "inset 0 -4px 0 rgba(0,0,0,.10)" : "inset 0 -4px 0 rgba(0,0,0,.18)",
                      cursor: taken ? "not-allowed" : "pointer" }}>
                    {f.flat}<span style={S.tileSub}>{taken ? "taken" : (f.name ? f.name.split(" ")[0] : "free")}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <h2 style={O.h}>Flat {picked}</h2>
            <p style={O.sub}>We pre-filled the details we have. Edit anything that's wrong.</p>
            <div style={{ maxWidth: 420, margin: "0 auto" }}>
              <label style={O.label}>Owner / resident name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={O.input} />
              <label style={O.label}>Water meter number</label>
              <input value={meter} onChange={(e) => setMeter(e.target.value)} placeholder="e.g. 4786/22" style={{ ...O.input, fontFamily: "monospace" }} />
              <label style={O.label}>Phone number (for bill notifications)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+\- ]/g, ""))}
                placeholder="+91 98765 43210" inputMode="tel" style={{ ...O.input, fontFamily: "monospace" }} />
              <label style={O.label}>You are the</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["owner", "tenant"].map((t) => (
                  <button key={t} onClick={() => setResidentType(t)}
                    style={{ flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer", fontFamily: display, fontWeight: 600, fontSize: 13.5, textTransform: "capitalize",
                      border: `1.5px solid ${residentType === t ? T.water : T.line}`, background: residentType === t ? T.waterSoft : "#fff", color: residentType === t ? T.water : T.inkSoft }}>
                    {t === "owner" ? "Flat owner" : "Tenant"}
                  </button>
                ))}
              </div>
              {err && <div style={O.err}>{err}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button style={O.ghost} onClick={() => setPicked(null)}>Back</button>
                <button className="primaryBtn" style={{ ...S.primaryBtn, flex: 1 }} onClick={confirm} disabled={busy}>
                  {busy ? "Saving…" : "Confirm & continue"}
                </button>
              </div>
            </div>
          </>
        )}
        {err && !picked && <div style={{ ...O.err, maxWidth: 420, margin: "12px auto 0" }}>{err}</div>}
        {onSignOut && (
          <div style={{ textAlign: "center", marginTop: 28 }}>
            <button onClick={onSignOut}
              style={{ background: "none", border: "none", color: T.inkSoft, fontSize: 13,
                cursor: "pointer", fontFamily: font, textDecoration: "underline" }}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const O = {
  wrap: { minHeight: "100vh", background: T.bg, fontFamily: font },
  bar: { background: T.water, color: "#fff", padding: "18px 24px", display: "flex", flexDirection: "column", gap: 2 },
  barTitle: { fontFamily: display, fontWeight: 700, fontSize: 19 },
  barSub: { fontSize: 12.5, color: "rgba(255,255,255,.82)" },
  body: { padding: "28px 20px", maxWidth: 560, margin: "0 auto" },
  h: { fontFamily: display, fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", margin: "0 0 4px", textAlign: "center" },
  sub: { fontSize: 13.5, color: T.inkSoft, margin: "0 0 20px", textAlign: "center" },
  label: { display: "block", fontSize: 12.5, fontWeight: 600, color: T.ink, margin: "14px 0 6px" },
  input: { width: "100%", padding: "11px 12px", border: `1px solid ${T.line}`, borderRadius: 10, fontSize: 15, background: "#fff", color: T.ink, fontFamily: font },
  ghost: { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 13.5, cursor: "pointer", color: T.inkSoft, fontFamily: display },
  err: { marginTop: 12, background: T.owedSoft, color: T.owed, padding: "9px 12px", borderRadius: 9, fontSize: 13 },
};