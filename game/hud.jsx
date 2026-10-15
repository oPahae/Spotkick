import { Check, X, Circle, Crosshair, Hand, Volume2, VolumeX, LogOut } from "lucide-react";
import Avatar from "../components/avatar";
import C from "../shared/constants";

const PER = C.PENS_PER_PHASE * 2;

function Dots({ history, slot, phase }) {
  const from = (phase - 1) * PER;
  const mine = history.filter((h) => h.shooterSlot === slot && h.round > from && h.round <= from + PER);
  const dots = [];
  for (let i = 0; i < C.PENS_PER_PHASE; i += 1) {
    const h = mine[i];
    if (!h) {
      dots.push(
        <span key={i} className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-chalk/30" aria-label="Not taken">
          <Circle className="h-2 w-2" aria-hidden="true" />
        </span>
      );
    } else if (h.result === "GOAL") {
      dots.push(
        <span key={i} className="flex h-5 w-5 items-center justify-center rounded-full bg-turf-500 text-ink-950" aria-label="Scored">
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
        </span>
      );
    } else {
      dots.push(
        <span key={i} className="flex h-5 w-5 items-center justify-center rounded-full bg-siren-500 text-white" aria-label="Missed">
          <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
        </span>
      );
    }
  }
  return <div className="flex gap-1.5">{dots}</div>;
}

function Side({ player, score, slot, state, mySlot, align }) {
  const isMe = mySlot === slot;
  const right = align === "right";
  return (
    <div className={`flex items-center gap-3 ${right ? "flex-row-reverse text-right" : ""}`}>
      <Avatar username={player.username} sex={player.sex} image={player.image} size={46} ring={isMe} />
      <div className={`min-w-0 ${right ? "items-end" : ""} flex flex-col`}>
        <div className={`flex items-center gap-2 ${right ? "flex-row-reverse" : ""}`}>
          <span className="max-w-[9rem] truncate font-bold leading-tight">{player.username}</span>
          {isMe ? <span className="rounded bg-flare-500 px-1.5 py-0.5 text-[10px] font-extrabold text-ink-950">YOU</span> : null}
        </div>
        <div className="mt-1">
          <Dots history={state.history} slot={slot} phase={state.phase} />
        </div>
      </div>
      <span className="font-display text-6xl font-black leading-none tabular-nums">{score}</span>
    </div>
  );
}

export default function Hud({ info, state, mySlot, muted, onToggleMute, onLeave }) {
  const shooter = info.players[state.shooterSlot];
  const iShoot = mySlot === state.shooterSlot;
  const showRound = state.round > 0;
  const roundLabel = showRound ? `${state.roundInPhase} / ${state.perPhase}` : `1 / ${state.perPhase}`;
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-3 pt-3">
        <div className="pointer-events-auto flex items-center gap-5 rounded-2xl bg-ink-950/70 px-5 py-3 text-chalk shadow-2xl ring-1 ring-inset ring-white/15 backdrop-blur-xl sm:gap-8">
          <Side player={info.players[0]} score={state.scores[0]} slot={0} state={state} mySlot={mySlot} align="left" />
          <div className="flex min-w-[6.5rem] flex-col items-center text-center">
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-chalk/50">Round</span>
            <span className="font-display text-3xl font-extrabold leading-none tabular-nums">{roundLabel}</span>
            {state.phase > 1 ? (
              <span className="mt-1 rounded bg-flare-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-flare-300">Tie-break {state.phase - 1}</span>
            ) : null}
          </div>
          <Side player={info.players[1]} score={state.scores[1]} slot={1} state={state} mySlot={mySlot} align="right" />
        </div>
      </div>

      <div className="pointer-events-none absolute left-3 top-24 sm:top-3">
        <button
          type="button"
          onClick={onLeave}
          className="pointer-events-auto flex h-10 items-center gap-2 rounded-xl bg-ink-950/70 px-3 text-sm font-semibold text-chalk/70 ring-1 ring-inset ring-white/15 backdrop-blur-xl outline-none transition hover:text-chalk focus-visible:ring-2 focus-visible:ring-flare-400"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
      <div className="pointer-events-none absolute right-3 top-24 sm:top-3">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Unmute sound" : "Mute sound"}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl bg-ink-950/70 text-chalk/70 ring-1 ring-inset ring-white/15 backdrop-blur-xl outline-none transition hover:text-chalk focus-visible:ring-2 focus-visible:ring-flare-400"
        >
          {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      {showRound && state.state !== "FINISHED" ? (
        <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-3 rounded-2xl bg-ink-950/70 px-4 py-3 ring-1 ring-inset ring-white/15 backdrop-blur-xl">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iShoot ? "bg-flare-500 text-ink-950" : "bg-sky-500 text-ink-950"}`}>
            {iShoot ? <Crosshair className="h-5 w-5" aria-hidden="true" /> : <Hand className="h-5 w-5" aria-hidden="true" />}
          </span>
          <div>
            <p className="font-display text-2xl font-extrabold uppercase leading-none">{iShoot ? "Shooter" : "Goalkeeper"}</p>
            <p className="mt-0.5 text-xs text-chalk/60">{iShoot ? "Your penalty" : `${shooter.username} is shooting`}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
