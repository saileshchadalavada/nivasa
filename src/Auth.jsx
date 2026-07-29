import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import { userToEmail } from "./seedData";
import { getBuilding } from "./data";
import { styles as S, T, css, display, mono, font } from "./styles";

/* Account-level auth only. Enter username + PIN: existing accounts log in,
   new ones are created. Building membership happens after login (Join / Create). */
export default function Auth({ inviteBid }) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [bname, setBname] = useState("");

  useEffect(() => {
    if (inviteBid) getBuilding(inviteBid).then((b) => b && setBname(b.name || "")).catch(() => {});
  }, [inviteBid]);

  const go = async () => {
    setErr("");
    const uname = username.trim();
    if (!uname) return setErr("Enter your username.");
    if (!/^\d{6}$/.test(pin)) return setErr("PIN must be 6 digits.");
    setBusy(true);
    const email = userToEmail(uname);
    try {
      try {
        await signInWithEmailAndPassword(auth, email, pin);
      } catch {
        await createUserWithEmailAndPassword(auth, email, pin);
      }
    } catch (e) {
      const c = e?.code || "";
      if (c.includes("email-already-in-use")) setErr("Wrong PIN — that username already exists. Try again.");
      else if (c.includes("weak-password")) setErr("PIN must be 6 digits.");
      else if (c.includes("invalid-credential") || c.includes("wrong-password")) setErr("Wrong PIN. Try again.");
      else setErr("Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <div style={L.wrap}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div style={L.card}>
        <div style={S.mark}>
          {[5,4,3,2,1].map((fl)=>(
            <div key={fl} style={S.markRow}>{[0,1,2].map((c)=><span key={c} style={S.markDot}/>)}</div>
          ))}
        </div>
        <h1 style={L.title}>Nivasa</h1>
        <p style={L.sub}>{bname ? `Sign in to join ${bname}` : "Sign in or create your account"}</p>

        <label style={L.label}>Username</label>
        <input value={username} onChange={(e)=>setUsername(e.target.value)}
          placeholder="e.g. sailesh301" style={L.input} autoCapitalize="none" />

        <label style={L.label}>6-digit PIN</label>
        <input type="password" inputMode="numeric" maxLength={6} value={pin}
          onChange={(e)=>setPin(e.target.value.replace(/\D/g,""))}
          onKeyDown={(e)=>e.key==="Enter"&&go()}
          placeholder="••••••" style={{...L.input, fontFamily: mono, letterSpacing: 4}} />

        {err && <div style={L.err}>{err}</div>}

        <button className="primaryBtn" onClick={go} disabled={busy}
          style={{...S.primaryBtn, width:"100%", marginTop:16, padding:"12px"}}>
          {busy ? "Please wait…" : "Continue"}
        </button>
        <p style={L.hint}>New username + PIN creates an account. Same again logs you in.</p>
      </div>
    </div>
  );
}

const L = {
  wrap: { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background: T.bg, fontFamily: font, padding: 20 },
  card: { background:"#fff", borderRadius:18, padding:"34px 30px", width:"min(390px,100%)", border:`1px solid ${T.line}`, boxShadow:"0 8px 40px rgba(20,36,43,.06)" },
  title: { fontFamily: display, fontWeight:800, fontSize:24, letterSpacing:"-.02em", margin:"16px 0 2px" },
  sub: { fontSize:13.5, color: T.inkSoft, margin:"0 0 18px" },
  label: { display:"block", fontSize:12.5, fontWeight:600, color: T.ink, margin:"14px 0 6px" },
  input: { width:"100%", padding:"11px 12px", border:`1px solid ${T.line}`, borderRadius:10, fontSize:15, background:"#fff", color: T.ink, fontFamily: font },
  err: { marginTop:12, background: T.owedSoft, color: T.owed, padding:"9px 12px", borderRadius:9, fontSize:13 },
  hint: { fontSize:12, color: T.muted, textAlign:"center", marginTop:14, marginBottom:0 },
};
