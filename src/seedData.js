/* Prefill data + flat-generation helpers.
   No React / browser APIs so this stays portable. */

export const DOMAIN = "nivasa.app";        // synthetic email domain for username auth
export const CURRENT_MONTH_ID = "2026-07";
/* fallback period for the originally-seeded month (before periodStart existed) */
export const DEFAULT_PERIOD_START = "2026-06-06";
export const DEFAULT_PERIOD_END = "2026-07-08";
export const DEFAULT_FLOORS = 5;
export const DEFAULT_PER_FLOOR = 3;

/* Real flat data for THIS building — used to pre-fill setup; all editable.
   Keyed by flat number. `cons` = last known usage (for a realistic starter month). */
export const PREFILL = {
  "101": { name: "M Srinivas",          meter: "4783/22", prev: 793219.3, cons: 26188.8 },
  "102": { name: "Y Sai Kiran",         meter: "4440/22", prev: 347192.2, cons: 5449.4 },
  "103": { name: "B Nagarjuna",         meter: "5308/22", prev: 551140.9, cons: 17558.2 },
  "201": { name: "P Jagadeesh",         meter: "5042/22", prev: 532257.6, cons: 15320.0 },
  "202": { name: "T Vamsi Krishna",     meter: "4438/22", prev: 593274.8, cons: 18465.2 },
  "203": { name: "P Bhavani",           meter: "5309/22", prev: 529502.4, cons: 11891.6 },
  "301": { name: "Ch Sailesh",          meter: "4786/22", prev: 483503.3, cons: 19699.5 },
  "302": { name: "T Dileep Kumar",      meter: "4431/22", prev: 571551.4, cons: 16617.6 },
  "303": { name: "V Ravikanth",         meter: "5310/22", prev: 619719.0, cons: 15099.0 },
  "401": { name: "P Nirmala",           meter: "4781/22", prev: 620487.9, cons: 14093.1 },
  "402": { name: "ASK Chaitanya Varma", meter: "5043/22", prev: 682056.0, cons: 11248.6 },
  "403": { name: "P Vani",              meter: "5047/22", prev: 287149.6, cons: 1914.9 },
  "501": { name: "Bhupendra Patre",     meter: "4784/22", prev: 919181.8, cons: 24617.9 },
  "502": { name: "M Pradeep",           meter: "5045/22", prev: 585824.5, cons: 14530.4 },
  "503": { name: "V Ramesh",            meter: "4775/22", prev: 107203.2, cons: 5250.0 },
};

/* The shared/watchman meter — always present, counts toward general-water %
   but never toward the equal Manjeera pools, maintenance, or logins. */
export const COMMON_METER = { meter: "5802/23", prev: 597013.0, cons: 22754.4 };

/* username <-> synthetic email */
export const userToEmail = (username) =>
  `${String(username).trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@${DOMAIN}`;

/* Generate flats from floors x perFloor -> [{flat, floor, unit}] (numeric floor*100+unit). */
export function genFlats(floors, perFloor) {
  const out = [];
  for (let f = 1; f <= floors; f++)
    for (let u = 1; u <= perFloor; u++)
      out.push({ flat: String(f * 100 + u), floor: f, unit: u });
  return out;
}

/* Build the full flat list for setup: generated grid + Common.
   `prefill` merges in this building's known names/meters — that data is
   specific to SR GOLD, so it's OFF by default. Every other building starts
   with blank names/meters that its own members fill in. */
export function buildFlatsForSetup(floors, perFloor, prefill = false) {
  const flats = genFlats(floors, perFloor).map((g) => ({
    ...g,
    name: prefill ? (PREFILL[g.flat]?.name || "") : "",
    meter: prefill ? (PREFILL[g.flat]?.meter || "") : "",
    isCommon: false,
    claimedByUid: null,
  }));
  flats.push({
    flat: "Common", floor: 0, unit: 0, name: "Watchman / Common",
    meter: prefill ? COMMON_METER.meter : "", isCommon: true, claimedByUid: null,
  });
  return flats;
}

/* Starter month. With prefill (SR GOLD only) it seeds real readings + sample
   costs/expenses. Otherwise it's a blank month the building fills in itself. */
export function buildSeedMonth(flats, prefill = false) {
  const readings = {};
  flats.forEach((f) => {
    const p = prefill ? (f.isCommon ? COMMON_METER : PREFILL[f.flat]) : null;
    const prev = p?.prev || 0;
    const cons = p?.cons || 0;
    readings[f.flat] = { prev, curr: +(prev + cons).toFixed(1), adj: 0 };
  });
  if (!prefill) {
    const today = new Date().toISOString().slice(0, 10);
    const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return {
      label: `${MON[(+today.slice(5, 7) || 1) - 1]} ${today.slice(0, 4)}`,
      periodStart: today, periodEnd: today,
      genCount: 0, genRate: 0, manCount: 0, manRate: 0, connBill: 0,
      readings, expenses: [], paidWater: {}, paidMaint: {},
    };
  }
  return {
    label: "June 2026",
    periodStart: "2026-06-06", periodEnd: "2026-07-08",
    genCount: 22, genRate: 1500, manCount: 10, manRate: 550, connBill: 1922.5,
    readings,
    expenses: [
      { id: "e1", item: "Watchman salary",            amount: 7500,  paidBy: "fund" },
      { id: "e2", item: "Garbage collection",         amount: 1800,  paidBy: "fund" },
      { id: "e3", item: "Common power bill",          amount: 6633,  paidBy: "fund" },
      { id: "e4", item: "Sump + tank cleaning",       amount: 1100,  paidBy: "fund" },
      { id: "e5", item: "Lizol / Muggu",              amount: 300,   paidBy: "fund" },
      { id: "e6", item: "Lift AMC",                   amount: 10000, paidBy: "fund" },
      { id: "e7", item: "Drainage cleaning (cellar)", amount: 3000,  paidBy: "fund" },
      { id: "e8", item: "Bulbs (101 / common)",       amount: 200,   paidBy: "fund" },
      { id: "e9", item: "Water meter repair (503)",   amount: 500,   paidBy: "402" },
      { id: "e10", item: "Plumbing issue (series 1)", amount: 430,   paidBy: "101" },
    ],
    paidWater: {}, paidMaint: {},
  };
}

