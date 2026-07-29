/* Theme system — 3 presets, stored in localStorage, switchable at runtime.
   Components import { T } from "./theme" instead of "./styles". */

const THEMES = {
  indigo: {
    name: "Indigo", emoji: "💜",
    bg: "#F3F3FB", surface: "#FFFFFF", ink: "#20233F", inkSoft: "#565A7E", muted: "#9092AE", line: "#E7E7F2",
    water: "#4B3FC0", waterSoft: "#ECEAFB", brandDark: "#3B30A0",
    money: "#2FA84F", moneyEdge: "#248C41", owed: "#E0603D", owedSoft: "#FCEAE4",
    unpaid: "#F26D6D", unpaidEdge: "#DB5757", partial: "#F4B740", gold: "#B07A0E",
  },
  teal: {
    name: "Teal", emoji: "🌊",
    bg: "#F0F7F7", surface: "#FFFFFF", ink: "#1A2E35", inkSoft: "#4A6670", muted: "#8A9FA8", line: "#DDE8EC",
    water: "#0D9488", waterSoft: "#E0F5F3", brandDark: "#0A7C72",
    money: "#2FA84F", moneyEdge: "#248C41", owed: "#E0603D", owedSoft: "#FCEAE4",
    unpaid: "#F26D6D", unpaidEdge: "#DB5757", partial: "#F4B740", gold: "#B07A0E",
  },
  dark: {
    name: "Dark", emoji: "🌙",
    bg: "#121220", surface: "#1E1E32", ink: "#E8E8F0", inkSoft: "#A0A0BE", muted: "#6E6E8A", line: "#2E2E48",
    water: "#7C6EF0", waterSoft: "#2A2850", brandDark: "#5B4FD0",
    money: "#4ADE80", moneyEdge: "#22C55E", owed: "#FB7A5E", owedSoft: "#3A2520",
    unpaid: "#F87171", unpaidEdge: "#EF4444", partial: "#FBBF24", gold: "#D4A017",
  },
};

const LS_KEY = "nivasa_theme";

export function getThemeId() {
  try { return localStorage.getItem(LS_KEY) || "indigo"; } catch { return "indigo"; }
}

export function setThemeId(id) {
  try { localStorage.setItem(LS_KEY, id); } catch {}
}

export function getTheme(id) {
  return THEMES[id] || THEMES.indigo;
}

export const THEME_LIST = Object.entries(THEMES).map(([id, t]) => ({ id, name: t.name, emoji: t.emoji, color: t.water }));

export default THEMES;
