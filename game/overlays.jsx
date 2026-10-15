import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Check, Crosshair, Hand, Goal, CircleDot, Minus, X, Trophy, ShieldX, WifiOff, Loader2, Home, RotateCcw, Timer, UserX } from "lucide-react";
import Avatar from "../components/avatar";
import Button from "../components/button";
import { audio } from "../lib/audio";

export function useCountdown(deadlineAt, serverNow) {
  const [ms, setMs] = useState(null);
  useEffect(() => {
    if (!deadlineAt) {
      setMs(null);
      return undefined;
    }
    const tick = () => setMs(Math.max(0, deadlineAt - serverNow()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [deadlineAt]);
  return ms;
}

export function Countdown({ state, info, serverNow }) {
  const ms = useCountdown(state.deadlineAt, serverNow);
  const label = ms === null ? null : ms > 3200 ? "VS" : ms > 2400 ? "3" : ms > 1600 ? "2" : ms > 800 ? "1" : "GO";
  const last = useRef(null);
  useEffect(() => {
    if (!label || last.current === label) return;
    last.current = label;
    if (label === "GO") audio.play("go");
    else if (label !== "VS") audio.play("beep");
    else audio.play("whistle");
  }, [label]);
  if (!label) return null;
  const [a, b] = info.players;
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-ink-950/35">
      {label === "VS" ? (
        <div key="vs" className="flex animate-bannerIn items-center gap-8">
          <div className="flex flex-col items-center gap-3">
            <Avatar username={a.username} sex={a.sex} image={a.image} size={96} ring />
            <span className="font-display text-3xl font-extrabold uppercase">{a.username}</span>
          </div>
          <span className="font-display text-7xl font-black italic text-flare-500">VS</span>
          <div className="flex flex-col items-center gap-3">
            <Avatar username={b.username} sex={b.sex} image={b.image} size={96} ring />
            <span className="font-display text-3xl font-extrabold uppercase">{b.username}</span>
          </div>
        </div>
      ) : (
        <span key={label} className={`animate-countPop font-display font-black italic leading-none drop-shadow-[0_8px_40px_rgba(0,0,0,0.6)] ${label === "GO" ? "text-[14rem] text-flare-500" : "text-[16rem] text-chalk"}`}>
          {label}
        </span>
      )}
    </div>
  );
}

export function Prompt({ state, info, mySlot, committed, serverNow }) {
  const ms = useCountdown(state.deadlineAt, serverNow);
  const live = state.state === "SHOOTING" || state.state === "GOALKEEPING";
  if (!live) return null;
  const iShoot = mySlot === state.shooterSlot;
  const myLocked = iShoot ? state.locked.shooter || !!committed : state.locked.keeper || !!committed;
  const otherLocked = iShoot ? state.locked.keeper : state.locked.shooter;
  const secs = ms === null ? null : Math.ceil(ms / 1000);
  const Icon = iShoot ? Crosshair : Hand;
  const opponent = info.players[1 - mySlot];
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-3">
      {myLocked ? (
        <div className="flex animate-bannerIn items-center gap-3 rounded-2xl bg-ink-950/75 px-6 py-4 ring-1 ring-inset ring-turf-500/50 backdrop-blur-xl" role="status">
          <Check className="h-6 w-6 text-turf-400" aria-hidden="true" />
          <div>
            <p className="font-display text-2xl font-extrabold uppercase leading-none">{iShoot ? "Shot locked in" : "Dive locked in"}</p>
            <p className="mt-0.5 text-sm text-chalk/60">
              {otherLocked ? "Resolving the penalty" : `Waiting for ${opponent.username} to ${iShoot ? "choose a dive" : "take the shot"}`}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex animate-bannerIn items-center gap-4 rounded-full bg-ink-950/60 py-3 pl-4 pr-6 ring-1 ring-inset ring-white/20 backdrop-blur-xl" role="status">
          <span className={`flex h-11 w-11 animate-floatY items-center justify-center rounded-full ${iShoot ? "bg-flare-500" : "bg-sky-500"} text-ink-950`}>
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="font-display text-4xl font-extrabold uppercase tracking-[0.15em]">{iShoot ? "Click to shoot" : "Click to dive"}</span>
        </div>
      )}
      <div className="flex items-center gap-4 text-sm font-semibold text-chalk/70">
        {secs !== null ? (
          <span className="flex items-center gap-1.5 rounded-full bg-ink-950/60 px-3 py-1 tabular-nums backdrop-blur">
            <Timer className="h-4 w-4" aria-hidden="true" />
            {secs}s
          </span>
        ) : null}
        {!myLocked ? (
          <span className="rounded-full bg-ink-950/60 px-3 py-1 backdrop-blur">
            {otherLocked ? `${opponent.username} is ready` : `${opponent.username} is choosing`}
          </span>
        ) : null}
      </div>
    </div>
  );
}

const RESULTS = {
  GOAL: { text: "GOAL", icon: Goal, tone: "text-turf-400", ring: "ring-turf-500/60" },
  SAVED: { text: "SAVED", icon: Hand, tone: "text-sky-400", ring: "ring-sky-500/60" },
  MISS: { text: "MISS", icon: X, tone: "text-siren-400", ring: "ring-siren-500/60" },
  POST: { text: "POST", icon: CircleDot, tone: "text-flare-400", ring: "ring-flare-500/60" },
  CROSSBAR: { text: "CROSSBAR", icon: Minus, tone: "text-flare-400", ring: "ring-flare-500/60" },
};

export function ResultBanner({ resolve, state, info }) {
  const [shownRound, setShownRound] = useState(0);
  useEffect(() => {
    if (!resolve) return undefined;
    const delay = (resolve.launchDelayMs + (resolve.decidedAt * 1000) / resolve.playbackRate) - (performance.now() - resolve.receivedAt);
    const id = setTimeout(() => setShownRound(resolve.round), Math.max(0, delay));
    return () => clearTimeout(id);
  }, [resolve]);
  if (!resolve || shownRound !== resolve.round || resolve.round !== state.round) return null;
  if (state.state === "SHOOTING" || state.state === "GOALKEEPING") return null;
  const r = RESULTS[resolve.result];
  const Icon = r.icon;
  const shooter = info.players[resolve.shooterSlot];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[26%] flex justify-center">
      <div key={resolve.round} className={`flex animate-bannerIn flex-col items-center rounded-3xl bg-ink-950/75 px-14 py-6 ring-2 backdrop-blur-xl ${r.ring}`} role="status">
        <Icon className={`h-10 w-10 ${r.tone}`} aria-hidden="true" />
        <span className={`font-display text-8xl font-black italic leading-none ${r.tone}`}>{r.text}</span>
        <span className="mt-1 text-sm font-semibold text-chalk/70">
          {resolve.result === "GOAL" ? `${shooter.username} scores` : resolve.result === "SAVED" ? `${info.players[resolve.keeperSlot].username} saves` : `${shooter.username} does not score`}
        </span>
      </div>
    </div>
  );
}

