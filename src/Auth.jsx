import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import { userToEmail } from "./seedData";
import { getPublicBuilding } from "./data";
import { styles as S, T, css, display, mono, font } from "./styles";

/* SEC-09: separate sign-in from account creation.
   - Sign in: always attempted first.
   - Create: only when the user explicitly chooses "Create account" AND has
     a valid invite context (inviteBid OR guestFlow). Network, disabled-user,
     and config errors never fall through to account creation. */
export default function Auth({ inviteBid, guestFlow }) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [bname, setBname] = useState("");
  const [mode, setMode] = useState("signin"); // "signin" | "create"

  // Allow account creation if there's an invite bid OR it's a guest/community flow
  const canCreate = !!(inviteBid || guestFlow);

  useEffect(() => {
    if (inviteBid) getPublicBuilding(inviteBid).then((b) => b && setBname(b.name || "")).catch(() => {});
  }, [inviteBid]);

  const go = async () => {
    setErr("");
    const uname = username.trim();
    if (!uname) return setErr("Enter your username.");
    if (!/^\d{6}$/.test(pin)) return setErr("PIN must be 6 digits.");
    setBusy(true);
    const email = userToEmail(uname);

    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, pin);
      } else {
        // Create mode — only allowed with an invite context or guest flow
        if (!canCreate) {
          setErr("You need an invitation link to create a new account.");
          setBusy(false);
          return;
        }
        try {
          await createUserWithEmailAndPassword(auth, email, pin);
          // For guest flow, App.jsx's auto-join effect handles joinBuildingAsGuest
          // For regular invite flow, Join.jsx handles joinBuilding
        } catch (ce) {
          const code = ce?.code || "";
          if (code === "auth/email-already-in-use") {
            setErr("That username already exists. Switch to sign in and use your PIN.");
          } else if (code === "auth/weak-password") {
            setErr("PIN must be 6 digits.");
          } else {
            setErr("Could not create account. Please try again.");
            console.error("Account creation error:", code);
          }
          setBusy(false);
          return;
        }
      }
    } catch (e) {
      const code = e?.code || "";
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
        if (canCreate) {
          setErr("Incorrect PIN, or this username doesn't exist yet. If you're new, tap \"Create account\" below.");
        } else {
          setErr("Incorrect username or PIN.");
        }
      } else if (code === "auth/wrong-password") {
        setErr("Wrong PIN. Try again.");
      } else if (code === "auth/user-disabled") {
        setErr("This account has been disabled. Contact your building admin.");
      } else if (code === "auth/too-many-requests") {
        setErr("Too many attempts. Please wait a few minutes.");
      } else if (code === "auth/network-request-failed") {
        setErr("Network error. Check your connection and try again.");
      } else {
        setErr("Something went wrong. Please try again.");
        console.error("Auth error:", code);
      }
      setBusy(false);
    }
  };

  const subtitle = mode === "create"
    ? guestFlow
      ? (bname ? `Join ${bname} as a family member` : "Join as a family member")
      : (bname ? `Create account to join ${bname}` : "Create your account")
    : guestFlow
      ? (bname ? `Sign in to view ${bname} community` : "Sign in to your account")
      : (bname ? `Sign in to join ${bname}` : "Sign in to your account");

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
        <p style={L.sub}>{subtitle}</p>

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
          {busy ? "Please wait…" : (mode === "create" ? "Create account" : "Sign in")}
        </button>

        <div style={L.switchRow}>
          {mode === "signin" ? (
            canCreate ? (
              <span>New here? <button style={L.linkBtn} onClick={() => { setMode("create"); setErr(""); }}>Create account</button></span>
            ) : (
              <span style={{ fontSize: 12, color: T.muted }}>Need an account? Ask your building admin for an invite link.</span>
            )
          ) : (
            <span>Already have an account? <button style={L.linkBtn} onClick={() => { setMode("signin"); setErr(""); }}>Sign in</button></span>
          )}
        </div>
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
  err: { marginTop:12, background: T.owedSoft || "#FEF2F2", color: T.owed || "#D94343", padding:"9px 12px", borderRadius:9, fontSize:13 },
  switchRow: { textAlign: "center", marginTop: 14, fontSize: 13, color: T.inkSoft },
  linkBtn: { background: "none", border: "none", color: T.water, fontWeight: 600, cursor: "pointer", fontFamily: font, fontSize: 13, padding: 0, textDecoration: "underline" },
};
