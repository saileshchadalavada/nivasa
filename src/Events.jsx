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

export default function Events({ bid, events, membership, flats, admin, mobile }) {
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

  const [selId, setSelId] = useState(null);
  const [creating, setCreating] = useState(false);

  const selEvent = selId ? events.find((e) => e.id === selId) : sorted[0] || null;

  if (creating) {
    return (
      <CreateEventForm bid={bid} events={sorted}
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
function CreateEventForm({ bid, events, onDone, onCancel }) {
  const lastClosed = [...events].filter((e) => e.status === "closed")
    .sort((a, b) => (b.year || 0) - (a.year || 0))[0];

  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [targetAmount, setTargetAmount] = useState("");
  const [openingBalance, setOpeningBalance] = useState(
    lastClosed?.closingBalance ? String(lastClosed.closingBalance) : ""
  );
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
      {lastClosed && (
        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
          Last event “{lastClosed.name}” closed with {money(lastClosed.closingBalance || 0)}.
        </div>
      )}
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

  const donations = ev.donations || [];
  const expenses = ev.expenses || [];
  const receivables = ev.receivables || [];

  const totalCollected = donations.reduce((s, d) => s + Number(d.amount || 0), 0);
  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const balance = totalCollected - totalSpent;
  const progress = ev.targetAmount > 0
    ? Math.min(100, Math.round((balance / ev.targetAmount) * 100))
    : null;

  const patchEvent = (patch) => updateEvent(bid, ev.id, patch);

  const closeEvent = () => {
    if (window.confirm(
      `Close “${ev.name}”?\n\nClosing balance: ${money(balance)}\n\nYou can use this as the opening balance for the next event.`
    )) {
      patchEvent({ status: "closed", closingBalance: balance });
    }
  };

  const shareWhatsApp = () => {
    const lines = [
      `🎉 *${ev.name} – Collection Status*`,
      ``,
      `💰 Opening balance: ${money(ev.openingBalance || 0)}`,
      `💰 Total collected: ${money(totalCollected)}`,
      `💸 Total spent: ${money(totalSpent)}`,
      `🏦 *Balance: ${money(balance)}*`,
    ];
    if (ev.targetAmount > 0) {
      lines.push(`🎯 Target: ${money(ev.targetAmount)} (${progress}% reached)`);
    }
    if (donations.length > 0) {
      lines.push(``, `🙏 *Donors (${donations.length})*`);
      [...donations]
        .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
        .forEach((d) => {
          const who = d.isExternal || d.type === "external"
            ? `[Ext] ${d.name}`
            : `Flat ${d.flat}${d.name ? ` (${d.name})` : ""}`;
          const tag = d.type === "velampata" ? " (Velam Pata)" : d.type === "contra" ? " (item)" : "";
          lines.push(`${who}: ${money(d.amount)}${tag}`);
        });
    }
    if (expenses.length > 0) {
      lines.push(``, `💸 *Expenses (${expenses.length})*`);
      expenses.forEach((ex) => {
        lines.push(`${ex.description}${ex.date ? ` (${fmtDate(ex.date)})` : ""}: ${money(ex.amount)}`);
      });
    }
    const pending = receivables.filter((r) => r.status === "pending");
    if (pending.length > 0) {
      lines.push(``, `📋 *Pending receivables*`);
      pending.forEach((r) => lines.push(`Flat ${r.flat} – ${r.description}: ${money(r.amount)}`));
    }
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
              background: ev.status === "active" ? "#E8F9EE" : "#F1F1F8",
              color: ev.status === "active" ? T.money : T.muted,
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
          {admin && ev.status === "active" && (
            <button style={E.closeBtn2} onClick={closeEvent}>Close event</button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div style={S.cards}>
        <ECard label="Opening balance" value={money(ev.openingBalance || 0)} tone="ink" note="carry forward" />
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
          onSave={(dons, exps) => patchEvent({ donations: dons, expenses: exps })} />
      )}
      {tab === "expenses" && (
        <ExpensesTab
          ev={ev} bid={bid} admin={admin} mobile={mobile} residential={residential}
          onSave={(exps, dons) => patchEvent({ expenses: exps, donations: dons })} />
      )}
      {tab === "receivables" && (
        <ReceivablesTab
          ev={ev} bid={bid} admin={admin} mobile={mobile} residential={residential}
          onSave={(recs) => patchEvent({ receivables: recs })} />
      )}
    </>
  );
}

/* ---- Donations Tab ---- */
function DonationsTab({ ev, admin, mobile, residential, onSave }) {
  const donations = ev.donations || [];
  const expenses = ev.expenses || [];

  const blank = () => ({
    date: new Date().toISOString().slice(0, 10),
    flat: "", name: "", amount: "", type: "contribution", remarks: "", isExternal: false,
  });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blank());
  const [busy, setBusy] = useState(false);

  const sorted = [...donations].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const total = donations.reduce((s, d) => s + Number(d.amount || 0), 0);

  const flatName = (flat) => residential.find((f) => f.flat === flat)?.name || "";

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
      // Contra: item donation auto-creates a matching expense
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

  return (
    <>
      {donations.length === 0 && !adding && (
        <div style={{ color: T.muted, fontSize: 14, padding: "20px 0", textAlign: "center" }}>
          No donations recorded yet.{admin ? " Add the first one below." : ""}
        </div>
      )}

      {donations.length > 0 && (mobile ? (
        /* Mobile card layout */
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {sorted.map((d) => (
            <div key={d.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  {d.isExternal || d.type === "external"
                    ? <><span style={E.extTag}>Ext</span> {d.name}</>
                    : <><b style={{ fontFamily: display }}>Flat {d.flat}</b>{d.name ? <span style={{ color: T.muted, fontSize: 12.5, marginLeft: 4 }}>{d.name}</span> : null}</>}
                  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{DON_TYPES[d.type] || d.type} · {fmtDate(d.date)}</div>
                  {d.remarks && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{d.remarks}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: mono, fontWeight: 700, color: T.money }}>{money(d.amount)}</span>
                  {admin && <button className="del" style={S.del} onClick={() => remove(d.id)}>✕</button>}
                </div>
              </div>
            </div>
          ))}
          <div style={{ background: "#F7F7FC", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
            <span>Total collected</span>
            <span style={{ fontFamily: mono, color: T.money }}>{money(total)}</span>
          </div>
        </div>
      ) : (
        /* Desktop table */
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Date</th>
              <th style={S.th}>Donor</th>
              <th style={S.th}>Type</th>
              <th style={{ ...S.th, textAlign: "right" }}>Amount</th>
              <th style={S.th}>Remarks</th>
              {admin && <th style={S.th} />}
            </tr></thead>
            <tbody>
              {sorted.map((d) => (
                <tr key={d.id}>
                  <td style={{ ...S.td, fontFamily: mono, fontSize: 12.5 }}>{fmtDate(d.date)}</td>
                  <td style={S.td}>
                    {d.isExternal || d.type === "external"
                      ? <><span style={E.extTag}>Ext</span> {d.name}</>
                      : <><b>Flat {d.flat}</b>{d.name ? <span style={{ color: T.muted, fontSize: 12.5, marginLeft: 4 }}>{d.name}</span> : null}</>}
                  </td>
                  <td style={{ ...S.td, fontSize: 12.5, color: T.inkSoft }}>{DON_TYPES[d.type] || d.type}</td>
                  <td style={{ ...S.td, ...S.num, fontWeight: 700, color: T.money }}>{money(d.amount)}</td>
                  <td style={{ ...S.td, fontSize: 12, color: T.muted }}>{d.remarks || "—"}</td>
                  {admin && <td style={{ ...S.td, textAlign: "center" }}><button className="del" style={S.del} onClick={() => remove(d.id)}>✕</button></td>}
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td style={S.tfoot} colSpan={3}>Total</td>
              <td style={{ ...S.tfoot, ...S.num }}>{money(total)}</td>
              <td style={S.tfoot} colSpan={admin ? 2 : 1} />
            </tr></tfoot>
          </table>
        </div>
      ))}

      {admin && !adding && (
        <button className="add" style={S.addBtn} onClick={() => setAdding(true)}>+ Add donation</button>
      )}

      {admin && adding && (
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
function ExpensesTab({ ev, admin, mobile, residential, onSave }) {
  const expenses = ev.expenses || [];
  const donations = ev.donations || [];

  const blank = () => ({
    date: new Date().toISOString().slice(0, 10),
    description: "", amount: "", paidBy: "fund",
    status: "settled", category: "misc", remarks: "",
  });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blank());
  const [busy, setBusy] = useState(false);

  const sorted = [...expenses].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

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
      // Contra: donation-in-kind auto-creates a matching donation entry
      if (form.status === "donation") {
        const flatName = form.paidBy !== "fund"
          ? (residential.find((f) => f.flat === form.paidBy)?.name || "")
          : "";
        newDons = [...donations, {
          id: "d_contra_" + id,
          date: form.date,
          flat: form.paidBy !== "fund" ? form.paidBy : "",
          name: flatName,
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

  return (
    <>
      {expenses.length === 0 && !adding && (
        <div style={{ color: T.muted, fontSize: 14, padding: "20px 0", textAlign: "center" }}>
          No expenses yet.{admin ? " Add the first one below." : ""}
        </div>
      )}

      {expenses.length > 0 && (mobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {sorted.map((ex) => (
            <div key={ex.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px" }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: mono, fontWeight: 700, color: T.owed }}>{money(ex.amount)}</span>
                  {admin && <button className="del" style={S.del} onClick={() => remove(ex.id)}>✕</button>}
                </div>
              </div>
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
              {admin && <th style={S.th} />}
            </tr></thead>
            <tbody>
              {sorted.map((ex) => (
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
                  {admin && <td style={{ ...S.td, textAlign: "center" }}><button className="del" style={S.del} onClick={() => remove(ex.id)}>✕</button></td>}
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td style={S.tfoot} colSpan={4}>Total</td>
              <td style={{ ...S.tfoot, ...S.num }}>{money(total)}</td>
              <td style={S.tfoot} colSpan={admin ? 2 : 1} />
            </tr></tfoot>
          </table>
        </div>
      ))}

      {admin && !adding && (
        <button className="add" style={S.addBtn} onClick={() => setAdding(true)}>+ Add expense</button>
      )}

      {admin && adding && (
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
function ReceivablesTab({ ev, admin, mobile, residential, onSave }) {
  const receivables = ev.receivables || [];

  const blank = () => ({ description: "", flat: "", amount: "" });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blank());
  const [busy, setBusy] = useState(false);

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

  return (
    <>
      <p style={{ fontSize: 12.5, color: T.muted, margin: "0 0 10px" }}>
        Track velam pata amounts and other amounts due for next year. Mark as received when collected.
      </p>

      {receivables.length === 0 && !adding && (
        <div style={{ color: T.muted, fontSize: 14, padding: "20px 0", textAlign: "center" }}>
          No receivables recorded.{admin ? " Add one below." : ""}
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
              {admin && <th style={S.th} />}
            </tr></thead>
            <tbody>
              {receivables.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...S.td, fontWeight: 600 }}>Flat {r.flat}</td>
                  <td style={S.td}>{r.description}</td>
                  <td style={{ ...S.td, ...S.num, fontWeight: 700 }}>{money(r.amount)}</td>
                  <td style={{ ...S.td, textAlign: "center" }}>
                    {admin && r.status === "pending" ? (
                      <button style={{ border: `1px solid ${T.money}`, background: "#fff", color: T.money, borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}
                        onClick={() => markReceived(r.id)}>Mark received</button>
                    ) : (
                      <span style={{ color: r.status === "received" ? T.money : T.muted, fontSize: 12, fontWeight: 600 }}>
                        {r.status === "received" ? "✓ Received" : "Pending"}
                      </span>
                    )}
                  </td>
                  {admin && <td style={{ ...S.td, textAlign: "center" }}><button className="del" style={S.del} onClick={() => remove(r.id)}>✕</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {admin && !adding && (
        <button className="add" style={S.addBtn} onClick={() => setAdding(true)}>+ Add receivable</button>
      )}

      {admin && adding && (
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

/* ---- Shared card (local copy to avoid Dashboard import cycle) ---- */
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
  shareBtn: { background: "#25D366", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font },
  ghostBtn: { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: T.inkSoft, fontFamily: font },
  err: { marginTop: 10, background: "#FEF2F2", color: T.owed, padding: "9px 12px", borderRadius: 9, fontSize: 13 },
  hint: { fontSize: 12, color: T.inkSoft, background: T.waterSoft, padding: "8px 12px", borderRadius: 8, marginTop: 6 },
  extTag: { fontSize: 11, background: T.waterSoft, color: T.water, borderRadius: 4, padding: "1px 5px", marginRight: 4 },
  innerTabs: { display: "flex", gap: 0, borderBottom: `1px solid ${T.line}`, marginBottom: 16 },
  innerTab: { padding: "9px 16px", border: "none", background: "transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", color: T.muted, borderBottom: "2.5px solid transparent", marginBottom: -1, fontFamily: display, whiteSpace: "nowrap" },
  innerTabOn: { color: T.water, borderBottomColor: T.water },
};
