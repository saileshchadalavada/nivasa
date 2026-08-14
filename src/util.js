export const money = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

export const money2 = (n) =>
  "₹" +
  (Math.round((n || 0) * 100) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* label a billing period by its START date's month, e.g. "2026-06-06" -> "Jun 2026" */
export const labelFromStart = (iso) => {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return `${MON[(+m || 1) - 1]} ${y}`;
};

/* pretty a single ISO date -> "06 Jun 2026" */
export const fmtDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d} ${MON[(+m || 1) - 1]} ${y}`;
};

/* days between two ISO date strings, inclusive of both endpoints */
export const daysBetween = (startIso, endIso) => {
  if (!startIso || !endIso) return null;
  const s = new Date(startIso), e = new Date(endIso);
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : null;
};

/* FUNC-05: normalize any timestamp shape to milliseconds.
   Handles: numeric ms (Date.now()), Firestore Timestamp (.toMillis()),
   Date objects, and ISO strings. Returns NaN for unrecognized shapes. */
export const toMillis = (ts) => {
  if (ts == null) return NaN;
  if (typeof ts === "number") return ts;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "string") { const ms = Date.parse(ts); return isNaN(ms) ? NaN : ms; }
  return NaN;
};