export function TieBreak({ state }) {
  if (state.state !== "NEXT_ROUND" || !state.tieBreak) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[26%] flex justify-center">
      <div className="animate-bannerIn rounded-3xl bg-ink-950/80 px-12 py-6 text-center ring-2 ring-flare-500/60 backdrop-blur-xl" role="status">
        <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-flare-300">Level after {state.round / 2} each</p>
        <p className="font-display text-7xl font-black italic leading-none">TIE-BREAK</p>
        <p className="mt-1 text-sm text-chalk/65">Five more penalties each</p>
      </div>
    </div>
  );
}

export function OpponentStatus({ state, info, mySlot, opponent }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, []);
  const other = 1 - mySlot;
  if (state.connected[other] !== false) return null;
  const remaining = opponent && opponent.slot === other && !opponent.connected ? Math.max(0, Math.ceil((opponent.graceMs - (now - opponent.at)) / 1000)) : null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-28 flex justify-center">
      <div className="flex animate-slideDown items-center gap-3 rounded-2xl bg-siren-500/90 px-5 py-3 text-white shadow-2xl" role="alert">
        <UserX className="h-5 w-5" aria-hidden="true" />
        <div>
          <p className="font-display text-xl font-extrabold uppercase leading-none">Opponent disconnected</p>
          <p className="text-xs text-white/85">
            {info.players[other].username} has {remaining !== null ? `${remaining}s` : "a few seconds"} to reconnect or forfeits the match.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, a, b }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-t border-white/10 py-2.5 text-lg">
      <span className="text-right font-bold tabular-nums">{a}</span>
      <span className="w-24 text-center text-xs font-bold uppercase tracking-[0.2em] text-chalk/45">{label}</span>
      <span className="text-left font-bold tabular-nums">{b}</span>
    </div>
  );
}

