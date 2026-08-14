import React, { useState, useRef, useCallback, useEffect } from "react";

/* Interactive dangle charm hanging from the mobile header.
   Flick/tap to swing with sound. Coin mode shows heads/tails. */

const DANGLES = [
  { id: "nimbu", label: "Nimbu Mirchi", emoji: "🍋" },
  { id: "coin", label: "Coin Toss", emoji: "🪙" },
  { id: "cricket", label: "Cricket Ball", emoji: "🏏" },
  { id: "bell", label: "Bell", emoji: "🔔" },
  { id: "spinner", label: "Spinner", emoji: "🎯" },
];
export { DANGLES };

const LS_KEY = "nivasa_dangle";
export function getSavedDangle() { try { return localStorage.getItem(LS_KEY) || "nimbu"; } catch { return "nimbu"; } }
export function saveDangle(id) { try { localStorage.setItem(LS_KEY, id); } catch {} }

/* Simple beep using Web Audio API */
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "coin") {
      osc.frequency.value = 1200;
      gain.gain.value = 0.15;
      osc.type = "sine";
      osc.start(); osc.stop(ctx.currentTime + 0.08);
      setTimeout(() => {
        const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.frequency.value = 1600; g2.gain.value = 0.12; o2.type = "sine";
        o2.start(); o2.stop(ctx.currentTime + 0.06);
      }, 80);
    } else if (type === "bell") {
      osc.frequency.value = 800; gain.gain.value = 0.2; osc.type = "sine";
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    } else {
      osc.frequency.value = 600; gain.gain.value = 0.08; osc.type = "triangle";
      osc.start(); osc.stop(ctx.currentTime + 0.05);
    }
  } catch {}
}

