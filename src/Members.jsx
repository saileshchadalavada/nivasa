import React from "react";
import { setMemberRoles, adminAssignFlat, updateMembership, removeMember } from "./data";
import { styles as S, T, font } from "./styles";

/* Admin-only: grant/revoke per-building roles, override a member's flat. */
export default function Members({ bid, members, flats, config, onDeleteBuilding, onImportWater2026, canImportWater2026, mobile, onConfirm }) {
  const flatOptions = flats.filter((f) => !f.isCommon).map((f) => f.flat).sort();

  const toggleRole = (u, role) => {
    const has = u.roles?.includes(role);
    const next = has ? u.roles.filter((r) => r !== role) : [...(u.roles || []), role];
    setMemberRoles(bid, u.uid, next);
  };

  return (
    <>
      <SectionTitle>Members <span style={S.titleHint}>— assign roles, fix flat if someone picked wrong</span></SectionTitle>
      {mobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {members.map((u) => {
            const isFounder = config?.adminUid === u.uid;
            const hasRole = isFounder || u.roles?.includes("admin") || u.roles?.includes("treasurer") || u.roles?.includes("water");
            const typeLabel = u.residentType === "tenant" ? "Tenant" : u.residentType === "owner" ? "Owner" : "";
            return (
              <div key={u.uid} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{u.username}</span>
                    {isFounder && <span style={M.badge}>founder</span>}
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                      {typeLabel || "—"}{!hasRole && <span style={M.memberTag}>view-only</span>}
                    </div>
                  </div>
                  <select className="cell" style={{ ...S.cellSelect, fontSize: 13 }} value={u.flat || ""}
                    onChange={(e) => adminAssignFlat(bid, u.uid, e.target.value || null, u.flat || null)}>
                    <option value="">— none —</option>
                    {flatOptions.map((f) => <option key={f} value={f}>Flat {f}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <input className="cell" style={{ ...S.cellInput, width: "100%", fontSize: 13 }}
                    value={u.phone || ""} placeholder="Phone number"
                    onChange={(e) => updateMembership(bid, u.uid, { phone: e.target.value || null })} />
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: T.inkSoft, minWidth: 60 }}>Treasurer</span>
                  <Check on={u.roles?.includes("treasurer")} onClick={() => toggleRole(u, "treasurer")} />
                  <span style={{ fontSize: 12, color: T.inkSoft, minWidth: 40, marginLeft: 8 }}>Water</span>
                  <Check on={u.roles?.includes("water")} onClick={() => toggleRole(u, "water")} />
                  <span style={{ fontSize: 12, color: T.inkSoft, minWidth: 40, marginLeft: 8 }}>Admin</span>
                  {isFounder ? <span style={{ color: T.muted, fontSize: 12 }}>always</span>
                    : <Check on={u.roles?.includes("admin")} onClick={() => toggleRole(u, "admin")} />}
                </div>
                {!isFounder && (
                  <button style={{ border: "none", background: "none", color: T.owed, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: font, marginTop: 8, padding: 0 }}
                    onClick={() => onConfirm && onConfirm({
                      title: "Remove member?",
                      message: `Remove ${u.username} from this building? They will lose access and their flat will be freed.`,
                      confirmLabel: "Remove",
                      onConfirm: () => removeMember(bid, u.uid, u.flat || null),
                    })}>Remove member</button>
                )}
              </div>
            );
          })}
          {members.length === 0 && <div style={{ color: T.muted, fontSize: 13, padding: 16 }}>No members yet. Share the invite link.</div>}
        </div>
      ) : (
        <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr>
            <th style={S.th}>Username</th>
            <th style={S.th}>Flat</th>
            <th style={S.th}>Phone</th>
            <th style={S.th}>Type</th>
            <th style={{ ...S.th, textAlign: "center" }}>Treasurer</th>
            <th style={{ ...S.th, textAlign: "center" }}>Water in-charge</th>
            <th style={{ ...S.th, textAlign: "center" }}>Admin</th>
            <th style={S.th}></th>
          </tr></thead>
          <tbody>
            {members.map((u) => {
              const isFounder = config?.adminUid === u.uid;
              return (
                <tr key={u.uid}>
                  <td style={{ ...S.td, fontWeight: 600 }}>
                    {u.username}{isFounder && <span style={M.badge}>founder</span>}
                  </td>
                  <td style={{ ...S.td, padding: "4px 8px" }}>
                    <select className="cell" style={S.cellSelect} value={u.flat || ""}
                      onChange={(e) => adminAssignFlat(bid, u.uid, e.target.value || null, u.flat || null)}>
                      <option value="">— none —</option>
                      {flatOptions.map((f) => <option key={f} value={f}>Flat {f}</option>)}
                    </select>
                  </td>
                  <td style={{ ...S.td, padding: "4px 8px" }}>
                    <input className="cell" style={{ ...S.cellInput, width: 130, fontSize: 12.5 }}
                      value={u.phone || ""} placeholder="+91..."
                      onChange={(e) => updateMembership(bid, u.uid, { phone: e.target.value || null })} />
                  </td>
                  <td style={{ ...S.td, textTransform: "capitalize", color: T.inkSoft }}>
                    {(() => {
                      const hasRole = isFounder || u.roles?.includes("admin") || u.roles?.includes("treasurer") || u.roles?.includes("water");
                      const typeLabel = u.residentType === "tenant" ? "Tenant" : u.residentType === "owner" ? "Owner" : "";
                      return <span>{typeLabel || "—"}{!hasRole && <span style={M.memberTag}>Member · view-only</span>}</span>;
                    })()}
                  </td>
                  <td style={{ ...S.td, textAlign: "center" }}>
                    <Check on={u.roles?.includes("treasurer")} onClick={() => toggleRole(u, "treasurer")} />
                  </td>
                  <td style={{ ...S.td, textAlign: "center" }}>
                    <Check on={u.roles?.includes("water")} onClick={() => toggleRole(u, "water")} />
                  </td>
                  <td style={{ ...S.td, textAlign: "center" }}>
                    {isFounder ? <span style={{ color: T.muted, fontSize: 12 }}>always</span>
                      : <Check on={u.roles?.includes("admin")} onClick={() => toggleRole(u, "admin")} />}
                  </td>
                  <td style={{ ...S.td, textAlign: "center" }}>
                    {!isFounder && (
                      <button style={{ border: "none", background: "none", color: T.owed, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: font, opacity: 0.7 }}
                        onClick={() => onConfirm && onConfirm({
                          title: "Remove member?",
                          message: `Remove ${u.username} from this building? They will lose access and their flat will be freed.`,
                          confirmLabel: "Remove",
                          onConfirm: () => removeMember(bid, u.uid, u.flat || null),
                        })}>Remove</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr><td style={{ ...S.td, color: T.muted }} colSpan={8}>No members yet. Share the invite link.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      )}

      {canImportWater2026 && (
        <div style={M.tool}>
          <div>
            <div style={M.toolTitle}>Make 2026 water history editable</div>
            <div style={M.toolText}>Converts the baked-in Jan, Feb, Apr & May 2026 water months into real periods you can select and correct in the Water tab's "Editing period" picker. Readings match the originally-billed figures. Runs once.</div>
          </div>
          <button style={M.toolBtn} onClick={onImportWater2026}>Import 2026 water</button>
        </div>
      )}

      {onDeleteBuilding && (
        <div style={M.danger}>
          <div>
            <div style={M.dangerTitle}>Delete this building</div>
            <div style={M.dangerText}>Permanently removes {config?.name || "this building"} and all its data — flats, members, and water &amp; maintenance history. This cannot be undone.</div>
          </div>
          <button style={M.dangerBtn} onClick={onDeleteBuilding}>Delete building</button>
        </div>
      )}
    </>
  );
}

function Check({ on, onClick }) {
  return (
    <button onClick={onClick} className="tog"
      style={{ width: 26, height: 26, borderRadius: 7, border: `1.5px solid ${on ? T.money : "#CBD5D3"}`,
        background: on ? T.money : "#fff", color: "#fff", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>
      {on ? "✓" : ""}
    </button>
  );
}
function SectionTitle({ children }) { return <h2 style={S.section}>{children}</h2>; }

const M = { badge: { marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: T.gold, background: "#F6EFD9",
  padding: "2px 6px", borderRadius: 5, textTransform: "uppercase", letterSpacing: ".04em" },
  memberTag: { marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: T.inkSoft, background: "#EEF0F6",
    padding: "2px 6px", borderRadius: 5, textTransform: "none", letterSpacing: 0, whiteSpace: "nowrap" },
  danger: { marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
    border: `1.5px solid ${T.owed}`, background: T.owedSoft, borderRadius: 12, padding: "14px 18px" },
  dangerTitle: { fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 14, color: T.owed },
  dangerText: { fontSize: 12.5, color: T.inkSoft, marginTop: 3, maxWidth: 520, lineHeight: 1.45 },
  dangerBtn: { border: "none", background: T.owed, color: "#fff", borderRadius: 10, padding: "10px 18px",
    fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "'Poppins', sans-serif", whiteSpace: "nowrap" },
  tool: { marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
    border: `1.5px solid ${T.water}`, background: T.waterSoft, borderRadius: 12, padding: "14px 18px" },
  toolTitle: { fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 14, color: T.ink },
  toolText: { fontSize: 12.5, color: T.inkSoft, marginTop: 3, maxWidth: 560, lineHeight: 1.45 },
  toolBtn: { border: "none", background: T.water, color: "#fff", borderRadius: 10, padding: "10px 18px",
    fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "'Poppins', sans-serif", whiteSpace: "nowrap" },
};
