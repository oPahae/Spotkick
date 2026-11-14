import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import { Home, RotateCcw, Settings2, MousePointer2 } from "lucide-react";
import SoccerScene from "./soccerScene";
import Button from "../../components/button";
import { Match } from "./engine";
import { HL, HW, GOAL_HALF, POSITIONS } from "./config";
import { dirOf } from "./util";
import { audio } from "../../lib/audio";
import { disposeSharedGeo } from "../playerModel";
import { disposeBallTexture } from "../ball";

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const CONTROLS = [
  ["W A S D", "Run"],
  ["Shift", "Sprint"],
  ["Mouse", "Look / aim (crosshair)"],
  ["Left click (hold)", "Shoot - hold for power, release to fire"],
  ["Right click", "Short pass"],
  ["E", "Long pass"],
  ["R", "Call for the ball"],
  ["Left click, no ball", "Tackle"],
  ["Keeper: A/D + left click", "Dive (hands catch the ball)"],
];

function Controls({ compact }) {
  return (
    <ul className={`grid gap-x-8 gap-y-1.5 text-left ${compact ? "text-sm" : "text-base"} sm:grid-cols-2`}>
      {CONTROLS.map(([k, v]) => (
        <li key={k} className="flex items-baseline gap-3">
          <kbd className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 font-sans text-xs font-bold text-flare-300 ring-1 ring-inset ring-white/15">{k}</kbd>
          <span className="text-chalk/75">{v}</span>
        </li>
      ))}
    </ul>
  );
}

function drawRadar(canvas, match) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "rgba(5,13,10,0.62)";
  ctx.fillRect(0, 0, W, H);
  const pad = 8;
  const sx = (x) => W / 2 - (x / HW) * (W / 2 - pad); // team 0 attacks up, left side of view = +x
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
  ctx.beginPath();
  ctx.moveTo(pad, H / 2);
  ctx.lineTo(W - pad, H / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 9, 0, Math.PI * 2);
  ctx.stroke();
  const gw = (GOAL_HALF / HW) * (W / 2 - pad);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(W / 2 - gw, pad - 2, gw * 2, 3);
  ctx.fillRect(W / 2 - gw, H - pad - 1, gw * 2, 3);
  // team 0 attacks +z -> draw +z at top
  const Y = (z) => H / 2 - (z / HL) * (H / 2 - pad);
  match.players.forEach((p) => {
    const x = sx(p.x);
    const y = Y(p.z);
    ctx.fillStyle = p.team === 0 ? "#3b8cff" : "#ff4a5a";
    if (p.human) {
      ctx.save();
      ctx.translate(x, y);
      const yaw = match.input.yaw;
      // forward in world (-sin, -cos) -> screen: x flipped, z up
      const fx = -(-Math.sin(yaw));
      const fy = -(-Math.cos(yaw));
      ctx.rotate(Math.atan2(fx, -fy));
      ctx.fillStyle = "#ffe066";
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 5);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.beginPath();
    if (p.team === 0) {
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x - 4, y - 3);
      ctx.lineTo(x + 4, y - 3);
      ctx.closePath();
    } else {
      ctx.arc(x, y, 3.4, 0, Math.PI * 2);
    }
    ctx.fill();
  });
  const b = match.ball;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(sx(b.x), Y(b.z), 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.stroke();
}

