import React, { useState, useMemo } from "react";
import { createEvent, updateEvent } from "./data";
import { money, fmtDate } from "./util";
import { styles as S, T, display, mono, font } from "./styles";

const CATEGORIES = {
  decoration: "Decoration", pooja: "Pooja", food: "Food",
  transport: "Transport", stage: "Stage / Sound", misc: "Misc",
};
const DON_TYPES = {
  contribution: "Contribution", velampata: "Velam Pata",
  contra: "Item Donation", carryforward: "Carry Forward", external: "External",
};

export default function Events({ bid, events, membership, flats, admin, mobile, initialEventId }) {
  const residential = useMemo(
    () => flats.filter((f) => !f.isCommon).sort((a, b) => a.flat.localeCompare(b.flat)),
    [flats]
  );
  const sorted = useMemo(
    () => [...events].sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;
      return (b.year || 0) - (a.year || 0);
    }),
    [events]
  );

  const [selId, setSelId] = useState(initialEventId || null);
  const [creating, setCreating] = useState(false);

  const selEvent = selId ? events.find((e) => e.id === selId) : sorted[0] || null;

  if (creating) {
    return (
      <CreateEventForm bid={bid}
        onDone={(id) => { setSelId(id); setCreating(false); }}
        onCancel={() => setCreating(false)} />
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <h2 style={S.section}>Events</h2>
        {admin && <button style={E.newBtn} onClick={() => setCreating(true)}>+ New event</button>}
      </div>

      {sorted.length === 0 ? (
        <div style={{ color: T.muted, fontSize: 14, padding: "40px 0", textAlign: "center" }}>
          No events yet.{admin ? " Create the first one to start tracking festival donations." : ""}
        </div>
      ) : (
        <>
          {sorted.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft }}>Event</label>
              <select value={selId || selEvent?.id || ""} onChange={(e) => setSelId(e.target.value)} style={S.periodPickSelect}>
                {sorted.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.year}){ev.status === "active" ? "  • active" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selEvent && (
            <EventDetail
              key={selEvent.id}
              event={selEvent}
              bid={bid}
              admin={admin}
              mobile={mobile}
              residential={residential}
            />
          )}
        </>
      )}
    </>
  );
}

/* ---- Create Event Form ---- */
function CreateEventForm({ bid, onDone, onCancel }) {
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [targetAmount, setTargetAmount] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    if (!name.trim()) return setErr("Event name is required.");
    setBusy(true);
    try {
      const id = await createEvent(bid, {
        name: name.trim(),
        year: Number(year),
        status: "active",
        targetAmount: Number(targetAmount) || 0,
        openingBalance: Number(openingBalance) || 0,
        donations: [],
        expenses: [],
        receivables: [],
      });
      onDone(id);
    } catch (e) {
      setErr("Could not create event. Please try again.");
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={E.form}>
      <div style={E.formHead}>
        <span style={E.formTitle}>New Event</span>
        <button style={E.iconBtn} onClick={onCancel}>✕</button>
      </div>
      <div style={S.inputGrid}>
        <label style={S.field}>
          <span style={S.fieldLabel}>Event name *</span>
          <input style={S.fieldInput} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Vinayaka Chavithi 2025" autoFocus />
        </label>
        <label style={S.field}>
          <span style={S.fieldLabel}>Year</span>
          <input type="number" style={S.fieldInput} value={year}
            onChange={(e) => setYear(e.target.value)} />
        </label>
        <label style={S.field}>
          <span style={S.fieldLabel}>Target amount <span style={S.fieldSub}>(₹, 0 = no target)</span></span>
          <input type="number" style={S.fieldInput} value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)} placeholder="0" />
        </label>
        <label style={S.field}>
          <span style={S.fieldLabel}>Opening balance <span style={S.fieldSub}>(carry forward)</span></span>
          <input type="number" style={S.fieldInput} value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0" />
        </label>
      </div>
      {err && <div style={E.err}>{err}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button style={E.ghostBtn} onClick={onCancel}>Cancel</button>
        <button className="primaryBtn" style={{ ...S.primaryBtn, flex: 1 }}
          onClick={submit} disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Create event"}
        </button>
      </div>
    </div>
  );
}

