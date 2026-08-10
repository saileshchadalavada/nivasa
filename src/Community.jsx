import React, { useState, useMemo } from "react";
import { createActivity, updateActivity, deleteActivity, voteOnPoll } from "./data";
import { money, fmtDate } from "./util";
import { styles as S, T, display, mono, font } from "./styles";

const TYPES = { announcement: "📢", poll: "📊", meeting: "📅" };
const TYPE_LABELS = { announcement: "Announcement", poll: "Poll", meeting: "Meeting" };
const uid = () => "a_" + Math.random().toString(36).slice(2, 8);

export default function Community({ bid, activities, membership, members, config, admin, mobile }) {
  const [creating, setCreating] = useState(null);  // null | "announcement" | "poll" | "meeting"
  const [editing, setEditing] = useState(null);     // activity id being edited
  const [expanded, setExpanded] = useState(null);   // activity id expanded

  const myFlat = membership?.flat || "";
  const sorted = useMemo(() =>
    [...(activities || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
  [activities]);

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
        <ActivityCard key={a.id} activity={a} bid={bid} myFlat={myFlat} admin={admin}
          members={members} expanded={expanded === a.id} mobile={mobile}
          onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
          onEdit={() => setEditing(a.id)} editing={editing === a.id}
          onEditDone={() => setEditing(null)} />
      ))}
    </>
  );
}

/* ---- Create form ---- */
function CreateForm({ type, bid, membership, onDone, onCancel }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // Poll fields
  const [options, setOptions] = useState(["", ""]);
  // Meeting fields
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");
  const [busy, setBusy] = useState(false);

  const addOption = () => setOptions([...options, ""]);
  const setOption = (i, v) => setOptions(options.map((o, idx) => idx === i ? v : o));
  const removeOption = (i) => options.length > 2 && setOptions(options.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    const base = { type, title: title.trim(), body: body.trim(), status: "published", createdBy: membership?.uid || "" };
    if (type === "poll") {
      base.poll = { options: options.filter((o) => o.trim()).map((o) => o.trim()), votes: {} };
    }
    if (type === "meeting") {
      base.meeting = { date, time, location: location.trim(), agenda: agenda.trim(), mom: "" };
    }
    await createActivity(bid, base);
    setBusy(false);
    onDone();
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
          <label style={C.label}>{type === "meeting" ? "Description" : "Message"}</label>
          <textarea style={{ ...C.input, minHeight: 80, resize: "vertical" }} value={body}
            onChange={(e) => setBody(e.target.value)} placeholder="Details..." />
        </>
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
            <label style={C.label}>Date</label>
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

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button style={C.ghostBtn} onClick={onCancel}>Cancel</button>
        <button className="primaryBtn" style={{ ...S.primaryBtn, flex: 1 }} onClick={submit} disabled={busy || !title.trim()}>
          {busy ? "Publishing..." : `Publish ${TYPE_LABELS[type].toLowerCase()}`}
        </button>
      </div>
    </div>
  );
}

