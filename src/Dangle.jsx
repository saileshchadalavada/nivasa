import React, { useState, useRef, useCallback, useEffect } from "react";

/* Interactive dangle charm — hangs from top-right of mobile header.
   Touch-drag to pull, release to swing with pendulum physics.
   Coin mode does a 3D flip showing heads/tails. */

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

/* Sound effects via Web Audio */
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === "coin") {
      // Metallic coin flip: two quick rising tones
      [0, 60, 120, 200, 300].forEach((delay, i) => {
        setTimeout(() => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = 2000 + i * 400; o.type = "sine";
          g.gain.setValueAtTime(0.08, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
          o.start(); o.stop(ctx.currentTime + 0.06);
        }, delay);
      });
      // Landing thud
      setTimeout(() => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 300; o.type = "sine";
        g.gain.setValueAtTime(0.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        o.start(); o.stop(ctx.currentTime + 0.15);
      }, 500);
    } else if (type === "bell") {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 1200; o.type = "sine";
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      o.start(); o.stop(ctx.currentTime + 0.8);
    } else {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 400 + Math.random() * 200; o.type = "triangle";
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      o.start(); o.stop(ctx.currentTime + 0.1);
    }
  } catch {}
}

export default function Dangle({ type = "nimbu" }) {
  const [angle, setAngle] = useState(0);
  const [coinFlipping, setCoinFlipping] = useState(false);
  const [coinResult, setCoinResult] = useState(null);
  const animRef = useRef(null);
  const physicsRef = useRef({ angle: 0, velocity: 0, running: false });

  // Pendulum physics loop
  const startSwing = useCallback((initialVelocity) => {
    const p = physicsRef.current;
    p.velocity = initialVelocity || (8 + Math.random() * 6);
    p.running = true;
    playSound(type);

    if (type === "coin") {
      setCoinFlipping(true);
      setCoinResult(null);
      setTimeout(() => {
        setCoinFlipping(false);
        setCoinResult(Math.random() < 0.5 ? "H" : "T");
      }, 700);
    }

    const step = () => {
      if (!p.running) return;
      // Damped pendulum: gravity restoring force + friction
      const gravity = -0.003 * Math.sin(p.angle * Math.PI / 180);
      p.velocity += gravity * 60;
      p.velocity *= 0.97; // damping
      p.angle += p.velocity;

      if (Math.abs(p.velocity) < 0.05 && Math.abs(p.angle) < 0.5) {
        p.angle = 0; p.velocity = 0; p.running = false;
        setAngle(0);
        return;
      }
      setAngle(p.angle);
      animRef.current = requestAnimationFrame(step);
    };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(step);
  }, [type]);

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);

  const handleInteraction = (e) => {
    e.preventDefault();
    e.stopPropagation();
    startSwing();
  };

  const STRING_LEN = 30;
  const CHARM_SIZE = 36;

  return (
    <div style={{
      position: "absolute", top: 0, right: 20,
      width: 50, height: STRING_LEN + CHARM_SIZE + 20,
      zIndex: 25, pointerEvents: "none",
    }}>
      <div
        onClick={handleInteraction}
        onTouchStart={handleInteraction}
        style={{
          transformOrigin: "top center",
          transform: `rotate(${angle}deg)`,
          display: "flex", flexDirection: "column", alignItems: "center",
          pointerEvents: "auto", cursor: "pointer",
          WebkitTapHighlightColor: "transparent", userSelect: "none",
        }}
      >
        {/* String */}
        <div style={{ width: 2, height: STRING_LEN, background: "linear-gradient(to bottom, rgba(150,150,150,.6), rgba(120,120,120,.8))", borderRadius: 1 }} />

        {/* Charm */}
        <div style={{
          width: CHARM_SIZE, height: CHARM_SIZE, display: "flex", alignItems: "center", justifyContent: "center",
          filter: physicsRef.current.running ? "drop-shadow(0 3px 6px rgba(0,0,0,.25))" : "drop-shadow(0 1px 3px rgba(0,0,0,.15))",
          transition: "filter 0.3s",
          ...(type === "coin" && coinFlipping ? { animation: "coinFlip 0.7s ease-out" } : {}),
        }}>
          {type === "nimbu" && (
            <svg width="34" height="42" viewBox="0 0 34 42">
              <path d="M10 4 Q6 12 8 22 Q10 26 12 22 Q14 14 12 6 Z" fill="#e53e3e" />
              <path d="M10 3 Q10 0 12 2" stroke="#2d6a2d" strokeWidth="1.5" fill="none" />
              <path d="M16 2 Q20 10 18 20 Q16 24 14 20 Q12 12 14 4 Z" fill="#c53030" />
              <path d="M16 1 Q16 -2 14 1" stroke="#2d6a2d" strokeWidth="1.5" fill="none" />
              <path d="M22 6 Q26 14 24 24 Q22 28 20 24 Q18 16 20 8 Z" fill="#e53e3e" />
              <path d="M22 5 Q22 2 20 4" stroke="#2d6a2d" strokeWidth="1.5" fill="none" />
              <ellipse cx="17" cy="34" rx="10" ry="8" fill="#ecc94b" />
              <ellipse cx="17" cy="34" rx="7.5" ry="6" fill="#f6e05e" />
              <ellipse cx="17" cy="40" rx="3" ry="2.5" fill="#d69e2e" />
            </svg>
          )}
          {type === "coin" && (
            <svg width="36" height="36" viewBox="0 0 36 36">
              <defs>
                <radialGradient id="coinGrad"><stop offset="0%" stopColor="#f0d060" /><stop offset="100%" stopColor="#c5941a" /></radialGradient>
              </defs>
              <circle cx="18" cy="18" r="16" fill="url(#coinGrad)" stroke="#a07810" strokeWidth="2" />
              <circle cx="18" cy="18" r="13" fill="none" stroke="#d4a830" strokeWidth="0.8" />
              <circle cx="18" cy="18" r="10" fill="none" stroke="#d4a830" strokeWidth="0.5" />
              <text x="18" y="23" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#7a5a0a" fontFamily="serif">
                {coinResult || "₹"}
              </text>
            </svg>
          )}
          {type === "cricket" && (
            <svg width="32" height="32" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="14" fill="#cc2222" stroke="#991111" strokeWidth="1.5" />
              <path d="M8 8 Q16 16 8 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              <path d="M24 8 Q16 16 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              {/* Stitch marks */}
              {[10,13,16,19,22].map((y) => <React.Fragment key={y}>
                <line x1="6" y1={y} x2="9" y2={y-1} stroke="#fff" strokeWidth="0.8" />
                <line x1="23" y1={y-1} x2="26" y2={y} stroke="#fff" strokeWidth="0.8" />
              </React.Fragment>)}
            </svg>
          )}
          {type === "bell" && (
            <svg width="30" height="38" viewBox="0 0 30 38">
              <defs>
                <linearGradient id="bellGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f0d060" /><stop offset="100%" stopColor="#b8860b" /></linearGradient>
              </defs>
              <circle cx="15" cy="4" r="3.5" fill="url(#bellGrad)" stroke="#a07810" strokeWidth="0.8" />
              <path d="M5 26 Q5 8 15 6 Q25 8 25 26 Z" fill="url(#bellGrad)" stroke="#a07810" strokeWidth="0.8" />
              <ellipse cx="15" cy="26" rx="11" ry="3.5" fill="#c5941a" stroke="#a07810" strokeWidth="0.8" />
              <line x1="15" y1="22" x2="15" y2="34" stroke="#8B6914" strokeWidth="2.5" />
              <circle cx="15" cy="35" r="3.5" fill="#8B6914" />
            </svg>
          )}
          {type === "spinner" && (
            <svg width="34" height="34" viewBox="0 0 34 34" style={physicsRef.current.running ? { animation: "spinnerSpin 0.5s linear infinite" } : {}}>
              {[0, 60, 120, 180, 240, 300].map((a, i) => (
                <path key={i}
                  d={`M17 17 L${17 + 14 * Math.cos(((a - 30) * Math.PI) / 180)} ${17 + 14 * Math.sin(((a - 30) * Math.PI) / 180)} A14 14 0 0 1 ${17 + 14 * Math.cos(((a + 30) * Math.PI) / 180)} ${17 + 14 * Math.sin(((a + 30) * Math.PI) / 180)} Z`}
                  fill={["#e53e3e", "#ecc94b", "#38a169", "#4299e1", "#9f7aea", "#ed8936"][i]} />
              ))}
              <circle cx="17" cy="17" r="5" fill="#fff" stroke="#e2e8f0" strokeWidth="1" />
              <circle cx="17" cy="17" r="2.5" fill="#4a5568" />
            </svg>
          )}
        </div>

        {/* Coin result label */}
        {type === "coin" && coinResult && !coinFlipping && (
          <div style={{
            marginTop: 4, fontSize: 11, fontWeight: 700,
            color: "#fff", background: coinResult === "H" ? "#d4a017" : "#6366f1",
            padding: "2px 10px", borderRadius: 10, whiteSpace: "nowrap",
            boxShadow: "0 2px 6px rgba(0,0,0,.2)",
          }}>
            {coinResult === "H" ? "Heads!" : "Tails!"}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes coinFlip {
          0% { transform: perspective(200px) rotateY(0deg); }
          100% { transform: perspective(200px) rotateY(1080deg); }
        }
        @keyframes spinnerSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