/* ---- Event Detail ---- */
function EventDetail({ event: ev, bid, admin, mobile, residential }) {
  const [tab, setTab] = useState("donations");
  const [editingOB, setEditingOB] = useState(false);
  const [obDraft, setObDraft] = useState("");

  const donations = ev.donations || [];
  const expenses = ev.expenses || [];
  const receivables = ev.receivables || [];

  const totalCollected = donations.reduce((s, d) => s + Number(d.amount || 0), 0);
  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const balance = totalCollected - totalSpent;
  const progress = ev.targetAmount > 0
    ? Math.min(100, Math.round((balance / ev.targetAmount) * 100))
    : null;

  const isActive = ev.status === "active";
  const patchEvent = (patch) => updateEvent(bid, ev.id, patch);

  const startEditOB = () => { setObDraft(String(ev.openingBalance ?? 0)); setEditingOB(true); };
  const saveOB = async () => { await patchEvent({ openingBalance: Number(obDraft) || 0 }); setEditingOB(false); };
  const cancelOB = () => setEditingOB(false);

  const closeEvent = () => {
    if (window.confirm(
      `Close "${ev.name}"?\n\nClosing balance: ${money(balance)}\n\nYou can use this as the opening balance for the next event.`
    )) {
      patchEvent({ status: "closed", closingBalance: balance });
    }
  };

  const reopenEvent = () => {
    if (window.confirm(`Reopen "${ev.name}"? Entries will become editable again.`)) {
      patchEvent({ status: "active" });
    }
  };

  const shareWhatsApp = () => {
    const catMap = {};
    expenses.forEach((ex) => { const c = ex.category || "misc"; catMap[c] = (catMap[c] || 0) + Number(ex.amount || 0); });
    const topCats = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, amt]) => `${CATEGORIES[cat] || cat} ${money(amt)}`)
      .join(" | ");

    const lines = [
      `🎉 *${ev.name}*`,
      ``,
      `💰 Collected: ${money(totalCollected)} (${donations.length} donors)`,
      `💸 Spent: ${money(totalSpent)} (${expenses.length} expenses)`,
      `🏦 Balance: ${money(balance)}`,
      ...(topCats ? [``, `Top categories: ${topCats}`] : []),
      ``,
      `📖 View full details on Nivasa:`,
      `https://nivasa-myhomeapp.vercel.app/?b=${bid}&tab=events&e=${ev.id}`,
    ];
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
  };

  return (
    <>
      {/* Event header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: display, fontWeight: 800, fontSize: 20, color: T.ink }}>{ev.name}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
              background: isActive ? "#E8F9EE" : "#F1F1F8",
              color: isActive ? T.money : T.muted,
              textTransform: "uppercase", letterSpacing: ".04em",
            }}>
              {ev.status}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3 }}>
            {ev.year}{ev.targetAmount > 0 && ` · Target: ${money(ev.targetAmount)}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={E.shareBtn} onClick={shareWhatsApp}>💬 Share</button>
          <EventPosterButton ev={ev} />
          {admin && isActive && (
            <button style={E.closeBtn2} onClick={closeEvent}>Close event</button>
          )}
          {admin && !isActive && (
            <button style={E.reopenBtn} onClick={reopenEvent}>🔓 Reopen event</button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div style={S.cards}>
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={S.cardLabel}>Opening balance</div>
            {admin && isActive && !editingOB && (
              <button style={E.editBtn} onClick={startEditOB} title="Edit opening balance">✏️</button>
            )}
          </div>
          {editingOB ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
              <input type="number" style={{ ...S.fieldInput, width: 100, padding: "5px 8px", fontSize: 14, fontFamily: font }}
                value={obDraft} autoFocus
                onChange={(e) => setObDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveOB(); if (e.key === "Escape") cancelOB(); }} />
              <button style={E.iconBtn} onClick={cancelOB} title="Cancel">✕</button>
              <button className="primaryBtn" style={{ ...S.primaryBtn, padding: "5px 12px", fontSize: 12 }} onClick={saveOB}>✓</button>
            </div>
          ) : (
            <>
              <div style={{ ...S.cardValue, color: T.ink }}>{money(ev.openingBalance || 0)}</div>
              <div style={S.cardNote}>carry forward</div>
            </>
          )}
        </div>
        <ECard label="Total collected" value={money(totalCollected)} tone="money" note={`${donations.length} entr${donations.length === 1 ? "y" : "ies"}`} />
        <ECard label="Total spent" value={money(totalSpent)} tone="owed" note={`${expenses.length} expense${expenses.length === 1 ? "" : "s"}`} />
        <ECard label="Balance" value={money(balance)} tone={balance >= 0 ? "money" : "owed"} note={ev.targetAmount > 0 ? `${progress}% of target` : "available"} />
      </div>

      {/* Progress bar */}
      {ev.targetAmount > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.inkSoft, marginBottom: 4 }}>
            <span>Progress towards target</span>
            <span style={{ fontFamily: mono, fontWeight: 700 }}>{progress}% · {money(balance)} / {money(ev.targetAmount)}</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: T.line }}>
            <div style={{ height: "100%", borderRadius: 4, background: progress >= 100 ? T.money : T.water, width: `${progress}%`, transition: "width .3s" }} />
          </div>
        </div>
      )}

      {/* Inner tabs */}
      <div style={E.innerTabs}>
        {[["donations", "💰 Donations"], ["expenses", "💸 Expenses"], ["receivables", "📋 Receivables"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...E.innerTab, ...(tab === k ? E.innerTabOn : {}) }}>{l}</button>
        ))}
      </div>

      {tab === "donations" && (
        <DonationsTab
          ev={ev} bid={bid} admin={admin} mobile={mobile} residential={residential}
          isActive={isActive}
          onSave={(dons, exps) => patchEvent({ donations: dons, expenses: exps })} />
      )}
      {tab === "expenses" && (
        <ExpensesTab
          ev={ev} bid={bid} admin={admin} mobile={mobile} residential={residential}
          isActive={isActive}
          onSave={(exps, dons) => patchEvent({ expenses: exps, donations: dons })} />
      )}
      {tab === "receivables" && (
        <ReceivablesTab
          ev={ev} bid={bid} admin={admin} mobile={mobile} residential={residential}
          isActive={isActive}
          onSave={(recs) => patchEvent({ receivables: recs })} />
      )}
    </>
  );
}