export function FinalScreen({ finished, user, onAgain, onHome }) {
  const me = finished.players.find((p) => p.userId === user.id);
  const mySlot = me ? me.slot : 0;
  const won = finished.winnerSlot === mySlot;
  const [a, b] = finished.players;
  const forfeit = finished.reason === "FORFEIT";
  const points = finished.points[mySlot];
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-ink-950/85 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Match result">
      <div className="my-auto w-full max-w-2xl animate-bannerIn rounded-3xl bg-gradient-to-b from-white/[0.12] to-white/[0.04] p-8 text-center ring-1 ring-inset ring-white/20 sm:p-10">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${won ? "bg-flare-500 text-ink-950" : "bg-white/10 text-chalk/70"}`}>
          {won ? <Trophy className="h-9 w-9" aria-hidden="true" /> : <ShieldX className="h-9 w-9" aria-hidden="true" />}
        </div>
        <h1 className={`mt-4 font-display text-8xl font-black italic leading-none ${won ? "text-flare-400" : "text-chalk/80"}`}>{won ? "VICTORY" : "DEFEAT"}</h1>
        <p className="mt-2 text-chalk/60">
          {forfeit ? (finished.leaverSlot === mySlot ? "You left the match." : "Your opponent left the match.") : won ? "You won the shootout." : `${finished.players[finished.winnerSlot].username} won the shootout.`}
        </p>
        <div className="mt-6 flex items-center justify-center gap-5">
          <div className="flex flex-col items-center gap-2">
            <Avatar username={a.username} sex={a.sex} image={a.image} size={64} ring={finished.winnerSlot === 0} />
            <span className="max-w-[8rem] truncate font-bold">{a.username}</span>
          </div>
          <span className="font-display text-8xl font-black leading-none tabular-nums">
            {finished.scores[0]} <span className="text-chalk/30">-</span> {finished.scores[1]}
          </span>
          <div className="flex flex-col items-center gap-2">
            <Avatar username={b.username} sex={b.sex} image={b.image} size={64} ring={finished.winnerSlot === 1} />
            <span className="max-w-[8rem] truncate font-bold">{b.username}</span>
          </div>
        </div>
        <div className="mt-6">
          <StatRow label="Goals" a={finished.stats[0].goals} b={finished.stats[1].goals} />
          <StatRow label="Saves" a={finished.stats[0].saves} b={finished.stats[1].saves} />
          <StatRow label="Misses" a={finished.stats[0].misses} b={finished.stats[1].misses} />
          <StatRow label="Points" a={`+${finished.points[0]}`} b={`+${finished.points[1]}`} />
        </div>
        <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-flare-500/15 px-4 py-2 text-sm font-bold text-flare-300 ring-1 ring-inset ring-flare-500/30">
          <Trophy className="h-4 w-4" aria-hidden="true" />
          You earned +{points} leaderboard points
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button size="lg" icon={RotateCcw} onClick={onAgain}>Play again</Button>
          <Button size="lg" variant="secondary" icon={Home} onClick={onHome}>Back to home</Button>
        </div>
      </div>
    </div>
  );
}

export function AbortedScreen({ aborted, onAgain, onHome }) {
  const text = {
    OPPONENT_LEFT: "Your opponent left before the shootout got going.",
    OPPONENT_DISCONNECTED: "Your opponent lost connection before the shootout got going.",
    YOU_LEFT: "You left the match.",
    CANCELLED: "The match was cancelled.",
  }[aborted.reason] || "The match was cancelled.";
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink-950/85 p-4 backdrop-blur-md" role="dialog" aria-modal="true">
      <div className="w-full max-w-md animate-bannerIn rounded-3xl bg-white/[0.08] p-8 text-center ring-1 ring-inset ring-white/20">
        <WifiOff className="mx-auto h-10 w-10 text-siren-400" aria-hidden="true" />
        <h1 className="mt-3 font-display text-5xl font-black uppercase leading-none">Match ended</h1>
        <p className="mt-3 text-chalk/65">{text} No points were awarded.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button icon={RotateCcw} onClick={onAgain}>Find a match</Button>
          <Button variant="secondary" icon={Home} onClick={onHome}>Home</Button>
        </div>
      </div>
    </div>
  );
}

export function LeaveDialog({ onStay, onLeave, busy }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="leave-title">
      <div className="w-full max-w-sm animate-bannerIn rounded-3xl bg-ink-900 p-7 text-center ring-1 ring-inset ring-white/20">
        <h2 id="leave-title" className="font-display text-4xl font-extrabold uppercase">Leave the match?</h2>
        <p className="mt-2 text-sm text-chalk/60">If the shootout has started, leaving counts as a forfeit and your opponent wins.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" onClick={onStay} disabled={busy}>Stay</Button>
          <Button variant="danger" onClick={onLeave} loading={busy}>Leave match</Button>
        </div>
      </div>
    </div>
  );
}

export function Loader({ label }) {
  return (
    <div className="flex items-center gap-3 text-chalk/70" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}
