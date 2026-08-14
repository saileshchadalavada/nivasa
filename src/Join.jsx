import React, { useState, useEffect } from "react";
import { getPublicBuilding, getBuilding, joinBuilding } from "./data";
import { styles as S, T, css, display, mono, font } from "./styles";

/* Arrived via an invite link (?b=<bid>&join=<code>) for a building the account
   isn't a member of yet. Confirm the code and join.
   SEC-03: display data comes from publicBuildings (no auth needed for name/city).
   Invite code is still read from the private building doc (requires signedIn). */
export default function Join({ bid, code: codeFromUrl, uid, username, onJoined, onSignOut }) {
  const [pub, setPub] = useState(undefined);   // public building info (name, city)
  const [bld, setBld] = useState(undefined);   // private building info (inviteCode)
  const [code, setCode] = useState(codeFromUrl || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    getPublicBuilding(bid).then((b) => setPub(b || null)).catch(() => setPub(null));
    getBuilding(bid).then((b) => setBld(b || null)).catch(() => setBld(null));
  }, [bid]);

  const displayName = pub?.name || bld?.name || "";
  const displayLocation = [pub?.city || bld?.city, pub?.state || bld?.state].filter(Boolean).join(", ");
  const loaded = pub !== undefined || bld !== undefined;
  const notFound = pub === null && bld === null;

  const join = async () => {
    setErr("");
    if (!bld) return setErr("Could not verify invite code. Please try again.");
    if (code.trim().toUpperCase() !== (bld.inviteCode || "")) return setErr("That invite code doesn't match. Ask the admin for the link.");
    setBusy(true);
    try { await joinBuilding(bid, uid, username); onJoined(bid); }
    catch (e) { setErr("Couldn't join. Try again."); setBusy(false); }
  };

  return (
    <div style={W.wrap}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div style={W.card}>
        <div style={S.mark}>
          {[5,4,3,2,1].map((fl)=>(
            <div key={fl} style={S.markRow}>{[0,1,2].map((c)=><span key={c} style={S.markDot}/>)}</div>
          ))}
        </div>
        {!loaded ? <p style={W.sub}>Loading…</p>
          : notFound ? <p style={W.sub}>That building link is invalid.</p>
          : (
          <>
            <h1 style={W.title}>Join {displayName}</h1>
            <p style={W.sub}>{displayLocation}</p>
            <label style={W.label}>Invite code</label>
            <input value={code} onChange={(e)=>setCode(e.target.value.toUpperCase())}
              placeholder="from the WhatsApp link" style={{ ...W.input, fontFamily: mono, letterSpacing: 2 }} />
            {err && <div style={W.err}>{err}</div>}
            <button className="primaryBtn" style={{ ...S.primaryBtn, width:"100%", padding:"13px", marginTop:14 }} onClick={join} disabled={busy || !bld}>
              {busy ? "Joining…" : `Join ${displayName}`}
            </button>
          </>
        )}
        <div style={{ textAlign: "right", marginTop: 16 }}>
          <button style={W.link} onClick={onSignOut}>Sign out</button>
        </div>
      </div>
    </div>
  );
}

const W = {
  wrap: { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background: T.bg, fontFamily: font, padding: 20 },
  card: { background:"#fff", borderRadius:18, padding:"34px 30px", width:"min(390px,100%)", border:`1px solid ${T.line}`, boxShadow:"0 8px 40px rgba(20,36,43,.06)" },
  title: { fontFamily: display, fontWeight:800, fontSize:23, letterSpacing:"-.02em", margin:"16px 0 2px" },
  sub: { fontSize:13.5, color: T.inkSoft, margin:"0 0 16px" },
  label: { display:"block", fontSize:12.5, fontWeight:600, color: T.ink, margin:"10px 0 6px" },
  input: { width:"100%", padding:"11px 12px", border:`1px solid ${T.line}`, borderRadius:10, fontSize:15, background:"#fff", color: T.ink, fontFamily: font },
  err: { marginTop:12, background: T.owedSoft, color: T.owed, padding:"9px 12px", borderRadius:9, fontSize:13 },
  link: { border:"none", background:"transparent", color: T.water, cursor:"pointer", fontSize:12.5, fontWeight:600, fontFamily: font, padding:0, textDecoration:"underline" },
};
