import { useEffect, useState } from "react";
import { Copy, Check, Crown, LogOut, Play, UserPlus, Users, Gauge, Timer, Link2 } from "lucide-react";
import Avatar from "./avatar";
import Button from "./button";
import { DIFFICULTIES, MATCH_LENGTHS } from "../game/soccer/config";

const SPOTS = {
  ST: { x: 50, y: 14 },
  LW: { x: 14, y: 34 },
  RW: { x: 86, y: 34 },
  LB: { x: 30, y: 62 },
  RB: { x: 70, y: 62 },
  GK: { x: 50, y: 88 },
};
const LABEL = { GK: "Goalkeeper", LB: "Left back", RB: "Right back", LW: "Left winger", RW: "Right winger", ST: "Striker" };

function Choice({ active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl px-4 py-2.5 font-display text-lg font-extrabold uppercase leading-none outline-none transition focus-visible:ring-2 focus-visible:ring-flare-400 disabled:cursor-not-allowed ${active ? "bg-flare-500 text-ink-950" : "bg-white/10 text-chalk enabled:hover:bg-white/15"} ${disabled && !active ? "opacity-50" : ""}`}
    >
      {children}
    </button>
  );
}

export default function PartyLobby({ party, me, actions, notice, sens, setSens }) {
  const [copied, setCopied] = useState("");
  const [name, setName] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const isHost = party.hostId === me.id;
  const mine = party.members.find((m) => m.userId === me.id);
  const holder = (role) => party.members.find((m) => m.role === role);
  const ready = party.members.every((m) => m.role);
  const link = typeof window !== "undefined" ? `${window.location.origin}/match?party=${party.code}` : "";

  useEffect(() => {
    if (!copied) return undefined;
    const id = setTimeout(() => setCopied(""), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch (err) {
      setCopied("");
    }
  };

  const pick = (role) => {
    if (mine && mine.role === role) actions.setRole(null).catch(() => {});
    else actions.setRole(role).catch(() => {});
  };

  const invite = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setInviteMsg("");
    try {
      const r = await actions.invite(name.trim());
      setInviteMsg(`Invitation sent to ${r.invited}.`);
      setName("");
    } catch (err) {
      setInviteMsg("");
    }
  };

  const start = async () => {
    setBusy(true);
    try {
      await actions.start();
    } catch (err) {
      /* notice is shown */
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white/[0.05] p-6 ring-1 ring-inset ring-white/10 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-chalk/50">Party code</p>
            <p className="font-display text-6xl font-black tracking-[0.2em] text-flare-400">{party.code}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={copied === "code" ? Check : Copy} onClick={() => copy("code", party.code)}>{copied === "code" ? "Copied" : "Copy code"}</Button>
            <Button variant="secondary" icon={copied === "link" ? Check : Link2} onClick={() => copy("link", link)}>{copied === "link" ? "Copied" : "Copy invite link"}</Button>
            <Button variant="ghost" icon={LogOut} onClick={() => actions.leave()}>Leave</Button>
          </div>
        </div>
        <form onSubmit={invite} className="mt-5 flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="invite-user">Username to invite</label>
          <input
            id="invite-user"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Invite an online player by username"
            maxLength={40}
            className="h-11 min-w-[16rem] flex-1 rounded-xl bg-ink-950/60 px-4 text-chalk outline-none ring-1 ring-inset ring-white/15 placeholder:text-chalk/35 focus:ring-2 focus:ring-flare-400"
          />
          <Button type="submit" icon={UserPlus} variant="secondary" disabled={party.members.length >= party.max}>Invite</Button>
          {inviteMsg ? <span className="text-sm text-turf-400">{inviteMsg}</span> : null}
        </form>
        {notice ? <p role="alert" className="mt-3 text-sm text-siren-400">{notice}</p> : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl bg-white/[0.05] p-6 ring-1 ring-inset ring-white/10 backdrop-blur-xl">
          <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-extrabold uppercase">
            <Users className="h-5 w-5 text-flare-400" aria-hidden="true" /> Team ({party.members.length}/{party.max})
          </h2>
          <ul className="space-y-2">
            {party.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 rounded-xl bg-ink-950/50 px-3 py-2 ring-1 ring-inset ring-white/5">
                <Avatar username={m.username} sex={m.sex} image={m.image} size={36} />
                <span className="min-w-0 flex-1 truncate font-semibold">{m.username}{m.userId === me.id ? " (you)" : ""}</span>
                {m.userId === party.hostId ? <Crown className="h-4 w-4 text-flare-400" aria-label="Host" /> : null}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${m.role ? "bg-[#1f6fe0] text-white" : "bg-white/10 text-chalk/50"}`}>{m.role || "No position"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-chalk/55">Empty positions are played by the computer. Everyone plays on the blue team against the red AI.</p>

          <div className="mt-6 space-y-4">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-chalk/55"><Gauge className="h-4 w-4" aria-hidden="true" /> Difficulty</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(DIFFICULTIES).map(([id, d]) => (
                  <Choice key={id} active={party.settings.difficulty === id} disabled={!isHost} onClick={() => actions.setSettings({ difficulty: id }).catch(() => {})}>{d.label}</Choice>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-chalk/55"><Timer className="h-4 w-4" aria-hidden="true" /> Length</p>
              <div className="flex flex-wrap gap-2">
                {MATCH_LENGTHS.map((m) => (
                  <Choice key={m} active={party.settings.minutes === m} disabled={!isHost} onClick={() => actions.setSettings({ minutes: m }).catch(() => {})}>{m} min</Choice>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="sens" className="mb-1 block text-xs font-bold uppercase tracking-wider text-chalk/55">Mouse sensitivity x{sens.toFixed(1)}</label>
              <input id="sens" type="range" min="0.4" max="2.5" step="0.1" value={sens} onChange={(e) => setSens(Number(e.target.value))} className="w-full accent-[#ffb020]" />
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white/[0.05] p-6 ring-1 ring-inset ring-white/10 backdrop-blur-xl">
          <h2 className="mb-4 font-display text-2xl font-extrabold uppercase">Pick your position</h2>
          <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl bg-turf-600/40 ring-1 ring-inset ring-white/15">
            <svg viewBox="0 0 100 125" className="absolute inset-0 h-full w-full text-chalk/40" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="0.6">
              <rect x="4" y="4" width="92" height="117" />
              <line x1="4" y1="62.5" x2="96" y2="62.5" />
              <circle cx="50" cy="62.5" r="9" />
              <rect x="28" y="4" width="44" height="18" />
              <rect x="28" y="103" width="44" height="18" />
            </svg>
            {Object.keys(SPOTS).map((role) => {
              const s = SPOTS[role];
              const h = holder(role);
              const isMine = h && h.userId === me.id;
              const taken = h && !isMine;
              return (
                <button
                  key={role}
                  type="button"
                  disabled={taken}
                  aria-pressed={!!isMine}
                  aria-label={`${LABEL[role]}${h ? `, ${h.username}` : ""}`}
                  onClick={() => pick(role)}
                  style={{ left: `${s.x}%`, top: `${s.y * 1.25}%` }}
                  className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl px-3 py-1.5 text-center shadow-lg outline-none transition focus-visible:ring-2 focus-visible:ring-flare-300 ${isMine ? "scale-110 bg-flare-500 text-ink-950" : taken ? "bg-ink-800/90 text-chalk/70" : "bg-[#1f6fe0] text-white hover:bg-[#3b86f0]"}`}
                >
                  <span className="font-display text-lg font-extrabold uppercase leading-none">{role}</span>
                  {h ? <span className="mt-0.5 max-w-[5.5rem] truncate text-[10px] font-bold">{h.username}</span> : <span className="mt-0.5 text-[10px] opacity-70">Free</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-sm text-chalk/60">{mine && mine.role ? `You play ${LABEL[mine.role]}. Click it again to free it.` : "Click a free position to take it."}</p>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {isHost ? (
          <Button size="xl" icon={Play} loading={busy} disabled={!ready} onClick={start} className="min-w-[16rem]">Kick off</Button>
        ) : (
          <p className="rounded-2xl bg-white/[0.06] px-5 py-3 text-chalk/70">Waiting for the host to start the match...</p>
        )}
        {isHost && !ready ? <p className="text-sm text-chalk/55">Everyone needs a position first.</p> : null}
      </div>
    </div>
  );
}