export default function SoccerView({ config, onExit, onRematch, net = null, onSendInput = null, isHost = true }) {
  const router = useRouter();
  const [match] = useState(() => net || new Match({ role: config.role, difficulty: config.difficulty, minutes: config.minutes }));
  const wrap = useRef(null);
  const radar = useRef(null);
  const ringRef = useRef(null);
  const crossRef = useRef(null);
  const staminaRef = useRef(null);
  const lockedRef = useRef(false);
  const [locked, setLocked] = useState(false);
  const myRole = net ? match.human.role : config.role;
  const [started, setStarted] = useState(false);
  const [snap, setSnap] = useState(match.snapshot());
  const [banner, setBanner] = useState(null);
  const [lockError, setLockError] = useState(false);
  const bannerTimer = useRef(null);
  const sens = config.sens || 1;

  useEffect(() => {
    match.paused = true;
    return () => {
      disposeSharedGeo();
      disposeBallTexture();
    };
  }, [match]);

  useEffect(() => {
    match.paused = !locked;
  }, [match, locked]);

  const showBanner = useCallback((text, team) => {
    setBanner({ text, team, key: Math.random() });
    clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), text === "GOAL!" ? 3000 : 1500);
  }, []);

  const onEvents = useCallback(
    (evs) => {
      evs.forEach((ev) => {
        if (ev.type === "kick") audio.play("kick");
        else if (ev.type === "bounce") audio.play("bounce");
        else if (ev.type === "post") audio.play(ev.v > 5 ? "bar" : "post");
        else if (ev.type === "save") audio.play("save");
        else if (ev.type === "tackle") audio.play("click");
        else if (ev.type === "goal") audio.play("goal");
        else if (ev.type === "whistle") audio.play("whistle");
        else if (ev.type === "out") audio.play("miss");
        else if (ev.type === "banner") showBanner(ev.text, ev.team);
        else if (ev.type === "ended") {
          try {
            document.exitPointerLock();
          } catch (err) {
            /* ignore */
          }
        }
      });
    },
    [showBanner]
  );

  // pointer lock + inputs
  useEffect(() => {
    const el = wrap.current;
    const inp = match.input;
    const keys = {};
    const recompute = () => {
      inp.mz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      inp.mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      inp.sprint = !!(keys.ShiftLeft || keys.ShiftRight);
    };
    const onLockChange = () => {
      const on = document.pointerLockElement === el;
      lockedRef.current = on;
      setLocked(on);
      if (on) { setStarted(true); setLockError(false); audio.unlock(); }
      else {
        inp.fireDown = false; inp.charge = 0;
        Object.keys(keys).forEach((k) => { keys[k] = false; });
        recompute();
      }
    };
    const onLockError = () => setLockError(true);
    const onMove = (e) => {
      if (!lockedRef.current) return;
      if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
      const k = 0.0022 * sens;
      inp.yaw -= (e.movementX || 0) * k;
      inp.pitch = Math.max(-1.3, Math.min(1.3, inp.pitch - (e.movementY || 0) * k));
    };
    const onDown = (e) => {
      if (!lockedRef.current) return;
      e.preventDefault();
      if (e.button === 0) { inp.fireDown = true; inp.tackle = true; }
      else if (e.button === 2) inp.pass = true;
    };
    const onUp = (e) => {
      if (!lockedRef.current) return;
      if (e.button === 0) { inp.fireDown = false; inp.fireUp = true; }
    };
    const onKeyDown = (e) => {
      if (!lockedRef.current) return;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight", "Space"].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      keys[e.code] = true;
      if (e.code === "KeyE") inp.lob = true;
      if (e.code === "KeyR" || e.code === "Space") inp.call = true;
      recompute();
    };
    const onKeyUp = (e) => {
      keys[e.code] = false;
      recompute();
    };
    const noMenu = (e) => e.preventDefault();
    document.addEventListener("pointerlockchange", onLockChange);
    document.addEventListener("pointerlockerror", onLockError);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    el.addEventListener("contextmenu", noMenu);
    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("pointerlockerror", onLockError);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      el.removeEventListener("contextmenu", noMenu);
      if (document.pointerLockElement === el) document.exitPointerLock();
    };
  }, [match, sens]);

  // network: send inputs 30 times per second
  useEffect(() => {
    if (!net || !onSendInput) return undefined;
    const id = setInterval(() => {
      const i = match.input;
      const on = lockedRef.current;
      onSendInput({
        mx: on ? i.mx : 0, mz: on ? i.mz : 0, yaw: i.yaw, pitch: i.pitch, sprint: on && i.sprint,
        fireDown: on && i.fireDown, fireUp: i.fireUp, pass: i.pass, lob: i.lob, tackle: i.tackle, call: i.call,
      });
      i.fireUp = false; i.pass = false; i.lob = false; i.tackle = false; i.call = false;
    }, 33);
    return () => clearInterval(id);
  }, [match, net, onSendInput]);

  // HUD refresh
  useEffect(() => {
    const id = setInterval(() => setSnap(match.snapshot()), 150);
    return () => clearInterval(id);
  }, [match]);

  useEffect(() => {
    let raf;
    let last = 0;
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      const h = match.human;
      if (ringRef.current && h) {
        const c = h.charge;
        ringRef.current.style.strokeDashoffset = String(113 * (1 - c));
        ringRef.current.style.opacity = c > 0 ? "1" : "0";
      }
      if (staminaRef.current && h) staminaRef.current.style.width = `${h.stamina}%`;
      if (crossRef.current && h) {
        const q = match.canKick(h) || match.ball.owner === h ? match.crosshairTeammate(h, 3, 60) : null;
        crossRef.current.dataset.mate = q ? "1" : "0";
      }
      if (radar.current && t - last > 50) {
        last = t;
        drawRadar(radar.current, match);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [match]);

  const lock = () => {
    if (match.ended) return;
    try {
      const p = wrap.current.requestPointerLock();
      if (p && p.catch) p.catch(() => setLockError(true));
    } catch (err) {
      setLockError(true);
    }
  };

  const countdown = snap.phase === "kickoff" ? Math.max(1, 3 - Math.floor(snap.phaseT)) : null;
  const ended = snap.phase === "ended";
  const [a, b] = snap.score;
  const roleLabel = (POSITIONS.find((p) => p.id === myRole) || (myRole === "GK" ? { label: "Goalkeeper" } : {})).label;
  const st = snap.stats;
  const posTotal = st[0].possession + st[1].possession || 1;
  const poss0 = Math.round((st[0].possession / posTotal) * 100);
  const result = a > b ? "VICTORY" : a < b ? "DEFEAT" : "DRAW";

  const statRows = [
    ["Shots", st[0].shots, st[1].shots],
    ["On target", st[0].onTarget, st[1].onTarget],
    ["Passes", `${st[0].passOk}/${st[0].passes}`, `${st[1].passOk}/${st[1].passes}`],
    ["Tackles won", st[0].tackles, st[1].tackles],
    ["Saves", st[0].saves, st[1].saves],
    ["Possession", `${poss0}%`, `${100 - poss0}%`],
  ];

  return (
    <div ref={wrap} className="fixed inset-0 select-none overflow-hidden bg-ink-950" style={{ cursor: locked ? "none" : "default" }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 78, near: 0.05, far: 400, position: [0, 1.6, 0] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onClick={() => { if (!locked) lock(); }}
      >
        <AdaptiveDpr pixelated />
        <SoccerScene match={match} onEvents={onEvents} />
      </Canvas>

      {/* scoreboard */}
      <div className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 items-stretch overflow-hidden rounded-2xl bg-ink-950/75 ring-1 ring-inset ring-white/15 backdrop-blur-md">
        <div className="flex items-center gap-3 bg-[#1f6fe0]/90 px-5 py-2">
          <span className="font-display text-sm font-bold uppercase tracking-widest">Blue</span>
          <span className="font-display text-4xl font-black tabular-nums leading-none">{a}</span>
        </div>
        <div className="flex min-w-[5.5rem] flex-col items-center justify-center px-3">
          <span className="font-display text-2xl font-extrabold tabular-nums leading-none">{fmt(Math.max(0, snap.total - snap.clock))}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-chalk/50">{snap.restart ? { throwin: "Throw-in", corner: "Corner", goalkick: "Goal kick" }[snap.restart] : "Match"}</span>
        </div>
        <div className="flex items-center gap-3 bg-[#e0283a]/90 px-5 py-2">
          <span className="font-display text-4xl font-black tabular-nums leading-none">{b}</span>
          <span className="font-display text-sm font-bold uppercase tracking-widest">Red</span>
        </div>
      </div>

      {/* crosshair */}
      {locked && !ended ? (
        <div ref={crossRef} data-mate="0" className="group pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2">
          <svg viewBox="0 0 48 48" className="h-full w-full">
            <circle cx="24" cy="24" r="1.8" fill="#fff" stroke="#000" strokeOpacity="0.6" strokeWidth="0.6" />
            <g stroke="#fff" strokeWidth="2" strokeLinecap="round" className="drop-shadow-[0_0_2px_rgba(0,0,0,0.9)] group-data-[mate='1']:stroke-[#4fd88a]">
              <line x1="24" y1="9" x2="24" y2="15" />
              <line x1="24" y1="33" x2="24" y2="39" />
              <line x1="9" y1="24" x2="15" y2="24" />
              <line x1="33" y1="24" x2="39" y2="24" />
            </g>
            <circle cx="24" cy="24" r="18" fill="none" stroke="#ffb020" strokeWidth="3" strokeDasharray="113" strokeDashoffset="113" transform="rotate(-90 24 24)" ref={ringRef} style={{ opacity: 0 }} />
          </svg>
        </div>
      ) : null}

      {/* bottom left: role + stamina */}
      <div className="pointer-events-none absolute bottom-5 left-5 w-64 rounded-2xl bg-ink-950/70 p-4 ring-1 ring-inset ring-white/10 backdrop-blur-md">
        <p className="font-display text-xl font-extrabold uppercase leading-none">{roleLabel}</p>
        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-chalk/50">{DIFFICULTY_LABEL[config.difficulty]} &middot; {snap.hasBall ? "You have the ball" : snap.canKick ? "Ball in reach" : "Off the ball"}</p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10" aria-label="Stamina">
          <div ref={staminaRef} className={`h-full rounded-full ${snap.exhausted ? "bg-siren-500" : "bg-turf-400"}`} style={{ width: `${snap.stamina}%` }} />
        </div>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-chalk/40">Stamina</p>
        {snap.callT > 0 ? <p className="mt-2 text-xs font-bold uppercase tracking-wider text-flare-400">Calling for the ball</p> : null}
      </div>

      {/* radar */}
      <canvas ref={radar} width={130} height={200} className="pointer-events-none absolute bottom-5 right-5 rounded-xl ring-1 ring-white/15" />

      {/* countdown */}
      {countdown && locked ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span key={countdown} className="animate-countPop font-display text-[12rem] font-black italic leading-none text-chalk drop-shadow-[0_8px_40px_rgba(0,0,0,0.6)]">{countdown}</span>
        </div>
      ) : null}

      {/* banner */}
      {banner && !ended ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/4 flex justify-center">
          <span
            key={banner.key}
            className={`animate-bannerIn font-display font-black uppercase italic leading-none drop-shadow-[0_8px_40px_rgba(0,0,0,0.6)] ${banner.text === "GOAL!" ? "text-9xl" : "text-6xl"} ${banner.team === 0 ? "text-[#5aa2ff]" : banner.team === 1 ? "text-[#ff6b78]" : "text-flare-400"}`}
          >
            {banner.text}
          </span>
        </div>
      ) : null}

      {/* pause / start overlay */}
      {!locked && !ended ? (
        <div className="absolute inset-0 flex items-center justify-center bg-ink-950/80 p-6 backdrop-blur-sm" onClick={lock}>
          <div className="w-full max-w-2xl rounded-3xl bg-ink-900/90 p-8 text-center ring-1 ring-inset ring-white/15" onClick={(e) => e.stopPropagation()}>
            <MousePointer2 className="mx-auto h-8 w-8 text-flare-400" aria-hidden="true" />
            <h2 className="mt-3 font-display text-5xl font-black uppercase italic">{net ? (started ? "Mouse released" : "Ready?") : started ? "Paused" : "Ready?"}</h2>
            <p className="mt-1 text-chalk/60">You are the {roleLabel} for the blue team. Your teammates wear the yellow triangle.{net ? " The match keeps running for the others." : ""}</p>
            <div className="mt-6 rounded-2xl bg-black/25 p-5"><Controls compact /></div>
            {lockError ? <p className="mt-4 text-sm text-siren-400">The browser refused mouse capture. Click the button again (wait a second after pressing Esc).</p> : null}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button size="lg" onClick={lock}>{started ? "Resume" : "Click to play"}</Button>
              <Button size="lg" variant="secondary" onClick={onExit}>Quit</Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* final */}
      {ended ? (
        <div className="absolute inset-0 flex items-center justify-center bg-ink-950/85 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-ink-900/95 p-8 ring-1 ring-inset ring-white/15">
            <p className="text-center font-display text-sm font-bold uppercase tracking-[0.3em] text-flare-400">Full time</p>
            <h2 className={`text-center font-display text-7xl font-black uppercase italic ${a > b ? "text-turf-400" : a < b ? "text-siren-400" : "text-chalk"}`}>{result}</h2>
            <p className="mt-1 text-center font-display text-6xl font-black tabular-nums"><span className="text-[#5aa2ff]">{a}</span> <span className="text-chalk/40">-</span> <span className="text-[#ff6b78]">{b}</span></p>
            <div className="mt-6 divide-y divide-white/10 rounded-2xl bg-black/25 px-5 py-1 text-lg">
              {statRows.map(([label, x, y]) => (
                <div key={label} className="flex items-center justify-between py-2">
                  <span className="w-20 text-left font-display text-2xl font-extrabold tabular-nums text-[#5aa2ff]">{x}</span>
                  <span className="text-sm font-semibold uppercase tracking-wider text-chalk/55">{label}</span>
                  <span className="w-20 text-right font-display text-2xl font-extrabold tabular-nums text-[#ff6b78]">{y}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {isHost ? <Button icon={RotateCcw} onClick={onRematch}>{net ? "Back to lobby" : "Rematch"}</Button> : <p className="w-full text-center text-sm text-chalk/55">Waiting for the host...</p>}
              <Button icon={Settings2} variant="secondary" onClick={onExit}>{net ? "Leave party" : "Change settings"}</Button>
              <Button icon={Home} variant="ghost" onClick={() => router.push("/home")}>Home</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const DIFFICULTY_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" };
export { dirOf };
