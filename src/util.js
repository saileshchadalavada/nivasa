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