export default function Dangle({ type = "nimbu" }) {
  const [swinging, setSwinging] = useState(false);
  const [coinResult, setCoinResult] = useState(null);
  const [swingCount, setSwingCount] = useState(0);
  const timeoutRef = useRef(null);

  const flick = useCallback(() => {
    setSwinging(true);
    setSwingCount((c) => c + 1);
    playSound(type);

    if (type === "coin") {
      setCoinResult(null);
      setTimeout(() => {
        setCoinResult(Math.random() < 0.5 ? "H" : "T");
      }, 600);
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setSwinging(false), 1800);
  }, [type]);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const dangleContent = () => {
    switch (type) {
      case "nimbu":
        return (
          <svg width="28" height="48" viewBox="0 0 28 48">
            {/* String */}
            <line x1="14" y1="0" x2="14" y2="12" stroke="#888" strokeWidth="1.5" />
            {/* Chilli 1 */}
            <path d="M8 14 Q4 20 6 28 Q8 32 10 28 Q12 22 10 16 Z" fill="#e53e3e" />
            <path d="M8 13 Q8 10 10 12" stroke="#2d6a2d" strokeWidth="1.5" fill="none" />
            {/* Chilli 2 */}
            <path d="M18 16 Q22 22 20 30 Q18 34 16 30 Q14 24 16 18 Z" fill="#c53030" />
            <path d="M18 15 Q18 12 16 14" stroke="#2d6a2d" strokeWidth="1.5" fill="none" />
            {/* Lemon */}
            <ellipse cx="14" cy="38" rx="8" ry="7" fill="#ecc94b" />
            <ellipse cx="14" cy="38" rx="6" ry="5" fill="#f6e05e" />
            {/* Lemon tip */}
            <ellipse cx="14" cy="44" rx="2" ry="2" fill="#d69e2e" />
          </svg>
        );
      case "coin":
        return (
          <svg width="32" height="44" viewBox="0 0 32 44">
            <line x1="16" y1="0" x2="16" y2="12" stroke="#888" strokeWidth="1.5" />
            <circle cx="16" cy="28" r="14" fill="#d4a017" stroke="#b8860b" strokeWidth="2" />
            <circle cx="16" cy="28" r="11" fill="none" stroke="#c5941a" strokeWidth="1" />
            <text x="16" y="33" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#8B6914" fontFamily="serif">
              {coinResult || "₹"}
            </text>
          </svg>
        );
      case "cricket":
        return (
          <svg width="28" height="44" viewBox="0 0 28 44">
            <line x1="14" y1="0" x2="14" y2="12" stroke="#888" strokeWidth="1.5" />
            <circle cx="14" cy="28" r="12" fill="#cc2222" stroke="#aa1111" strokeWidth="1.5" />
            {/* Seam */}
            <path d="M8 20 Q14 28 8 36" fill="none" stroke="#fff" strokeWidth="1.5" />
            <path d="M20 20 Q14 28 20 36" fill="none" stroke="#fff" strokeWidth="1.5" />
          </svg>
        );
      case "bell":
        return (
          <svg width="28" height="44" viewBox="0 0 28 44">
            <line x1="14" y1="0" x2="14" y2="8" stroke="#888" strokeWidth="1.5" />
            {/* Bell body */}
            <path d="M6 28 Q6 12 14 10 Q22 12 22 28 Z" fill="#d4a017" stroke="#b8860b" strokeWidth="1" />
            {/* Bell rim */}
            <ellipse cx="14" cy="28" rx="9" ry="3" fill="#c5941a" stroke="#b8860b" strokeWidth="1" />
            {/* Clapper */}
            <line x1="14" y1="26" x2="14" y2="34" stroke="#8B6914" strokeWidth="2" />
            <circle cx="14" cy="35" r="3" fill="#8B6914" />
            {/* Top knob */}
            <circle cx="14" cy="9" r="3" fill="#d4a017" stroke="#b8860b" strokeWidth="1" />
          </svg>
        );
      case "spinner":
        return (
          <svg width="32" height="44" viewBox="0 0 32 44">
            <line x1="16" y1="0" x2="16" y2="12" stroke="#888" strokeWidth="1.5" />
            <circle cx="16" cy="28" r="13" fill="#6366f1" stroke="#4f46e5" strokeWidth="1.5" />
            {/* Segments */}
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <line key={i} x1="16" y1="28"
                x2={16 + 11 * Math.cos((angle * Math.PI) / 180)}
                y2={28 + 11 * Math.sin((angle * Math.PI) / 180)}
                stroke="rgba(255,255,255,.4)" strokeWidth="1.5" />
            ))}
            <circle cx="16" cy="28" r="4" fill="#fff" />
            <circle cx="16" cy="28" r="2" fill="#4f46e5" />
          </svg>
        );
      default:
        return <span style={{ fontSize: 28 }}>🍋</span>;
    }
  };

  return (
    <div
      onClick={flick}
      onTouchEnd={(e) => { e.preventDefault(); flick(); }}
      style={{
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transformOrigin: "top center",
        animation: swinging ? `dangleSwing 0.6s ease-in-out ${type === "coin" ? "3" : "3"}` : "none",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
        transition: "transform 0.3s ease-out",
        filter: swinging ? "drop-shadow(0 2px 4px rgba(0,0,0,.2))" : "none",
        position: "relative",
      }}
    >
      {dangleContent()}
      {type === "coin" && coinResult && (
        <div style={{
          position: "absolute", bottom: -18, fontSize: 11, fontWeight: 700,
          color: "#fff", background: coinResult === "H" ? "#d4a017" : "#6366f1",
          padding: "2px 8px", borderRadius: 8, whiteSpace: "nowrap",
        }}>
          {coinResult === "H" ? "Heads!" : "Tails!"}
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dangleSwing {
          0% { transform: rotate(0deg); }
          15% { transform: rotate(25deg); }
          30% { transform: rotate(-20deg); }
          45% { transform: rotate(15deg); }
          60% { transform: rotate(-10deg); }
          75% { transform: rotate(5deg); }
          90% { transform: rotate(-2deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes dangleSpin {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(1080deg); }
        }
      `}} />
    </div>
  );
}