/* ---- billing-period helpers ---- */
/* calendar-month bounds for a date: "2026-06-15" -> {start:"2026-06-01", end:"2026-06-30"} */
export function monthBounds(iso) {
  const [y, m] = (iso || new Date().toISOString().slice(0, 10)).split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}
/* bounds of the month AFTER the given date's month */
export function nextMonthBounds(iso) {
  const [y, m] = (iso || new Date().toISOString().slice(0, 10)).split("-").map(Number);
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  const last = new Date(ny, nm, 0).getDate();
  const mm = String(nm).padStart(2, "0");
  return { start: `${ny}-${mm}-01`, end: `${ny}-${mm}-${String(last).padStart(2, "0")}` };
}

/* Starter WATER period. Prefill (SR GOLD) seeds real readings + June tanker
   sample; otherwise blank (dates, counts, rates, current readings all empty). */
export function buildSeedWater(flats, prefill = false) {
  const readings = {};
  flats.forEach((f) => {
    const p = prefill ? (f.isCommon ? COMMON_METER : PREFILL[f.flat]) : null;
    const prev = p?.prev || 0, cons = p?.cons || 0;
    readings[f.flat] = { prev, curr: prefill ? +(prev + cons).toFixed(1) : "", adj: 0 };
  });
  if (prefill) return {
    periodStart: "2026-06-06", periodEnd: "2026-07-08",
    // legacy fields kept for backward compat
    genCount: 22, genRate: 1500, manCount: 10, manRate: 550, connBill: 1922.5,
    // new flexible cost items
    costItems: [
      { id: "ci_gen", label: "General tankers", quantity: 22, rate: 1500, split: "percent" },
      { id: "ci_man", label: "Manjeera tankers", quantity: 10, rate: 550, split: "equal" },
      { id: "ci_conn", label: "Manjeera connection (HMWSSB)", quantity: 1, rate: 1922.5, split: "equal" },
    ],
    readings, paidWater: {},
  };
  return {
    periodStart: "", periodEnd: "",
    genCount: "", genRate: "", manCount: "", manRate: "", connBill: "",
    costItems: [],
    readings, paidWater: {},
  };
}

/* Starter MAINTENANCE period. Prefill seeds June 1–30 + sample expenses;
   otherwise defaults to the current calendar month, no expenses. */
export function buildSeedMaint(prefill = false) {
  if (prefill) return {
    periodStart: "2026-06-01", periodEnd: "2026-06-30",
    expenses: [
      { id: "e1", item: "Watchman salary",            amount: 7500,  paidBy: "fund", recurring: true },
      { id: "e2", item: "Garbage collection",         amount: 1800,  paidBy: "fund", recurring: true },
      { id: "e3", item: "Common power bill",          amount: 6633,  paidBy: "fund", recurring: true },
      { id: "e4", item: "Sump + tank cleaning",       amount: 1100,  paidBy: "fund" },
      { id: "e5", item: "Lizol / Muggu",              amount: 300,   paidBy: "fund" },
      { id: "e6", item: "Lift AMC",                   amount: 10000, paidBy: "fund" },
      { id: "e7", item: "Drainage cleaning (cellar)", amount: 3000,  paidBy: "fund" },
      { id: "e8", item: "Bulbs (101 / common)",       amount: 200,   paidBy: "fund" },
      { id: "e9", item: "Water meter repair (503)",   amount: 500,   paidBy: "402" },
      { id: "e10", item: "Plumbing issue (series 1)", amount: 430,   paidBy: "101" },
    ],
    paidMaint: {},
  };
  const b = monthBounds(new Date().toISOString().slice(0, 10));
  return { periodStart: b.start, periodEnd: b.end, expenses: [], paidMaint: {} };
}

/* role helpers */
export const ROLE_LABELS = { admin: "Admin", treasurer: "Treasurer", water: "Water in-charge" };
export const isAdmin = (profile, config, uid) =>
  !!profile?.roles?.includes("admin") || (config && uid && config.adminUid === uid);
export const canEditWater = (profile, config, uid) =>
  isAdmin(profile, config, uid) || !!profile?.roles?.includes("water");
export const canEditMaint = (profile, config, uid) =>
  isAdmin(profile, config, uid) || !!profile?.roles?.includes("treasurer");