/* ---- Activity card ---- */
function ActivityCard({ activity: a, bid, myFlat, admin, members, expanded, mobile, onToggle, onEdit, editing, onEditDone }) {
  const isPoll = a.type === "poll";
  const isMeeting = a.type === "meeting";
  const totalVotes = isPoll ? Object.keys(a.poll?.votes || {}).length : 0;
  const myVote = isPoll ? a.poll?.votes?.[myFlat] : undefined;
  const ago = timeAgo(a.createdAt);

  const appLink = `https://nivasa-myhomeapp.vercel.app?b=${bid}`;

  const shareText = () => {
    let msg = `${TYPES[a.type]} *${a.title}*\n`;
    if (a.body) msg += `\n${a.body}\n`;
    if (isPoll) {
      msg += "\nOptions:\n";
      (a.poll?.options || []).forEach((o, i) => { msg += `${i + 1}. ${o}\n`; });
      msg += `\n👉 Vote now: ${appLink}\nResults update live in the app!`;
    }
    if (isMeeting) {
      const m = a.meeting || {};
      if (m.date) msg += `\n📅 ${fmtDate(m.date)}${m.time ? ` at ${m.time}` : ""}`;
      if (m.location) msg += `\n📍 ${m.location}`;
      if (m.agenda) msg += `\n\n${m.agenda}`;
      msg += `\n\n👉 Details: ${appLink}`;
    }
    if (a.type === "announcement") {
      msg += `\n👉 Open app: ${appLink}`;
    }
    return msg;
  };

  const share = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText())}`;
    window.open(url, "_blank");
  };

  const doVote = (idx) => {
    if (!myFlat) return;
    voteOnPoll(bid, a.id, myFlat, idx);
  };

  const doDelete = () => {
    if (window.confirm(`Delete this ${TYPE_LABELS[a.type].toLowerCase()}? This cannot be undone.`)) {
      deleteActivity(bid, a.id);
    }
  };

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
          {!expanded && isPoll && <span style={{ fontSize: 12, color: T.muted }}>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>}
        </div>
        <span style={{ fontSize: 18, color: T.muted, flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={C.cardBody}>
          {a.body && <div style={C.bodyText}>{a.body}</div>}

          {/* Poll */}
          {isPoll && (
            <div style={{ marginTop: 12 }}>
              {(a.poll?.options || []).map((opt, i) => {
                const count = Object.values(a.poll?.votes || {}).filter((v) => v === i).length;
                const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                const isMyVote = myVote === i;
                return (
                  <div key={i} style={C.pollRow}>
                    <button onClick={() => doVote(i)} disabled={!myFlat}
                      style={{ ...C.pollBtn, ...(isMyVote ? C.pollBtnActive : {}), cursor: myFlat ? "pointer" : "default" }}>
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
                {totalVotes} vote{totalVotes !== 1 ? "s" : ""}{myVote != null ? " · you voted" : myFlat ? " · tap an option to vote" : ""}
              </div>
              {admin && totalVotes > 0 && (
                <details style={{ marginTop: 10, fontSize: 12.5, color: T.inkSoft }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>Who voted what</summary>
                  <div style={{ marginTop: 6 }}>
                    {Object.entries(a.poll?.votes || {}).map(([flat, idx]) => {
                      const m = members.find((mm) => mm.flat === flat);
                      return <div key={flat}>Flat {flat} ({m?.username || "?"}) → {a.poll.options[idx] || "?"}</div>;
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

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button style={C.shareBtn} onClick={share}>💬 Share on WhatsApp</button>
            {admin && <button style={C.ghostBtn} onClick={doDelete}>🗑 Delete</button>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- MoM editor ---- */
function MomEditor({ bid, activityId, mom, onDone }) {
  const [text, setText] = useState(mom);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    await updateActivity(bid, activityId, { "meeting.mom": text.trim() });
    setSaving(false);
    onDone();
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

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const C = {
  newBtn: { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: T.ink, fontFamily: font },
  form: { background: "#fff", border: `1.5px solid ${T.water}`, borderRadius: 14, padding: "18px 20px", marginBottom: 16 },
  formHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  formTitle: { fontFamily: display, fontWeight: 700, fontSize: 16 },
  label: { display: "block", fontSize: 12.5, fontWeight: 600, color: T.ink, margin: "10px 0 5px" },
  input: { width: "100%", padding: "10px 12px", border: `1px solid ${T.line}`, borderRadius: 9, fontSize: 14, background: "#fff", color: T.ink, fontFamily: font, marginBottom: 4 },
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
  pollRow: { marginBottom: 6 },
  pollBtn: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", border: `1.5px solid ${T.line}`, borderRadius: 10, background: "#fff", fontFamily: font, fontSize: 14, color: T.ink },
  pollBtnActive: { borderColor: T.water, background: T.waterSoft, color: T.water, fontWeight: 700 },
  pollBar: { height: 4, borderRadius: 2, background: "#EEF0F6", marginTop: 3 },
  pollFill: { height: "100%", borderRadius: 2, background: T.water, transition: "width .3s" },
};
