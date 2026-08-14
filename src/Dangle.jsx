import React, { useState, useRef, useCallback, useEffect } from "react";

/* Interactive dangle charm — hangs from top-right of mobile header.
   Touch-drag to pull and release, or tap to flick.
   Real pendulum physics with 3D rotation effect. */

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

function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === "coin") {
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
      setTimeout(() => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 300; o.type = "sine";
        g.gain.setValueAtTime(0.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        o.start(); o.stop(ctx.currentTime + 0.15);
      }, 500);
    } else if (type === "bell") {
      [800, 1200, 1600].forEach((freq, i) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = freq; o.type = "sine";
        g.gain.setValueAtTime(0.15 - i * 0.04, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        o.start(); o.stop(ctx.currentTime + 0.8);
      });
    } else {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 350 + Math.random() * 150; o.type = "triangle";
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      o.start(); o.stop(ctx.currentTime + 0.12);
    }
  } catch {}
}

export default function Dangle({ type = "nimbu" }) {
  const [angle, setAngle] = useState(0);
  const [coinFlipping, setCoinFlipping] = useState(false);
  const [coinResult, setCoinResult] = useState(null);
  const animRef = useRef(null);
  const physRef = useRef({ angle: 0, velocity: 0, running: false });
  const dragRef = useRef({ startX: 0, startY: 0, lastX: 0, lastT: 0 });
  const containerRef = useRef(null);

  const STRING_LEN = 32;
  const CHARM_SIZE = 38;

  // Physics step
  const runPhysics = useCallback(() => {
    const p = physRef.current;
    p.running = true;
    const step = () => {
      if (!p.running) return;
      const gravity = -0.005 * Math.sin(p.angle * Math.PI / 180);
      p.velocity += gravity * 60;
      p.velocity *= 0.985; // lighter damping for smoother swing
      p.angle += p.velocity;
      if (Math.abs(p.velocity) < 0.05 && Math.abs(p.angle) < 0.5) {
        p.angle = 0; p.velocity = 0; p.running = false;
        setAngle(0);
        return;
      }
      // Clamp to reasonable range
      p.angle = Math.max(-60, Math.min(60, p.angle));
      setAngle(p.angle);
      animRef.current = requestAnimationFrame(step);
    };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(step);
  }, []);

  // Tap to flick
  const flick = useCallback((velocity) => {
    const p = physRef.current;
    p.velocity = velocity || (6 + Math.random() * 5) * (Math.random() < 0.5 ? 1 : -1);
    playSound(type);
    if (type === "coin") {
      setCoinFlipping(true); setCoinResult(null);
      setTimeout(() => { setCoinFlipping(false); setCoinResult(Math.random() < 0.5 ? "H" : "T"); }, 700);
    }
    runPhysics();
  }, [type, runPhysics]);

  // Simplified touch/click — tap to flick, drag to pull and release
  const isDragging = useRef(false);

  const onPointerDown = useCallback((e) => {
    isDragging.current = true;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    dragRef.current = { startX: x, lastX: x, lastT: Date.now(), moved: false };
    // Don't stop physics yet — only stop when actual drag is detected
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = x - dragRef.current.startX;
    if (Math.abs(dx) > 3) {
      if (!dragRef.current.moved) {
        // First move — now stop physics for dragging
        physRef.current.running = false;
        if (animRef.current) cancelAnimationFrame(animRef.current);
      }
      dragRef.current.moved = true;
    }
    const newAngle = Math.max(-50, Math.min(50, dx * 0.5));
    physRef.current.angle = newAngle;
    setAngle(newAngle);
    dragRef.current.lastX = x;
    dragRef.current.lastT = Date.now();
  }, []);

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const d = dragRef.current;
    if (d.moved) {
      // Was a drag — calculate release velocity
      const dt = Math.max(10, Date.now() - d.lastT);
      const dx = d.lastX - d.startX;
      physRef.current.velocity = Math.max(-12, Math.min(12, (dx / dt) * 6));
    } else {
      // Was a tap — random flick
      physRef.current.velocity = (3 + Math.random() * 3) * (Math.random() < 0.5 ? 1 : -1);
    }
    playSound(type);
    if (type === "coin") {
      setCoinFlipping(true); setCoinResult(null);
      setTimeout(() => { setCoinFlipping(false); setCoinResult(Math.random() < 0.5 ? "H" : "T"); }, 700);
    }
    runPhysics();
  }, [type, runPhysics]);

  // Safety: reset if stuck
  useEffect(() => {
    const safety = setInterval(() => {
      const p = physRef.current;
      if (!p.running && !isDragging.current && Math.abs(p.angle) > 1) {
        p.angle = 0; p.velocity = 0; setAngle(0);
      }
    }, 4000);
    return () => { clearInterval(safety); if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // 3D rotation derived from swing angle
  const rotateY = angle * 0.6;  // subtle Y rotation for depth
  const rotateZ = angle;        // main swing
  const scale = 1 + Math.abs(angle) * 0.002; // tiny scale for "closer" feel

  return (
    <div ref={containerRef} style={{
      position: "absolute", top: 0, right: 16,
      width: 54, height: STRING_LEN + CHARM_SIZE + 30,
      zIndex: 25, pointerEvents: "none",
    }}>
      <div
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={() => { if (isDragging.current) { isDragging.current = false; flick(); } }}
        style={{
          transformOrigin: "top center",
          transform: `rotateZ(${rotateZ}deg) rotateY(${rotateY}deg) scale(${scale})`,
          display: "flex", flexDirection: "column", alignItems: "center",
          pointerEvents: "auto", cursor: "grab",
          WebkitTapHighlightColor: "transparent", userSelect: "none",
          perspective: "400px",
          transition: isDragging.current ? "none" : undefined,
        }}
      >
        {/* String with knot */}
        <svg width="6" height={STRING_LEN} style={{ overflow: "visible" }}>
          <line x1="3" y1="0" x2="3" y2={STRING_LEN} stroke="#9a8c6c" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="3" cy={STRING_LEN - 1} r="2.5" fill="#b8860b" stroke="#8a6914" strokeWidth="0.8" />
        </svg>

        {/* Charm with shadow */}
        <div style={{
          filter: `drop-shadow(${angle * 0.15}px ${3 + Math.abs(angle) * 0.05}px ${4 + Math.abs(angle) * 0.1}px rgba(0,0,0,.25))`,
          ...(type === "coin" && coinFlipping ? { animation: "coinFlip3D 0.7s ease-out" } : {}),
          ...(type === "spinner" && physRef.current.running ? { animation: "spinSpin 0.4s linear infinite" } : {}),
        }}>
          {type === "nimbu" && <NimbuMirchi />}
          {type === "coin" && <Coin result={coinResult} />}
          {type === "cricket" && <CricketBall />}
          {type === "bell" && <Bell />}
          {type === "spinner" && <Spinner />}
        </div>

        {type === "coin" && coinResult && !coinFlipping && (
          <div style={{
            marginTop: 4, fontSize: 11, fontWeight: 700,
            color: "#fff", background: coinResult === "H" ? "#c5941a" : "#5b5fc7",
            padding: "2px 10px", borderRadius: 10, whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(0,0,0,.2)", letterSpacing: ".02em",
          }}>
            {coinResult === "H" ? "Heads!" : "Tails!"}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes coinFlip3D {
          0% { transform: perspective(300px) rotateY(0deg) scale(1); }
          30% { transform: perspective(300px) rotateY(540deg) scale(1.1); }
          60% { transform: perspective(300px) rotateY(900deg) scale(1.05); }
          100% { transform: perspective(300px) rotateY(1080deg) scale(1); }
        }
        @keyframes spinSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}

/* ---- Individual charm SVGs ---- */
function NimbuMirchi() {
  return (
    <svg width="36" height="46" viewBox="0 0 36 46">
      {/* 3 chillies */}
      <path d="M11 2 Q6 12 9 24 Q11 28 13 24 Q16 14 13 4 Z" fill="#e53e3e" />
      <path d="M11 1 Q11 -2 13 1" stroke="#276727" strokeWidth="1.8" fill="none" />
      <path d="M18 0 Q22 10 20 22 Q18 26 16 22 Q14 12 16 2 Z" fill="#c53030" />
      <path d="M18 -1 Q18 -4 16 -1" stroke="#276727" strokeWidth="1.8" fill="none" />
      <path d="M25 3 Q29 13 27 25 Q25 29 23 25 Q21 15 23 5 Z" fill="#e53e3e" />
      <path d="M25 2 Q25 -1 23 2" stroke="#276727" strokeWidth="1.8" fill="none" />
      {/* Lemon with highlight */}
      <ellipse cx="18" cy="36" rx="11" ry="9" fill="#ecc94b" />
      <ellipse cx="18" cy="36" rx="8" ry="6.5" fill="#f6e05e" />
      <ellipse cx="15" cy="33" rx="3" ry="2" fill="rgba(255,255,255,.3)" transform="rotate(-20 15 33)" />
      <ellipse cx="18" cy="43" rx="3" ry="2.5" fill="#d69e2e" />
    </svg>
  );
}

function Coin({ result }) {
  return (
    <svg width="38" height="38" viewBox="0 0 38 38">
      <defs>
        <radialGradient id="cg" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#ffe88a" />
          <stop offset="50%" stopColor="#d4a017" />
          <stop offset="100%" stopColor="#a07810" />
        </radialGradient>
      </defs>
      {/* Coin edge (3D depth) */}
      <ellipse cx="19" cy="21" rx="16" ry="16" fill="#8a6a10" />
      <circle cx="19" cy="19" r="16" fill="url(#cg)" stroke="#8a6a10" strokeWidth="1.5" />
      <circle cx="19" cy="19" r="13.5" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="0.8" />
      <circle cx="19" cy="19" r="11" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="0.5" />
      {/* Ashoka Chakra style center */}
      <circle cx="19" cy="18" r="5" fill="none" stroke="#8a6a10" strokeWidth="0.8" />
      <text x="19" y="23" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#7a5a0a" fontFamily="serif">
        {result || "₹"}
      </text>
      {/* Highlight */}
      <ellipse cx="14" cy="13" rx="5" ry="3.5" fill="rgba(255,255,255,.2)" transform="rotate(-30 14 13)" />
    </svg>
  );
}

function CricketBall() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34">
      <defs>
        <radialGradient id="bg" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#e84040" />
          <stop offset="100%" stopColor="#991111" />
        </radialGradient>
      </defs>
      <circle cx="17" cy="17" r="15" fill="url(#bg)" stroke="#881010" strokeWidth="1" />
      {/* Seam */}
      <path d="M8 7 Q17 17 8 27" fill="none" stroke="#ffe" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 7 Q17 17 26 27" fill="none" stroke="#ffe" strokeWidth="2" strokeLinecap="round" />
      {/* Stitch marks */}
      {[9,12,15,18,21,24].map((y) => <React.Fragment key={y}>
        <line x1="5" y1={y} x2="8.5" y2={y-1.5} stroke="#ffe" strokeWidth="0.7" />
        <line x1="25.5" y1={y-1.5} x2="29" y2={y} stroke="#ffe" strokeWidth="0.7" />
      </React.Fragment>)}
      {/* Highlight */}
      <ellipse cx="12" cy="10" rx="4" ry="3" fill="rgba(255,255,255,.15)" transform="rotate(-30 12 10)" />
    </svg>
  );
}

function Bell() {
  return (
    <svg width="32" height="42" viewBox="0 0 32 42">
      <defs>
        <linearGradient id="blg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe88a" />
          <stop offset="50%" stopColor="#d4a017" />
          <stop offset="100%" stopColor="#a07810" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="4" r="3.5" fill="url(#blg)" stroke="#8a6a10" strokeWidth="0.8" />
      <path d="M5 28 Q5 8 16 6 Q27 8 27 28 Z" fill="url(#blg)" stroke="#8a6a10" strokeWidth="0.8" />
      <ellipse cx="16" cy="28" rx="12" ry="3.5" fill="#c5941a" stroke="#8a6a10" strokeWidth="0.8" />
      <line x1="16" y1="24" x2="16" y2="36" stroke="#7a5a0a" strokeWidth="2.5" />
      <circle cx="16" cy="37" r="3.5" fill="#8a6a10" />
      {/* Highlight */}
      <ellipse cx="11" cy="14" rx="3" ry="5" fill="rgba(255,255,255,.15)" transform="rotate(-15 11 14)" />
    </svg>
  );
}

function Spinner() {
  const colors = ["#e53e3e", "#ecc94b", "#38a169", "#4299e1", "#9f7aea", "#ed8936"];
  return (
    <svg width="36" height="36" viewBox="0 0 36 36">
      {colors.map((c, i) => {
        const a1 = i * 60 - 30, a2 = i * 60 + 30;
        return <path key={i}
          d={`M18 18 L${18 + 15 * Math.cos((a1 * Math.PI) / 180)} ${18 + 15 * Math.sin((a1 * Math.PI) / 180)} A15 15 0 0 1 ${18 + 15 * Math.cos((a2 * Math.PI) / 180)} ${18 + 15 * Math.sin((a2 * Math.PI) / 180)} Z`}
          fill={c} stroke="rgba(0,0,0,.1)" strokeWidth="0.5" />;
      })}
      <circle cx="18" cy="18" r="5.5" fill="#fff" stroke="#e2e8f0" strokeWidth="1" />
      <circle cx="18" cy="18" r="2.5" fill="#4a5568" />
      {/* Highlight */}
      <ellipse cx="13" cy="11" rx="4" ry="3" fill="rgba(255,255,255,.12)" transform="rotate(-30 13 11)" />
    </svg>
  );
}
