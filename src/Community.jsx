import React, { useState, useMemo, useEffect, useRef } from "react";
import { createActivity, updateActivity, deleteActivity, castVote, subscribeActivityVotes } from "./data";
import { money, fmtDate } from "./util";
import { styles as S, T, display, mono, font } from "./styles";

const TYPES = { announcement: "📢", poll: "📊", meeting: "📅" };
const TYPE_LABELS = { announcement: "Announcement", poll: "Poll", meeting: "Meeting" };

export default function Community({ bid, activities, membership, members, config, admin, mobile, initialActivityId }) {
  const [creating, setCreating] = useState(null);  // null | "announcement" | "poll" | "meeting"
  const [editing, setEditing] = useState(null);     // activity id being edited
  const [expanded, setExpanded] = useState(initialActivityId || null);   // activity id expanded

  const myUid = membership?.uid || "";
  const myFlat = membership?.flat || "";
  const sorted = useMemo(() =>
    [...(activities || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
  [activities]);

  // SEC-05 / FUNC-02: subscribe to vote subcollections for all polls
  const pollIds = useMemo(() => sorted.filter((a) => a.type === "poll").map((a) => a.id), [sorted]);
  const [votesMap, setVotesMap] = useState({}); // { activityId: [{ uid, optionIdx, flat }] }

  useEffect(() => {
    if (pollIds.length === 0) return;
    const unsubs = pollIds.map((id) =>
      subscribeActivityVotes(bid, id, (votes) =>
        setVotesMap((prev) => ({ ...prev, [id]: votes }))
      )
    );
    return () => unsubs.forEach((u) => u && u());
  }, [bid, pollIds.join(",")]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <h2 style={S.section}>Community</h2>
        {admin && !creating && (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={C.newBtn} onClick={() => setCreating("announcement")}>📢 Announcement</button>
            <button style={C.newBtn} onClick={() => setCreating("poll")}>📊 Poll</button>
            <button style={C.newBtn} onClick={() => setCreating("meeting")}>📅 Meeting</button>
          </div>
        )}
      </div>

      {creating && (
        <CreateForm type={creating} bid={bid} membership={membership}
          onDone={() => setCreating(null)} onCancel={() => setCreating(null)} />
      )}

      {sorted.length === 0 && !creating && (
        <div style={{ color: T.muted, fontSize: 14, padding: "40px 0", textAlign: "center" }}>
          No community activity yet.{admin ? " Create an announcement, poll, or meeting to get started." : ""}
        </div>
      )}

      {sorted.map((a) => (
        <ActivityCard key={a.id} activity={a} bid={bid} myUid={myUid} myFlat={myFlat} admin={admin}
          members={members} expanded={expanded === a.id} mobile={mobile}
          votes={votesMap[a.id] || []}
          onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
          onEdit={() => setEditing(a.id)} editing={editing === a.id}
          onEditDone={() => setEditing(null)} config={config} />
      ))}
    </>
  );
}

/* ──────────────────────────────────────────
   RICH CONTENT — type detection + labels
   ────────────────────────────────────────── */
const RICH_MODES = [
  { key: "none",  label: "None" },
  { key: "text",  label: "📝 Text" },
  { key: "html",  label: "🌐 HTML" },
];


/* ──────────────────────────────────────────
   CREATE FORM
   ────────────────────────────────────────── */
function CreateForm({ type, bid, membership, onDone, onCancel }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  // Poll fields
  const [options, setOptions] = useState(["", ""]);
  // Meeting fields
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");
  const [busy, setBusy] = useState(false);
  // Rich content
  const [richMode, setRichMode] = useState("none"); // none | text | html
  const [richText, setRichText] = useState("");

  const addOption = () => setOptions([...options, ""]);
  const setOption = (i, v) => setOptions(options.map((o, idx) => idx === i ? v : o));
  const removeOption = (i) => options.length > 2 && setOptions(options.filter((_, idx) => idx !== i));

  const submit = async () => {
    setErr("");
    if (!title.trim()) return setErr("Title is required.");
    if (type === "poll") {
      const validOptions = options.map((o) => o.trim()).filter(Boolean);
      if ([...new Set(validOptions)].length < 2) return setErr("A poll needs at least 2 different options.");
    }
    if (type === "meeting" && !date) return setErr("A meeting date is required.");

    setBusy(true);
    try {
      const base = { type, title: title.trim(), body: body.trim(), status: "published", createdBy: membership?.uid || "" };

      // Rich content (paste only — no file upload on Spark plan)
      if (richMode === "html" && richText.trim()) {
        base.rich = { type: "html", content: richText.trim() };
      } else if (richMode === "text" && richText.trim()) {
        base.rich = { type: "text", content: richText.trim() };
      }

      if (type === "poll") {
        base.poll = { options: [...new Set(options.map((o) => o.trim()).filter(Boolean))] };
      }
      if (type === "meeting") {
        base.meeting = { date, time, location: location.trim(), agenda: agenda.trim(), mom: "" };
      }

      await createActivity(bid, base);
      onDone();
    } catch (e) {
      setErr("Could not publish. Please try again.");
      console.error("createActivity failed:", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={C.form}>
      <div style={C.formHead}>
        <span style={C.formTitle}>{TYPES[type]} New {TYPE_LABELS[type]}</span>
        <button style={C.closeBtn} onClick={onCancel}>✕</button>
      </div>
      <label style={C.label}>Title</label>
      <input style={C.input} value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder={type === "poll" ? "e.g. Should we hire a new watchman?" : type === "meeting" ? "e.g. Monthly building meeting" : "e.g. Water supply disruption tomorrow"} />

      {type !== "poll" && (
        <>
          <label style={C.label}>{type === "meeting" ? "Description" : "Message"} <span style={{ fontWeight: 400, color: T.muted }}>(shown as preview on WhatsApp)</span></label>
          <textarea style={{ ...C.input, minHeight: 80, resize: "vertical" }} value={body}
            onChange={(e) => setBody(e.target.value)} placeholder="Brief summary — this is what people see before clicking through..." />
        </>
      )}

      {/* Rich content attachment — any type except polls */}
      {type !== "poll" && (
        <div style={{ marginTop: 10 }}>
          <label style={C.label}>Attach detailed content <span style={{ fontWeight: 400, color: T.muted }}>(optional — viewable in app)</span></label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {RICH_MODES.map((m) => (
              <button key={m.key} onClick={() => { setRichMode(m.key); setErr(""); }}
                style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: font,
                  border: `1.5px solid ${richMode === m.key ? T.water : T.line}`,
                  background: richMode === m.key ? T.waterSoft : "#fff",
                  color: richMode === m.key ? T.water : T.inkSoft }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Text / HTML paste */}
          {(richMode === "text" || richMode === "html") && (
            <>
              <textarea style={{ ...C.input, minHeight: 120, resize: "vertical", fontFamily: richMode === "html" ? mono : font, fontSize: richMode === "html" ? 12 : 14 }}
                value={richText} onChange={(e) => setRichText(e.target.value)}
                placeholder={richMode === "html" ? "Paste your styled HTML here..." : "Paste the full content here..."} />
              {richText.trim() && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 4 }}>Preview:</div>
                  {richMode === "html" ? (
                    <iframe srcDoc={richText} sandbox="allow-same-origin"
                      style={{ width: "100%", height: 200, border: `1px solid ${T.line}`, borderRadius: 8, background: "#fff" }} />
                  ) : (
                    <div style={{ ...C.textPreview, maxHeight: 200, overflow: "auto" }}>{richText}</div>
                  )}
                </div>
              )}
            </>
          )}


        </div>
      )}

      {type === "poll" && (
        <>
          <label style={C.label}>Options</label>
          {options.map((o, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input style={{ ...C.input, flex: 1, marginBottom: 0 }} value={o}
                onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
              {options.length > 2 && (
                <button style={C.closeBtn} onClick={() => removeOption(i)}>✕</button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <button style={C.ghostBtn} onClick={addOption}>+ Add option</button>
          )}
        </>
      )}

      {type === "meeting" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={C.label}>Date *</label>
            <input type="date" style={C.input} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label style={C.label}>Time</label>
            <input type="time" style={C.input} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={C.label}>Location</label>
            <input style={C.input} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Building terrace" />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={C.label}>Agenda</label>
            <textarea style={{ ...C.input, minHeight: 60, resize: "vertical" }} value={agenda}
              onChange={(e) => setAgenda(e.target.value)} placeholder="Discussion points..." />
          </div>
        </div>
      )}

      {err && <div style={C.err}>{err}</div>}

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button style={C.ghostBtn} onClick={onCancel}>Cancel</button>
        <button className="primaryBtn" style={{ ...S.primaryBtn, flex: 1 }} onClick={submit} disabled={busy || !title.trim()}>
          {busy ? "Publishing..." : `Publish ${TYPE_LABELS[type].toLowerCase()}`}
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   ACTIVITY CARD
   ────────────────────────────────────────── */
function ActivityCard({ activity: a, bid, myUid, myFlat, admin, members, expanded, mobile, votes, onToggle, onEdit, editing, onEditDone, config }) {
  const isPoll = a.type === "poll";
  const isMeeting = a.type === "meeting";
  const rich = a.rich || null; // { type, content?, fileUrl?, fileName? }
  const hasRich = !!rich;

  // SEC-05 / FUNC-02: votes come from subcollection, keyed by UID
  const totalVotes = isPoll ? votes.length : 0;
  const myVote = isPoll ? votes.find((v) => v.uid === myUid) : undefined;
  const ago = timeAgo(a.createdAt);

  // Deep link to this specific activity
  const appLink = `${window.location.origin}${window.location.pathname}?b=${bid}&tab=community&a=${a.id}`;

  const shareText = () => {
    let msg = `${TYPES[a.type]} *${a.title}*\n`;

    if (a.type === "announcement") {
      if (a.body) {
        const preview = a.body.length > 150 ? a.body.slice(0, 150) + "…" : a.body;
        msg += `\n${preview}\n`;
      }
      if (hasRich) msg += `\n🖼️ _Detailed document available in the app_\n`;
      msg += `\n📖 Read full details on Nivasa:\n${appLink}`;
    }
    if (isPoll) {
      msg += "\nOptions:\n";
      (a.poll?.options || []).forEach((o, i) => { msg += `${i + 1}. ${o}\n`; });
      msg += `\n👉 Vote now on Nivasa:\n${appLink}`;
    }
    if (isMeeting) {
      const m = a.meeting || {};
      if (m.date) msg += `\n📅 ${fmtDate(m.date)}${m.time ? ` at ${m.time}` : ""}`;
      if (m.location) msg += `\n📍 ${m.location}`;
      if (m.agenda) {
        const preview = m.agenda.length > 150 ? m.agenda.slice(0, 150) + "…" : m.agenda;
        msg += `\n\n${preview}`;
      }
      if (m.mom) {
        const momPreview = m.mom.length > 100 ? m.mom.slice(0, 100) + "…" : m.mom;
        msg += `\n\n📋 Minutes: ${momPreview}`;
      }
      if (hasRich) msg += `\n\n🖼️ _Full formatted minutes available in the app_`;
      msg += `\n\n📖 Full details on Nivasa:\n${appLink}`;
    }
    return msg;
  };

  const share = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText())}`;
    window.open(url, "_blank");
  };

  // SEC-05 / FUNC-02: vote by UID, not flat
  const doVote = (idx) => {
    if (!myUid) return;
    castVote(bid, a.id, myUid, idx, myFlat).catch((e) =>
      console.error("Vote failed:", e)
    );
  };

  const doDelete = () => {
    if (window.confirm(`Delete this ${TYPE_LABELS[a.type].toLowerCase()}? This cannot be undone.`)) {
      deleteActivity(bid, a.id).catch((e) =>
        console.error("Delete activity failed:", e)
      );
    }
  };

  // Rich content badge for collapsed card
  const richBadge = hasRich ? (
    <span style={{ fontSize: 11, color: T.water, fontWeight: 600, marginTop: 3, display: "inline-block" }}>
      {rich.type === "html" ? "🌐" : rich.type === "pdf" ? "📄" : rich.type === "docx" ? "📝" : rich.type === "image" ? "🖼️" : "📝"}{" "}
      {rich.type === "html" ? "Rich page" : "Full text"} attached — tap to view
    </span>
  ) : null;

  return (
    <div style={C.card}>
      <div style={C.cardHead} onClick={onToggle}>
        <div style={{ flex: 1 }}>
          <span style={C.typeTag}>{TYPES[a.type]} {TYPE_LABELS[a.type]}</span>
          <span style={C.ago}>{ago}</span>
          <div style={C.cardTitle}>{a.title}</div>
          {!expanded && a.body && (
            <div style={C.cardPreview}>{a.body.slice(0, 100)}{a.body.length > 100 ? "..." : ""}</div>
          )}
          {!expanded && richBadge}
          {!expanded && isPoll && <span style={{ fontSize: 12, color: T.muted }}>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>}
        </div>
        <span style={{ fontSize: 18, color: T.muted, flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={C.cardBody}>
          {a.body && <div style={C.bodyText}>{a.body}</div>}

          {/* Poll — SEC-05/FUNC-02: votes from subcollection */}
          {isPoll && (
            <div style={{ marginTop: 12 }}>
              {(a.poll?.options || []).map((opt, i) => {
                const count = votes.filter((v) => v.optionIdx === i).length;
                const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                const isMyVote = myVote?.optionIdx === i;
                return (
                  <div key={i} style={C.pollRow}>
                    <button onClick={() => doVote(i)} disabled={!myUid}
                      style={{ ...C.pollBtn, ...(isMyVote ? C.pollBtnActive : {}), cursor: myUid ? "pointer" : "default" }}>
                      <span style={{ flex: 1, textAlign: "left" }}>{opt}{isMyVote && " ✓"}</span>
                      <span style={{ fontFamily: mono, fontSize: 12 }}>{count} ({pct}%)</span>
                    </button>
                    <div style={C.pollBar}>
                      <div style={{ ...C.pollFill, width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
                {totalVotes} vote{totalVotes !== 1 ? "s" : ""}{myVote != null ? " · you voted" : myUid ? " · tap an option to vote" : ""}
              </div>
              {admin && totalVotes > 0 && (
                <details style={{ marginTop: 10, fontSize: 12.5, color: T.inkSoft }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>Who voted what</summary>
                  <div style={{ marginTop: 6 }}>
                    {votes.map((v) => {
                      const m = members.find((mm) => mm.uid === v.uid);
                      const flatLabel = v.flat || m?.flat || "?";
                      return <div key={v.uid}>Flat {flatLabel} ({m?.username || "?"}) → {(a.poll?.options || [])[v.optionIdx] || "?"}</div>;
                    })}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Meeting */}
          {isMeeting && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13.5, color: T.inkSoft, marginBottom: 10 }}>
                {a.meeting?.date && <span>📅 {fmtDate(a.meeting.date)}{a.meeting.time ? ` at ${a.meeting.time}` : ""}</span>}
                {a.meeting?.location && <span>📍 {a.meeting.location}</span>}
              </div>
              {a.meeting?.agenda && (
                <div style={{ marginBottom: 10 }}>
                  <div style={C.subLabel}>Agenda</div>
                  <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{a.meeting.agenda}</div>
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <div style={C.subLabel}>Minutes of Meeting (MoM)</div>
                {admin || editing ? (
                  <MomEditor bid={bid} activityId={a.id} mom={a.meeting?.mom || ""} onDone={onEditDone} />
                ) : (
                  <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5, whiteSpace: "pre-wrap", background: "#FAFBFE", padding: 12, borderRadius: 8, minHeight: 40 }}>
                    {a.meeting?.mom || <span style={{ color: T.muted, fontStyle: "italic" }}>No minutes recorded yet.</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Rich content preview ── */}
          {hasRich && (
            <div style={{ marginTop: 16 }}>
              <div style={C.subLabel}>
                {rich.type === "html" ? "🌐 Detailed View" : "📝 Full Content"}
              </div>
              <RichPreview rich={rich} activityId={a.id} />
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button style={C.shareBtn} onClick={share}>💬 Share on WhatsApp</button>
            {hasRich && <PosterButton rich={rich} activityId={a.id} title={a.title} body={a.body} appLink={appLink} config={config} />}
            {admin && <button style={C.ghostBtn} onClick={doDelete}>🗑 Delete</button>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────
   RICH PREVIEW — renders based on content type
   ────────────────────────────────────────── */
function RichPreview({ rich, activityId }) {
  const iframeRef = useRef(null);
  const [iframeH, setIframeH] = useState(400);

  // Auto-resize for HTML/text iframes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => {
      try {
        const h = iframe.contentDocument?.documentElement?.scrollHeight;
        if (h && h > 50) setIframeH(Math.min(h + 20, 2000));
      } catch { /* cross-origin fallback */ }
    };
    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [rich]);

  // HTML → sandboxed iframe
  if (rich.type === "html") {
    return (
      <iframe ref={iframeRef} id={`rich-${activityId}`} srcDoc={rich.content} sandbox="allow-same-origin"
        style={{ width: "100%", height: iframeH, border: `1px solid ${T.line}`, borderRadius: 10, background: "#fff", display: "block" }} />
    );
  }

  // Plain text → styled div
  if (rich.type === "text") {
    return (
      <div style={C.textPreview}>{rich.content}</div>
    );
  }

  return null;
}

/* ──────────────────────────────────────────
   POSTER BUTTON — canvas-drawn card for WhatsApp
   Works for ALL content types (no html2canvas needed)
   ────────────────────────────────────────── */
function PosterButton({ rich, activityId, title, body, appLink, config }) {
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const W = 1080, pad = 40;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Measure at draw-size for accurate line counts
      ctx.font = "600 26px Poppins, system-ui, sans-serif";
      const bodyLines = body ? wrapText(ctx, body, W - pad * 2) : [];
      ctx.font = "800 48px Poppins, system-ui, sans-serif";
      const titleLines = wrapText(ctx, title, W - pad * 2);

      const headerH = 220;
      const titleH = titleLines.length * 60 + 24;
      const bodyH = bodyLines.length > 0 ? bodyLines.length * 38 + 30 : 0;
      const badgeH = rich ? 80 : 0;
      const footerH = 100;
      const H = headerH + titleH + bodyH + badgeH + footerH + pad;

      canvas.width = W;
      canvas.height = H;

      // Background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);

      // Header gradient
      const hGrad = ctx.createLinearGradient(0, 0, W, headerH);
      hGrad.addColorStop(0, "#1A6B72");
      hGrad.addColorStop(1, "#0D4A50");
      ctx.fillStyle = hGrad;
      ctx.fillRect(0, 0, W, headerH);

      // Gold accent line
      const goldGrad = ctx.createLinearGradient(0, 0, W, 0);
      goldGrad.addColorStop(0, "#C9A84C"); goldGrad.addColorStop(0.5, "#E8C96A"); goldGrad.addColorStop(1, "#C9A84C");
      ctx.fillStyle = goldGrad;
      ctx.fillRect(0, headerH - 5, W, 5);

      // Building name
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "600 20px Poppins, system-ui, sans-serif";
      ctx.letterSpacing = "2px";
      ctx.fillText((config?.name || "NIVASA").toUpperCase(), pad, 50);
      ctx.letterSpacing = "0px";

      // "Minutes of Meeting" heading
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "800 52px Poppins, system-ui, sans-serif";
      ctx.fillText("📋 Minutes of Meeting", pad, 130);

      // Date
      ctx.fillStyle = "rgba(255,255,255,0.90)";
      ctx.font = "500 24px Poppins, system-ui, sans-serif";
      const dateStr = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      ctx.fillText(dateStr, pad, 178);

      // Title
      let y = headerH + 44;
      ctx.fillStyle = "#1C2B2D";
      ctx.font = "800 48px Poppins, system-ui, sans-serif";
      titleLines.forEach((line) => {
        ctx.fillText(line, pad, y);
        y += 60;
      });

      // Body preview
      if (bodyLines.length > 0) {
        y += 10;
        ctx.fillStyle = "#2D3B3E";
        ctx.font = "600 26px Poppins, system-ui, sans-serif";
        const maxBodyLines = bodyLines.slice(0, 6);
        maxBodyLines.forEach((line, i) => {
          let displayLine = line;
          if (i === maxBodyLines.length - 1 && bodyLines.length > 6) displayLine += "…";
          ctx.fillText(displayLine, pad, y);
          y += 38;
        });
      }

      // Content type badge
      if (rich) {
        y += 16;
        const icon = rich.type === "html" ? "🌐" : rich.type === "pdf" ? "📄" : rich.type === "docx" ? "📝" : rich.type === "image" ? "🖼️" : "📝";
        const label = rich.type === "html" ? "Full formatted page" : "Full text content";
        ctx.fillStyle = "#E8F4F5";
        roundRect(ctx, pad, y - 28, W - pad * 2, 56, 10);
        ctx.fill();
        ctx.fillStyle = "#1A6B72";
        ctx.font = "700 22px Poppins, system-ui, sans-serif";
        ctx.fillText(`${icon}  ${label} — open in app to view`, pad + 16, y + 2);
        y += 60;
      }

      // Footer
      const fy = H - footerH;
      ctx.fillStyle = "#1A6B72";
      ctx.fillRect(0, fy, W, footerH);
      ctx.fillStyle = goldGrad;
      ctx.fillRect(0, fy, W, 5);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "700 28px Poppins, system-ui, sans-serif";
      ctx.fillText("📖 Read full details on Nivasa", pad, fy + 42);
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "500 20px Poppins, system-ui, sans-serif";
      const shortLink = appLink.length > 80 ? appLink.slice(0, 80) + "…" : appLink;
      ctx.fillText(shortLink, pad, fy + 74);

      // Download
      const link = document.createElement("a");
      link.download = `${title.replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_").slice(0, 40)}_poster.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("Poster generation failed:", e);
      alert("Could not generate poster. Try taking a screenshot instead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button style={C.posterBtn} onClick={generate} disabled={busy}>
      {busy ? "Generating…" : "📸 Download Poster"}
    </button>
  );
}

// Canvas helper: word wrap
function wrapText(ctx, text, maxW, _lineH) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
// Canvas helper: rounded rectangle
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ──────────────────────────────────────────
   MoM EDITOR
   ────────────────────────────────────────── */
function MomEditor({ bid, activityId, mom, onDone }) {
  const [text, setText] = useState(mom);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await updateActivity(bid, activityId, { "meeting.mom": text.trim() });
      onDone();
    } catch (e) {
      console.error("Save MoM failed:", e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div>
      <textarea style={{ ...C.input, minHeight: 100, resize: "vertical", width: "100%" }} value={text}
        onChange={(e) => setText(e.target.value)} placeholder="Type the minutes of the meeting..." />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button style={C.ghostBtn} onClick={onDone}>Cancel</button>
        <button className="primaryBtn" style={{ ...S.primaryBtn, padding: "7px 14px" }} onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save MoM"}
        </button>
      </div>
    </div>
  );
}

/* FUNC-05: handle both numeric ms and Firestore Timestamp objects */
function timeAgo(ts) {
  if (!ts) return "";
  const ms = typeof ts === "number" ? ts : (ts.toMillis ? ts.toMillis() : Number(ts));
  if (isNaN(ms)) return "";
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const C = {
  newBtn: { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: T.ink, fontFamily: font },
  form: { background: "#fff", border: `1.5px solid ${T.water}`, borderRadius: 14, padding: "18px 20px", marginBottom: 16 },
  formHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  formTitle: { fontFamily: display, fontWeight: 700, fontSize: 16 },
  label: { display: "block", fontSize: 12.5, fontWeight: 600, color: T.ink, margin: "10px 0 5px" },
  input: { width: "100%", padding: "10px 12px", border: `1px solid ${T.line}`, borderRadius: 9, fontSize: 14, background: "#fff", color: T.ink, fontFamily: font, marginBottom: 4 },
  err: { marginTop: 10, background: T.owedSoft || "#FEF2F2", color: T.owed || "#D94343", padding: "9px 12px", borderRadius: 9, fontSize: 13 },
  closeBtn: { border: "none", background: "#F1F1F8", width: 28, height: 28, borderRadius: "50%", cursor: "pointer", fontSize: 12, color: T.inkSoft, flexShrink: 0 },
  ghostBtn: { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: T.inkSoft, fontFamily: font },
  card: { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, marginBottom: 10, overflow: "hidden" },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "14px 18px", cursor: "pointer", gap: 10 },
  typeTag: { fontSize: 11.5, fontWeight: 700, color: T.water, textTransform: "uppercase", letterSpacing: ".03em" },
  ago: { fontSize: 11.5, color: T.muted, marginLeft: 10 },
  cardTitle: { fontFamily: display, fontWeight: 700, fontSize: 15.5, marginTop: 4, color: T.ink },
  cardPreview: { fontSize: 13, color: T.inkSoft, marginTop: 4, lineHeight: 1.4 },
  cardBody: { padding: "0 18px 16px", borderTop: `1px solid ${T.line}`, paddingTop: 14 },
  bodyText: { fontSize: 14, color: T.ink, lineHeight: 1.6, whiteSpace: "pre-wrap" },
  subLabel: { fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 6 },
  shareBtn: { background: "#25D366", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font },
  posterBtn: { background: "#fff", border: `1.5px solid ${T.water}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: T.water, fontFamily: font },
  pollRow: { marginBottom: 6 },
  pollBtn: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", border: `1.5px solid ${T.line}`, borderRadius: 10, background: "#fff", fontFamily: font, fontSize: 14, color: T.ink },
  pollBtnActive: { borderColor: T.water, background: T.waterSoft, color: T.water, fontWeight: 700 },
  pollBar: { height: 4, borderRadius: 2, background: "#EEF0F6", marginTop: 3 },
  pollFill: { height: "100%", borderRadius: 2, background: T.water, transition: "width .3s" },
  textPreview: { fontSize: 14, color: T.ink, lineHeight: 1.7, whiteSpace: "pre-wrap", background: "#FAFBFE", padding: "16px 18px", borderRadius: 10, border: `1px solid ${T.line}`, maxHeight: 600, overflow: "auto" },
};
