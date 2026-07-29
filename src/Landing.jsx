import React from "react";
import { styles as S, T, css, display, font } from "./styles";

/* Shown when the signed-in account belongs to no building yet, or when they
   choose "add a building" from the switcher. */
export default function Landing({ username, onCreate, onSignOut, canBack, onBack }) {
  return (
    <div style={W.wrap}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div style={W.card}>
        <div style={S.mark}>
          {[5,4,3,2,1].map((fl)=>(
            <div key={fl} style={S.markRow}>{[0,1,2].map((c)=><span key={c} style={S.markDot}/>)}</div>
          ))}
        </div>
        <h1 style={W.title}>Hi {username}</h1>
        <p style={W.sub}>You're not in any building yet. Start one, or open an invite link a building admin shared with you.</p>

        <button className="primaryBtn" style={{ ...S.primaryBtn, width: "100%", padding: "13px", marginTop: 8 }} onClick={onCreate}>
          Create a building
        </button>

        <div style={W.joinNote}>
          <b>Joining one?</b> Open the WhatsApp invite link from your admin — it drops you straight onto the join screen for that building.
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
          {canBack ? <button style={W.link} onClick={onBack}>← Back</button> : <span />}
          <button style={W.link} onClick={onSignOut}>Sign out</button>
        </div>
      </div>
    </div>
  );
}

const W = {
  wrap: { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background: T.bg, fontFamily: font, padding: 20 },
  card: { background:"#fff", borderRadius:18, padding:"34px 30px", width:"min(420px,100%)", border:`1px solid ${T.line}`, boxShadow:"0 8px 40px rgba(20,36,43,.06)" },
  title: { fontFamily: display, fontWeight:800, fontSize:23, letterSpacing:"-.02em", margin:"16px 0 4px" },
  sub: { fontSize:13.5, color: T.inkSoft, margin:"0 0 20px", lineHeight:1.5 },
  joinNote: { marginTop:16, background: T.waterSoft, borderRadius:12, padding:"12px 14px", fontSize:13, color: T.inkSoft, lineHeight:1.5 },
  link: { border:"none", background:"transparent", color: T.water, cursor:"pointer", fontSize:13, fontWeight:600, fontFamily: font, padding:0 },
};