/* ---- Donations Tab ---- */
function DonationsTab({ ev, admin, mobile, residential, isActive, onSave }) {
  const donations = ev.donations || [];
  const expenses = ev.expenses || [];

  const blank = () => ({
    date: new Date().toISOString().slice(0, 10),
    flat: "", name: "", amount: "", type: "contribution", remarks: "", isExternal: false,
  });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blank());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const sorted = [...donations].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const total = donations.reduce((s, d) => s + Number(d.amount || 0), 0);

  const flatName = (flat) => residential.find((f) => f.flat === flat)?.name || "";

  const startEdit = (d) => {
    setAdding(false);
    setEditingId(d.id);
    setEditForm({
      date: d.date || new Date().toISOString().slice(0, 10),
      flat: d.flat || "",
      name: d.name || "",
      amount: String(d.amount || ""),
      type: d.type === "external" ? "contribution" : (d.type || "contribution"),
      remarks: d.remarks || "",
      isExternal: !!(d.isExternal || d.type === "external"),
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm(null); };

  const saveEdit = async () => {
    if (!editForm) return;
    const amt = Number(editForm.amount);
    if (amt <= 0) return;
    if (!editForm.isExternal && !editForm.flat) return;
    if (editForm.isExternal && !editForm.name.trim()) return;
    setBusy(true);
    try {
      const orig = donations.find((d) => d.id === editingId);
      const updated = {
        ...orig,
        date: editForm.date,
        amount: amt,
        type: editForm.isExternal ? "external" : editForm.type,
        flat: editForm.isExternal ? "" : editForm.flat,
        name: editForm.isExternal ? editForm.name.trim() : (editForm.name || flatName(editForm.flat)),
        remarks: editForm.remarks.trim(),
        isExternal: editForm.isExternal,
      };
      await onSave(donations.map((d) => d.id === editingId ? updated : d), expenses);
      cancelEdit();
    } finally { setBusy(false); }
  };

  const add = async () => {
    const amt = Number(form.amount);
    if (amt <= 0) return;
    if (!form.isExternal && !form.flat) return;
    if (form.isExternal && !form.name.trim()) return;
    setBusy(true);
    try {
      const id = "d_" + Math.random().toString(36).slice(2, 8);
      const entry = {
        id, date: form.date, amount: amt,
        type: form.isExternal ? "external" : form.type,
        flat: form.isExternal ? "" : form.flat,
        name: form.isExternal ? form.name.trim() : (form.name || flatName(form.flat)),
        remarks: form.remarks.trim(),
        isExternal: form.isExternal,
      };
      let newDons = [...donations, entry];
      let newExps = expenses;
      if (!form.isExternal && form.type === "contra") {
        newExps = [...expenses, {
          id: "e_contra_" + id,
          date: form.date,
          description: form.remarks.trim() || `Item donation – ${entry.name || `Flat ${form.flat}`}`,
          amount: amt,
          paidBy: form.flat,
          status: "donation",
          category: "misc",
          remarks: "Auto from contra entry",
        }];
      }
      await onSave(newDons, newExps);
      setAdding(false); setForm(blank());
    } finally { setBusy(false); }
  };

  const remove = (id) => {
    if (window.confirm("Remove this donation entry?")) {
      onSave(donations.filter((d) => d.id !== id), expenses);
    }
  };

  const donEditForm = editForm && (
    <div style={{ ...E.formInline, margin: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: T.ink }}>Edit donation</span>
        <button style={E.iconBtn} onClick={cancelEdit}>✕</button>
      </div>
      <div style={S.inputGrid}>
        <label style={S.field}>
          <span style={S.fieldLabel}>Date</span>
          <input type="date" style={S.fieldInput} value={editForm.date}
            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
        </label>
        <label style={S.field}>
          <span style={S.fieldLabel}>Type</span>
          <select style={{ ...S.fieldInput, fontFamily: "inherit" }} value={editForm.type}
            onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
            disabled={editForm.isExternal}>
            {Object.entries(DON_TYPES).filter(([k]) => k !== "external").map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", margin: "8px 0" }}>
        <input type="checkbox" checked={editForm.isExternal}
          onChange={(e) => setEditForm({ ...editForm, isExternal: e.target.checked, flat: "", name: "" })} />
        External donor
      </label>
      <div style={S.inputGrid}>
        {editForm.isExternal ? (
          <label style={S.field}>
            <span style={S.fieldLabel}>Donor name *</span>
            <input style={S.fieldInput} value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </label>
        ) : (
          <label style={S.field}>
            <span style={S.fieldLabel}>Flat *</span>
            <select style={{ ...S.fieldInput, fontFamily: "inherit" }} value={editForm.flat}
              onChange={(e) => setEditForm({ ...editForm, flat: e.target.value, name: flatName(e.target.value) })}>
              <option value="">— select —</option>
              {residential.map((f) => <option key={f.flat} value={f.flat}>Flat {f.flat} – {f.name}</option>)}
            </select>
          </label>
        )}
        <label style={S.field}>
          <span style={S.fieldLabel}>Amount (₹) *</span>
          <input type="number" style={S.fieldInput} value={editForm.amount}
            onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
        </label>
        <label style={{ ...S.field, gridColumn: "1 / -1" }}>
          <span style={S.fieldLabel}>Remarks</span>
          <input style={S.fieldInput} value={editForm.remarks}
            onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button style={E.ghostBtn} onClick={cancelEdit}>Cancel</button>
        <button className="primaryBtn" style={{ ...S.primaryBtn, flex: 1 }} onClick={saveEdit}
          disabled={busy || Number(editForm.amount) <= 0 || (!editForm.isExternal && !editForm.flat) || (editForm.isExternal && !editForm.name.trim())}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {donations.length === 0 && !adding && (
        <div style={{ color: T.muted, fontSize: 14, padding: "20px 0", textAlign: "center" }}>
          No donations recorded yet.{isActive && admin ? " Add the first one below." : ""}
        </div>
      )}

      {donations.length > 0 && (mobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {sorted.map((d) => (
            <div key={d.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px" }}>
              {editingId === d.id ? donEditForm : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    {d.isExternal || d.type === "external"
                      ? <><span style={E.extTag}>Ext</span> {d.name}</>
                      : d.flat
                        ? <><b style={{ fontFamily: display }}>Flat {d.flat}</b>{d.name ? <span style={{ color: T.muted, fontSize: 12.5, marginLeft: 4 }}>{d.name}</span> : null}</>
                        : <b style={{ fontFamily: display }}>{d.name || "—"}</b>}
                    <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{DON_TYPES[d.type] || d.type} · {fmtDate(d.date)}</div>
                    {d.remarks && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{d.remarks}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: mono, fontWeight: 700, color: T.money }}>{money(d.amount)}</span>
                    {isActive && admin && <button style={E.editBtn} onClick={() => startEdit(d)}>✏️</button>}
                    {isActive && admin && <button className="del" style={S.del} onClick={() => remove(d.id)}>✕</button>}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div style={{ background: "#F7F7FC", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
            <span>Total collected</span>
            <span style={{ fontFamily: mono, color: T.money }}>{money(total)}</span>
          </div>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Date</th>
              <th style={S.th}>Donor</th>
              <th style={S.th}>Type</th>
              <th style={{ ...S.th, textAlign: "right" }}>Amount</th>
              <th style={S.th}>Remarks</th>
              {admin && isActive && <th style={S.th} />}
            </tr></thead>
            <tbody>
              {sorted.map((d) => (
                editingId === d.id ? (
                  <tr key={d.id}>
                    <td colSpan={admin && isActive ? 6 : 5} style={{ padding: "8px 4px" }}>
                      {donEditForm}
                    </td>
                  </tr>
                ) : (
                  <tr key={d.id}>
                    <td style={{ ...S.td, fontFamily: mono, fontSize: 12.5 }}>{fmtDate(d.date)}</td>
                    <td style={S.td}>
                      {d.isExternal || d.type === "external"
                        ? <><span style={E.extTag}>Ext</span> {d.name}</>
                        : d.flat
                          ? <><b>Flat {d.flat}</b>{d.name ? <span style={{ color: T.muted, fontSize: 12.5, marginLeft: 4 }}>{d.name}</span> : null}</>
                          : <b>{d.name || "—"}</b>}
                    </td>
                    <td style={{ ...S.td, fontSize: 12.5, color: T.inkSoft }}>{DON_TYPES[d.type] || d.type}</td>
                    <td style={{ ...S.td, ...S.num, fontWeight: 700, color: T.money }}>{money(d.amount)}</td>
                    <td style={{ ...S.td, fontSize: 12, color: T.muted }}>{d.remarks || "—"}</td>
                    {admin && isActive && (
                      <td style={{ ...S.td, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button style={E.editBtn} onClick={() => startEdit(d)}>✏️</button>
                          <button className="del" style={S.del} onClick={() => remove(d.id)}>✕</button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              ))}
            </tbody>
            <tfoot><tr>
              <td style={S.tfoot} colSpan={3}>Total</td>
              <td style={{ ...S.tfoot, ...S.num }}>{money(total)}</td>
              <td style={S.tfoot} colSpan={admin && isActive ? 2 : 1} />
            </tr></tfoot>
          </table>
        </div>
      ))}

      {isActive && admin && !adding && (
        <button className="add" style={S.addBtn} onClick={() => { cancelEdit(); setAdding(true); }}>+ Add donation</button>
      )}

      {isActive && admin && adding && (
        <div style={E.formInline}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: T.ink }}>Add donation</div>
          <div style={S.inputGrid}>
            <label style={S.field}>
              <span style={S.fieldLabel}>Date</span>
              <input type="date" style={S.fieldInput} value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label style={S.field}>
              <span style={S.fieldLabel}>Type</span>
              <select style={{ ...S.fieldInput, fontFamily: "inherit" }} value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(DON_TYPES).filter(([k]) => k !== "external").map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", margin: "8px 0" }}>
            <input type="checkbox" checked={form.isExternal}
              onChange={(e) => setForm({ ...form, isExternal: e.target.checked, flat: "", name: "" })} />
            External donor (not a flat member)
          </label>
          <div style={S.inputGrid}>
            {form.isExternal ? (
              <label style={S.field}>
                <span style={S.fieldLabel}>Donor name *</span>
                <input style={S.fieldInput} value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Subhash from Block B" />
              </label>
            ) : (
              <label style={S.field}>
                <span style={S.fieldLabel}>Flat *</span>
                <select style={{ ...S.fieldInput, fontFamily: "inherit" }} value={form.flat}
                  onChange={(e) => setForm({ ...form, flat: e.target.value, name: flatName(e.target.value) })}>
                  <option value="">— select —</option>
                  {residential.map((f) => <option key={f.flat} value={f.flat}>Flat {f.flat} – {f.name}</option>)}
                </select>
              </label>
            )}
            <label style={S.field}>
              <span style={S.fieldLabel}>Amount (₹) *</span>
              <input type="number" style={S.fieldInput} value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
            </label>
            <label style={{ ...S.field, gridColumn: "1 / -1" }}>
              <span style={S.fieldLabel}>Remarks</span>
              <input style={S.fieldInput} value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder={form.type === "contra" ? "e.g. Coconuts and flowers donated" : "Optional"} />
            </label>
          </div>
          {!form.isExternal && form.type === "contra" && (
            <div style={E.hint}>A matching expense entry will be auto-created.</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button style={E.ghostBtn} onClick={() => { setAdding(false); setForm(blank()); }}>Cancel</button>
            <button className="primaryBtn" style={{ ...S.primaryBtn, flex: 1 }} onClick={add}
              disabled={busy || Number(form.amount) <= 0 || (!form.isExternal && !form.flat) || (form.isExternal && !form.name.trim())}>
              {busy ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---- Expenses Tab ---- */
function ExpensesTab({ ev, admin, mobile, residential, isActive, onSave }) {
  const expenses = ev.expenses || [];
  const donations = ev.donations || [];

  const blank = () => ({
    date: new Date().toISOString().slice(0, 10),
    description: "", amount: "", paidBy: "fund",
    status: "settled", category: "misc", remarks: "",
  });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blank());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const sorted = [...expenses].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const startEdit = (ex) => {
    setAdding(false);
    setEditingId(ex.id);
    setEditForm({
      date: ex.date || new Date().toISOString().slice(0, 10),
      description: ex.description || "",
      amount: String(ex.amount || ""),
      paidBy: ex.paidBy || "fund",
      status: ex.status || "settled",
      category: ex.category || "misc",
      remarks: ex.remarks || "",
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm(null); };

  const saveEdit = async () => {
    if (!editForm) return;
    const amt = Number(editForm.amount);
    if (!editForm.description.trim() || amt <= 0) return;
    setBusy(true);
    try {
      const orig = expenses.find((e) => e.id === editingId);
      const updated = {
        ...orig,
        date: editForm.date,
        description: editForm.description.trim(),
        amount: amt,
        paidBy: editForm.paidBy,
        status: editForm.status,
        category: editForm.category,
        remarks: editForm.remarks.trim(),
      };
      await onSave(expenses.map((e) => e.id === editingId ? updated : e), donations);
      cancelEdit();
    } finally { setBusy(false); }
  };

  const add = async () => {
    const amt = Number(form.amount);
    if (!form.description.trim() || amt <= 0) return;
    setBusy(true);
    try {
      const id = "e_" + Math.random().toString(36).slice(2, 8);
      const entry = {
        id, date: form.date, description: form.description.trim(),
        amount: amt, paidBy: form.paidBy, status: form.status,
        category: form.category, remarks: form.remarks.trim(),
      };
      let newExps = [...expenses, entry];
      let newDons = donations;
      if (form.status === "donation") {
        const fName = form.paidBy !== "fund"
          ? (residential.find((f) => f.flat === form.paidBy)?.name || "")
          : "";
        newDons = [...donations, {
          id: "d_contra_" + id,
          date: form.date,
          flat: form.paidBy !== "fund" ? form.paidBy : "",
          name: fName,
          amount: amt,
          type: "contra",
          remarks: form.description.trim(),
          isExternal: form.paidBy === "fund",
        }];
      }
      await onSave(newExps, newDons);
      setAdding(false); setForm(blank());
    } finally { setBusy(false); }
  };

  const remove = (id) => {
    if (window.confirm("Remove this expense?")) {
      onSave(expenses.filter((e) => e.id !== id), donations);
    }
  };

  const STATUS_LABEL = { settled: "Settled", donation: "Donation in kind" };

  const expEditForm = editForm && (
    <div style={{ ...E.formInline, margin: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: T.ink }}>Edit expense</span>
        <button style={E.iconBtn} onClick={cancelEdit}>✕</button>
      </div>
      <div style={S.inputGrid}>
        <label style={S.field}>
          <span style={S.fieldLabel}>Date</span>
          <input type="date" style={S.fieldInput} value={editForm.date}
            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
        </label>
        <label style={S.field}>
          <span style={S.fieldLabel}>Category</span>
          <select style={{ ...S.fieldInput, fontFamily: "inherit" }} value={editForm.category}
            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label style={{ ...S.field, gridColumn: "1 / -1" }}>
          <span style={S.fieldLabel}>Description *</span>
          <input style={S.fieldInput} value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
        </label>
        <label style={S.field}>
          <span style={S.fieldLabel}>Amount (₹) *</span>
          <input type="number" style={S.fieldInput} value={editForm.amount}
            onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
        </label>
        <label style={S.field}>
          <span style={S.fieldLabel}>Paid by</span>
          <select style={{ ...S.fieldInput, fontFamily: "inherit" }} value={editForm.paidBy}
            onChange={(e) => setEditForm({ ...editForm, paidBy: e.target.value })}>
            <option value="fund">Association fund</option>
            {residential.map((f) => <option key={f.flat} value={f.flat}>Flat {f.flat} – {f.name}</option>)}
          </select>
        </label>
        <label style={S.field}>
          <span style={S.fieldLabel}>Status</span>
          <select style={{ ...S.fieldInput, fontFamily: "inherit" }} value={editForm.status}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
            <option value="settled">Settled (cash / UPI)</option>
            <option value="donation">Donation in kind (contra)</option>
          </select>
        </label>
        <label style={{ ...S.field, gridColumn: "1 / -1" }}>
          <span style={S.fieldLabel}>Remarks</span>
          <input style={S.fieldInput} value={editForm.remarks}
            onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button style={E.ghostBtn} onClick={cancelEdit}>Cancel</button>
        <button className="primaryBtn" style={{ ...S.primaryBtn, flex: 1 }} onClick={saveEdit}
          disabled={busy || !editForm.description.trim() || Number(editForm.amount) <= 0}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {expenses.length === 0 && !adding && (
        <div style={{ color: T.muted, fontSize: 14, padding: "20px 0", textAlign: "center" }}>
          No expenses yet.{isActive && admin ? " Add the first one below." : ""}
        </div>
      )}

      {expenses.length > 0 && (mobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {sorted.map((ex) => (
            <div key={ex.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px" }}>
              {editingId === ex.id ? expEditForm : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{ex.description}</div>
                    <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>
                      {CATEGORIES[ex.category] || ex.category} · {fmtDate(ex.date)}
                      {ex.paidBy !== "fund" && ` · Flat ${ex.paidBy}`}
                    </div>
                    <div style={{ fontSize: 12, color: ex.status === "donation" ? T.water : T.inkSoft, marginTop: 2 }}>
                      {STATUS_LABEL[ex.status] || ex.status}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: mono, fontWeight: 700, color: T.owed }}>{money(ex.amount)}</span>
                    {isActive && admin && <button style={E.editBtn} onClick={() => startEdit(ex)}>✏️</button>}
                    {isActive && admin && <button className="del" style={S.del} onClick={() => remove(ex.id)}>✕</button>}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div style={{ background: "#F7F7FC", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
            <span>Total spent</span>
            <span style={{ fontFamily: mono, color: T.owed }}>{money(total)}</span>
          </div>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Date</th>
              <th style={S.th}>Description</th>
              <th style={S.th}>Category</th>
              <th style={S.th}>Paid by</th>
              <th style={{ ...S.th, textAlign: "right" }}>Amount</th>
              <th style={S.th}>Status</th>
              {admin && isActive && <th style={S.th} />}
            </tr></thead>
            <tbody>
              {sorted.map((ex) => (
                editingId === ex.id ? (
                  <tr key={ex.id}>
                    <td colSpan={admin && isActive ? 7 : 6} style={{ padding: "8px 4px" }}>
                      {expEditForm}
                    </td>
                  </tr>
                ) : (
                  <tr key={ex.id}>
                    <td style={{ ...S.td, fontFamily: mono, fontSize: 12.5 }}>{fmtDate(ex.date)}</td>
                    <td style={{ ...S.td, fontWeight: 600 }}>{ex.description}</td>
                    <td style={{ ...S.td, fontSize: 12.5, color: T.inkSoft }}>{CATEGORIES[ex.category] || ex.category}</td>
                    <td style={{ ...S.td, fontSize: 12.5 }}>
                      {ex.paidBy === "fund" ? <span style={{ color: T.muted }}>Fund</span> : `Flat ${ex.paidBy}`}
                    </td>
                    <td style={{ ...S.td, ...S.num, fontWeight: 700, color: T.owed }}>{money(ex.amount)}</td>
                    <td style={{ ...S.td, fontSize: 12 }}>
                      <span style={{ color: ex.status === "donation" ? T.water : T.inkSoft }}>
                        {STATUS_LABEL[ex.status] || ex.status}
                      </span>
                    </td>
                    {admin && isActive && (
                      <td style={{ ...S.td, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button style={E.editBtn} onClick={() => startEdit(ex)}>✏️</button>
                          <button className="del" style={S.del} onClick={() => remove(ex.id)}>✕</button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              ))}
            </tbody>
            <tfoot><tr>
              <td style={S.tfoot} colSpan={4}>Total</td>
              <td style={{ ...S.tfoot, ...S.num }}>{money(total)}</td>
              <td style={S.tfoot} colSpan={admin && isActive ? 2 : 1} />
            </tr></tfoot>
          </table>
        </div>
      ))}

      {isActive && admin && !adding && (
        <button className="add" style={S.addBtn} onClick={() => { cancelEdit(); setAdding(true); }}>+ Add expense</button>
      )}

      {isActive && admin && adding && (
        <div style={E.formInline}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: T.ink }}>Add expense</div>
          <div style={S.inputGrid}>
            <label style={S.field}>
              <span style={S.fieldLabel}>Date</span>
              <input type="date" style={S.fieldInput} value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label style={S.field}>
              <span style={S.fieldLabel}>Category</span>
              <select style={{ ...S.fieldInput, fontFamily: "inherit" }} value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label style={{ ...S.field, gridColumn: "1 / -1" }}>
              <span style={S.fieldLabel}>Description *</span>
              <input style={S.fieldInput} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Pooja items from Sri Rama Stores" />
            </label>
            <label style={S.field}>
              <span style={S.fieldLabel}>Amount (₹) *</span>
              <input type="number" style={S.fieldInput} value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
            </label>
            <label style={S.field}>
              <span style={S.fieldLabel}>Paid by</span>
              <select style={{ ...S.fieldInput, fontFamily: "inherit" }} value={form.paidBy}
                onChange={(e) => setForm({ ...form, paidBy: e.target.value })}>
                <option value="fund">Association fund</option>
                {residential.map((f) => <option key={f.flat} value={f.flat}>Flat {f.flat} – {f.name}</option>)}
              </select>
            </label>
            <label style={S.field}>
              <span style={S.fieldLabel}>Status</span>
              <select style={{ ...S.fieldInput, fontFamily: "inherit" }} value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="settled">Settled (cash / UPI)</option>
                <option value="donation">Donation in kind (contra)</option>
              </select>
            </label>
            <label style={{ ...S.field, gridColumn: "1 / -1" }}>
              <span style={S.fieldLabel}>Remarks</span>
              <input style={S.fieldInput} value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Optional" />
            </label>
          </div>
          {form.status === "donation" && (
            <div style={E.hint}>A matching donation entry will be auto-recorded.</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button style={E.ghostBtn} onClick={() => { setAdding(false); setForm(blank()); }}>Cancel</button>
            <button className="primaryBtn" style={{ ...S.primaryBtn, flex: 1 }} onClick={add}
              disabled={busy || !form.description.trim() || Number(form.amount) <= 0}>
              {busy ? "Adding…" : "Add expense"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---- Receivables Tab ---- */
function ReceivablesTab({ ev, admin, mobile, residential, isActive, onSave }) {
  const receivables = ev.receivables || [];

  const blank = () => ({ description: "", flat: "", amount: "" });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blank());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const startEdit = (r) => {
    setAdding(false);
    setEditingId(r.id);
    setEditForm({
      description: r.description || "",
      flat: r.flat || "",
      amount: String(r.amount || ""),
      status: r.status || "pending",
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm(null); };

  const saveEdit = async () => {
    if (!editForm) return;
    const amt = Number(editForm.amount);
    if (!editForm.description.trim() || !editForm.flat || amt <= 0) return;
    setBusy(true);
    try {
      const orig = receivables.find((r) => r.id === editingId);
      const updated = { ...orig, description: editForm.description.trim(), flat: editForm.flat, amount: amt, status: editForm.status };
      await onSave(receivables.map((r) => r.id === editingId ? updated : r));
      cancelEdit();
    } finally { setBusy(false); }
  };

  const add = async () => {
    const amt = Number(form.amount);
    if (!form.description.trim() || !form.flat || amt <= 0) return;
    setBusy(true);
    try {
      await onSave([...receivables, {
        id: "r_" + Math.random().toString(36).slice(2, 8),
        description: form.description.trim(),
        flat: form.flat, amount: amt, status: "pending",
      }]);
      setAdding(false); setForm(blank());
    } finally { setBusy(false); }
  };

  const markReceived = (id) => onSave(receivables.map((r) => r.id === id ? { ...r, status: "received" } : r));
  const remove = (id) => {
    if (window.confirm("Remove this receivable?")) onSave(receivables.filter((r) => r.id !== id));
  };

  const recEditForm = editForm && (
    <div style={{ ...E.formInline, margin: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: T.ink }}>Edit receivable</span>
        <button style={E.iconBtn} onClick={cancelEdit}>✕</button>
      </div>
      <div style={S.inputGrid}>
        <label style={S.field}>
          <span style={S.fieldLabel}>Flat *</span>
          <select style={{ ...S.fieldInput, fontFamily: "inherit" }} value={editForm.flat}
            onChange={(e) => setEditForm({ ...editForm, flat: e.target.value })}>
            <option value="">— select —</option>
            {residential.map((f) => <option key={f.flat} value={f.flat}>Flat {f.flat} – {f.name}</option>)}
          </select>
        </label>
        <label style={S.field}>
          <span style={S.fieldLabel}>Description *</span>
          <input style={S.fieldInput} value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
        </label>
        <label style={S.field}>
          <span style={S.fieldLabel}>Amount (₹) *</span>
          <input type="number" style={S.fieldInput} value={editForm.amount}
            onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
        </label>
        <label style={S.field}>
          <span style={S.fieldLabel}>Status</span>
          <select style={{ ...S.fieldInput, fontFamily: "inherit" }} value={editForm.status}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
            <option value="pending">Pending</option>
            <option value="received">Received</option>
          </select>
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button style={E.ghostBtn} onClick={cancelEdit}>Cancel</button>
        <button className="primaryBtn" style={{ ...S.primaryBtn, flex: 1 }} onClick={saveEdit}
          disabled={busy || !editForm.description.trim() || !editForm.flat || Number(editForm.amount) <= 0}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <p style={{ fontSize: 12.5, color: T.muted, margin: "0 0 10px" }}>
        Track velam pata amounts and other amounts due for next year. Mark as received when collected.
      </p>

      {receivables.length === 0 && !adding && (
        <div style={{ color: T.muted, fontSize: 14, padding: "20px 0", textAlign: "center" }}>
          No receivables recorded.{isActive && admin ? " Add one below." : ""}
        </div>
      )}

      {receivables.length > 0 && (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Flat</th>
              <th style={S.th}>Description</th>
              <th style={{ ...S.th, textAlign: "right" }}>Amount</th>
              <th style={{ ...S.th, textAlign: "center" }}>Status</th>
              {admin && isActive && <th style={S.th} />}
            </tr></thead>
            <tbody>
              {receivables.map((r) => (
                editingId === r.id ? (
                  <tr key={r.id}>
                    <td colSpan={admin && isActive ? 5 : 4} style={{ padding: "8px 4px" }}>
                      {recEditForm}
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id}>
                    <td style={{ ...S.td, fontWeight: 600 }}>Flat {r.flat}</td>
                    <td style={S.td}>{r.description}</td>
                    <td style={{ ...S.td, ...S.num, fontWeight: 700 }}>{money(r.amount)}</td>
                    <td style={{ ...S.td, textAlign: "center" }}>
                      {isActive && admin && r.status === "pending" ? (
                        <button style={{ border: `1px solid ${T.money}`, background: "#fff", color: T.money, borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}
                          onClick={() => markReceived(r.id)}>Mark received</button>
                      ) : (
                        <span style={{ color: r.status === "received" ? T.money : T.muted, fontSize: 12, fontWeight: 600 }}>
                          {r.status === "received" ? "✓ Received" : "Pending"}
                        </span>
                      )}
                    </td>
                    {admin && isActive && (
                      <td style={{ ...S.td, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button style={E.editBtn} onClick={() => startEdit(r)}>✏️</button>
                          <button className="del" style={S.del} onClick={() => remove(r.id)}>✕</button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isActive && admin && !adding && (
        <button className="add" style={S.addBtn} onClick={() => { cancelEdit(); setAdding(true); }}>+ Add receivable</button>
      )}

      {isActive && admin && adding && (
        <div style={E.formInline}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: T.ink }}>Add receivable</div>
          <div style={S.inputGrid}>
            <label style={S.field}>
              <span style={S.fieldLabel}>Flat *</span>
              <select style={{ ...S.fieldInput, fontFamily: "inherit" }} value={form.flat}
                onChange={(e) => setForm({ ...form, flat: e.target.value })}>
                <option value="">— select —</option>
                {residential.map((f) => <option key={f.flat} value={f.flat}>Flat {f.flat} – {f.name}</option>)}
              </select>
            </label>
            <label style={S.field}>
              <span style={S.fieldLabel}>Description *</span>
              <input style={S.fieldInput} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Velam Pata 2025" />
            </label>
            <label style={S.field}>
              <span style={S.fieldLabel}>Amount (₹) *</span>
              <input type="number" style={S.fieldInput} value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button style={E.ghostBtn} onClick={() => { setAdding(false); setForm(blank()); }}>Cancel</button>
            <button className="primaryBtn" style={{ ...S.primaryBtn, flex: 1 }} onClick={add}
              disabled={busy || !form.description.trim() || !form.flat || Number(form.amount) <= 0}>
              {busy ? "Adding…" : "Add receivable"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---- Event Poster Button ---- */
function EventPosterButton({ ev }) {
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const W = 1080, pad = 40;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const donations = ev.donations || [];
      const expenses = ev.expenses || [];
      const receivables = ev.receivables || [];

      const totalCollected = donations.reduce((s, d) => s + Number(d.amount || 0), 0);
      const totalSpent = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
      const balance = totalCollected - totalSpent;

      ctx.font = "800 48px Poppins, system-ui, sans-serif";
      const nameLines = wrapText(ctx, ev.name, W - pad * 2);
      const headerH = 80 + nameLines.length * 60 + 60;

      const sortedDonors = [...donations].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
      const topDonors = sortedDonors.slice(0, 8);
      const moreCount = Math.max(0, donations.length - 8);
      const donRowH = 56;
      const donSecH = topDonors.length > 0 ? 60 + topDonors.length * donRowH + (moreCount > 0 ? 44 : 0) + 24 : 0;

      const catMap = {};
      expenses.forEach((ex) => { const c = ex.category || "misc"; catMap[c] = (catMap[c] || 0) + Number(ex.amount || 0); });
      const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
      const maxCatAmt = cats.length > 0 ? cats[0][1] : 1;
      const catRowH = 64;
      const catSecH = cats.length > 0 ? 60 + cats.length * catRowH + 24 : 0;

      const pending = receivables.filter((r) => r.status === "pending");
      const recRowH = 56;
      const recSecH = pending.length > 0 ? 60 + pending.length * recRowH + 24 : 0;

      const stripH = 200;
      const footerH = 100;
      const H = headerH + stripH + donSecH + catSecH + recSecH + footerH;

      canvas.width = W;
      canvas.height = H;

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);

      const hGrad = ctx.createLinearGradient(0, 0, W, headerH);
      hGrad.addColorStop(0, "#1A6B72");
      hGrad.addColorStop(1, "#0D4A50");
      ctx.fillStyle = hGrad;
      ctx.fillRect(0, 0, W, headerH);

      const goldGrad = ctx.createLinearGradient(0, 0, W, 0);
      goldGrad.addColorStop(0, "#C9A84C"); goldGrad.addColorStop(0.5, "#E8C96A"); goldGrad.addColorStop(1, "#C9A84C");
      ctx.fillStyle = goldGrad;
      ctx.fillRect(0, headerH - 5, W, 5);

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "600 22px Poppins, system-ui, sans-serif";
      ctx.letterSpacing = "3px";
      ctx.fillText("🎉  EVENT SUMMARY", pad, 52);
      ctx.letterSpacing = "0px";

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "800 48px Poppins, system-ui, sans-serif";
      let hy = 110;
      nameLines.forEach((line) => { ctx.fillText(line, pad, hy); hy += 60; });

      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "500 24px Poppins, system-ui, sans-serif";
      ctx.fillText(`${ev.year} · ${ev.status === "active" ? "Active" : "Closed"}`, pad, hy + 12);

      const sy = headerH;
      ctx.fillStyle = "#F5F6FA";
      ctx.fillRect(0, sy, W, stripH);

      const cardLabels = ["Opening Balance", "Total Collected", "Total Spent", "Balance"];
      const cardAmounts = [ev.openingBalance || 0, totalCollected, totalSpent, balance];
      const cardColors = ["#1C2B2D", "#1A6B72", "#D94343", balance >= 0 ? "#1A6B72" : "#D94343"];
      const cardNotes = ["carry forward", `${donations.length} entries`, `${expenses.length} expenses`, balance >= 0 ? "available" : "shortfall"];
      const cGap = 12;
      const cardW = Math.floor((W - pad * 2 - cGap * 3) / 4);
      const cardH = 150;
      const cardY = sy + (stripH - cardH) / 2;

      cardLabels.forEach((lbl, i) => {
        const cx = pad + i * (cardW + cGap);
        ctx.fillStyle = "#FFFFFF";
        roundRect(ctx, cx, cardY, cardW, cardH, 12);
        ctx.fill();
        ctx.fillStyle = "#6B7B7D";
        ctx.font = "600 18px Poppins, system-ui, sans-serif";
        ctx.fillText(lbl, cx + 14, cardY + 28);
        ctx.fillStyle = cardColors[i];
        ctx.font = "700 32px Poppins, system-ui, sans-serif";
        ctx.fillText(`₹${cardAmounts[i].toLocaleString("en-IN")}`, cx + 14, cardY + 84);
        ctx.fillStyle = "#9AA5A6";
        ctx.font = "500 18px Poppins, system-ui, sans-serif";
        ctx.fillText(cardNotes[i], cx + 14, cardY + 122);
      });

      let y = sy + stripH;

      if (topDonors.length > 0) {
        ctx.fillStyle = "#F5F6FA";
        ctx.fillRect(0, y, W, donSecH);
        ctx.fillStyle = "#1C2B2D";
        ctx.font = "700 28px Poppins, system-ui, sans-serif";
        ctx.fillText(`Donors (${donations.length})`, pad, y + 44);
        y += 60;
        topDonors.forEach((d, idx) => {
          const ry = y + idx * donRowH;
          if (idx > 0) {
            ctx.strokeStyle = "rgba(0,0,0,0.06)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(pad, ry); ctx.lineTo(W - pad, ry); ctx.stroke();
          }
          const displayName = d.isExternal || d.type === "external"
            ? `[Ext] ${d.name}`
            : d.name || (d.flat ? `Flat ${d.flat}` : "—");
          ctx.fillStyle = "#2D3B3E";
          ctx.font = "600 24px Poppins, system-ui, sans-serif";
          const maxNameW = W - pad * 2 - 220;
          const nw = wrapText(ctx, displayName, maxNameW);
          ctx.fillText(nw[0] + (nw.length > 1 ? "…" : ""), pad, ry + 36);
          ctx.fillStyle = "#1A6B72";
          ctx.font = "700 32px Poppins, system-ui, sans-serif";
          const amtStr = `₹${Number(d.amount).toLocaleString("en-IN")}`;
          ctx.fillText(amtStr, W - pad - ctx.measureText(amtStr).width, ry + 36);
        });
        y += topDonors.length * donRowH;
        if (moreCount > 0) {
          ctx.fillStyle = "#9AA5A6";
          ctx.font = "600 20px Poppins, system-ui, sans-serif";
          ctx.fillText(`+${moreCount} more donor${moreCount === 1 ? "" : "s"}`, pad, y + 28);
          y += 44;
        }
        y += 24;
      }

      if (cats.length > 0) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, y, W, catSecH);
        ctx.fillStyle = "#1C2B2D";
        ctx.font = "700 28px Poppins, system-ui, sans-serif";
        ctx.fillText("Expenses by Category", pad, y + 44);
        y += 60;
        const maxBarW = W - pad * 2 - 200;
        cats.forEach(([cat, amt], idx) => {
          const ry = y + idx * catRowH;
          if (idx > 0) {
            ctx.strokeStyle = "rgba(0,0,0,0.06)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(pad, ry); ctx.lineTo(W - pad, ry); ctx.stroke();
          }
          ctx.fillStyle = "#2D3B3E";
          ctx.font = "600 24px Poppins, system-ui, sans-serif";
          ctx.fillText(CATEGORIES[cat] || cat, pad, ry + 26);
          ctx.fillStyle = "#D94343";
          ctx.font = "700 24px Poppins, system-ui, sans-serif";
          const amtStr = `₹${amt.toLocaleString("en-IN")}`;
          ctx.fillText(amtStr, W - pad - ctx.measureText(amtStr).width, ry + 26);
          ctx.fillStyle = "#EEF0F2";
          roundRect(ctx, pad, ry + 36, maxBarW, 14, 7);
          ctx.fill();
          const barW = Math.max(14, Math.round((amt / maxCatAmt) * maxBarW));
          ctx.fillStyle = "#1A6B72";
          roundRect(ctx, pad, ry + 36, barW, 14, 7);
          ctx.fill();
        });
        y += cats.length * catRowH + 24;
      }

      if (pending.length > 0) {
        ctx.fillStyle = "#FFFBF0";
        ctx.fillRect(0, y, W, recSecH);
        ctx.fillStyle = "#8B6A2E";
        ctx.font = "700 28px Poppins, system-ui, sans-serif";
        ctx.fillText("Pending Receivables", pad, y + 44);
        y += 60;
        pending.forEach((r, idx) => {
          const ry = y + idx * recRowH;
          if (idx > 0) {
            ctx.strokeStyle = "rgba(139,106,46,0.15)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(pad, ry); ctx.lineTo(W - pad, ry); ctx.stroke();
          }
          ctx.fillStyle = "#2D3B3E";
          ctx.font = "600 24px Poppins, system-ui, sans-serif";
          ctx.fillText(r.flat ? `Flat ${r.flat} – ${r.description}` : r.description, pad, ry + 36);
          ctx.fillStyle = "#8B6A2E";
          ctx.font = "700 32px Poppins, system-ui, sans-serif";
          const amtStr = `₹${Number(r.amount).toLocaleString("en-IN")}`;
          ctx.fillText(amtStr, W - pad - ctx.measureText(amtStr).width, ry + 36);
        });
        y += pending.length * recRowH + 24;
      }

      const fy = H - footerH;
      ctx.fillStyle = goldGrad;
      ctx.fillRect(0, fy, W, 5);
      ctx.fillStyle = "#1A6B72";
      ctx.fillRect(0, fy + 5, W, footerH - 5);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "700 26px Poppins, system-ui, sans-serif";
      ctx.fillText("Managed with Nivasa", pad, fy + 46);
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "500 20px Poppins, system-ui, sans-serif";
      ctx.fillText(ev.name, pad, fy + 78);

      await new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) { reject(new Error("toBlob returned null")); return; }
          const filename = `${ev.name.replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_").slice(0, 40)}_poster.png`;
          const file = new File([blob], filename, { type: "image/png" });
          if (navigator.canShare?.({ files: [file] })) {
            try { await navigator.share({ title: ev.name, files: [file] }); }
            catch (e) { if (e.name !== "AbortError") console.error(e); }
          } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.download = filename;
            a.href = url;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          }
          resolve();
        }, "image/png");
      });
    } catch (e) {
      console.error("Event poster generation failed:", e);
      alert("Could not generate poster. Try taking a screenshot instead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button style={E.posterBtn} onClick={generate} disabled={busy}>
      {busy ? "Generating…" : "📸 Download Poster"}
    </button>
  );
}

/* ---- Shared card ---- */
function ECard({ label, value, note, tone }) {
  const accent = tone === "water" ? T.water : tone === "money" ? T.money : tone === "owed" ? T.owed : T.ink;
  return (
    <div style={S.card}>
      <div style={S.cardLabel}>{label}</div>
      <div style={{ ...S.cardValue, color: accent }}>{value}</div>
      <div style={S.cardNote}>{note}</div>
    </div>
  );
}

/* ---- Local styles ---- */
const E = {
  newBtn: { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: T.ink, fontFamily: font },
  form: { background: "#fff", border: `1.5px solid ${T.water}`, borderRadius: 14, padding: "18px 20px", marginBottom: 16 },
  formInline: { background: T.bg, border: `1.5px solid ${T.line}`, borderRadius: 12, padding: "14px 16px", marginTop: 10, marginBottom: 10 },
  formHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  formTitle: { fontFamily: display, fontWeight: 700, fontSize: 16 },
  iconBtn: { border: "none", background: "#F1F1F8", width: 28, height: 28, borderRadius: "50%", cursor: "pointer", fontSize: 12, color: T.inkSoft, flexShrink: 0 },
  closeBtn2: { border: `1.5px solid ${T.owed}`, background: "#fff", color: T.owed, borderRadius: 10, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font },
  reopenBtn: { border: `1.5px solid ${T.water}`, background: "#fff", color: T.water, borderRadius: 10, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font },
  shareBtn: { background: "#25D366", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font },
  ghostBtn: { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: T.inkSoft, fontFamily: font },
  editBtn: { border: "none", background: "none", color: T.inkSoft, cursor: "pointer", fontSize: 14, padding: "2px 4px", lineHeight: 1, opacity: 0.75 },
  err: { marginTop: 10, background: "#FEF2F2", color: T.owed, padding: "9px 12px", borderRadius: 9, fontSize: 13 },
  hint: { fontSize: 12, color: T.inkSoft, background: T.waterSoft, padding: "8px 12px", borderRadius: 8, marginTop: 6 },
  extTag: { fontSize: 11, background: T.waterSoft, color: T.water, borderRadius: 4, padding: "1px 5px", marginRight: 4 },
  innerTabs: { display: "flex", gap: 0, borderBottom: `1px solid ${T.line}`, marginBottom: 16 },
  innerTab: { padding: "9px 16px", border: "none", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: T.muted, borderBottom: "2.5px solid transparent", marginBottom: -1, fontFamily: display, whiteSpace: "nowrap" },
  innerTabOn: { color: T.water, borderBottomColor: T.water },
  posterBtn: { background: "#F5F6FA", border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: T.ink, fontFamily: font },
};

function wrapText(ctx, text, maxW) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
    else { line = test; }
  }
  if (line) lines.push(line);
  return lines;
}
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
