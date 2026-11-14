import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Loader2, Play, ArrowLeft, Gauge, Timer, Crosshair, Users } from "lucide-react";
import Screen from "../components/screen";
import TopBar from "../components/topBar";
import Button from "../components/button";
import { useRequireAuth } from "../lib/authContext";
import PartyLobby from "../components/partyLobby";
import { audio } from "../lib/audio";
import { useParty } from "../lib/partyContext";
import { useMatch } from "../lib/matchContext";
import { POSITIONS, DIFFICULTIES, MATCH_LENGTHS } from "../game/soccer/config";

const SoccerView = dynamic(() => import("../game/soccer/soccerView"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-950" role="status">
      <Loader2 className="h-10 w-10 animate-spin text-flare-500" aria-hidden="true" />
      <p className="font-display text-2xl font-bold uppercase tracking-widest text-chalk/70">Loading stadium</p>
    </div>
  ),
});

// Position buttons laid out on a small pitch (attacking upward).
const SPOTS = {
  ST: { x: 50, y: 16 },
  LW: { x: 14, y: 36 },
  RW: { x: 86, y: 36 },
  LB: { x: 30, y: 66 },
  RB: { x: 70, y: 66 },
};

const DIFF_TEXT = {
  easy: "Relaxed opponents, strong teammates.",
  medium: "An even match.",
  hard: "Sharp, aggressive opponents and an alert keeper.",
};

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-3xl bg-white/[0.05] p-6 ring-1 ring-inset ring-white/10 backdrop-blur-xl">
      <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-extrabold uppercase">
        <Icon className="h-5 w-5 text-flare-400" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Choice({ active, onClick, children, sub }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl px-4 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-flare-400 ${active ? "bg-flare-500 text-ink-950" : "bg-white/10 text-chalk hover:bg-white/15"}`}
    >
      <span className="block font-display text-xl font-extrabold uppercase leading-none">{children}</span>
      {sub ? <span className={`mt-1 block text-xs ${active ? "text-ink-900/70" : "text-chalk/50"}`}>{sub}</span> : null}
    </button>
  );
}

export default function MatchPage() {
  const { user, status } = useRequireAuth();
  const [config, setConfig] = useState({ role: "ST", difficulty: "medium", minutes: 5, sens: 1 });
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);
  const [mode, setMode] = useState("solo");
  const [codeInput, setCodeInput] = useState("");
  const [joining, setJoining] = useState(false);
  const router = useRouter();
  const { party, game, notice, actions } = useParty();
  const { connection } = useMatch();
  const sens = config.sens;
  const queryCode = typeof router.query.party === "string" ? router.query.party : null;

  useEffect(() => {
    if (party) setMode("party");
  }, [party]);

  useEffect(() => {
    if (!queryCode || !user || connection !== "connected") return;
    setMode("party");
    actions.join(queryCode).catch(() => {}).finally(() => router.replace("/match", undefined, { shallow: true }));
  }, [queryCode, user && user.id, connection]);

  if (status !== "ready" || !user) return null;

  if (game && game.net && party) {
    return (
      <SoccerView
        key={game.key}
        net={game.net}
        config={{ role: game.net.human.role, difficulty: party.settings.difficulty, minutes: party.settings.minutes, sens }}
        onSendInput={actions.sendInput}
        isHost={party.hostId === user.id}
        onRematch={actions.rematch}
        onExit={actions.leave}
      />
    );
  }

  if (playing) {
    return <SoccerView key={run} config={config} onExit={() => setPlaying(false)} onRematch={() => setRun((r) => r + 1)} />;
  }

  const set = (patch) => setConfig((c) => ({ ...c, ...patch }));
  const start = () => {
    audio.unlock();
    audio.play("click");
    setPlaying(true);
  };

  return (
    <Screen>
      <TopBar />
      <main className="mx-auto max-w-5xl px-5 pb-16 sm:px-8">
        <Link href="/home" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-chalk/60 hover:text-chalk">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </Link>
        <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-turf-400">Solo or party</p>
        <h1 className="font-display text-6xl font-black uppercase italic leading-none">6 v 6 match</h1>
        <p className="mt-3 max-w-2xl text-chalk/60">
          Play one player of a six-a-side team, seen through your own eyes, alone or with up to five friends in a party. Positions nobody takes, and the whole red team, are controlled by the computer.
        </p>

        <div className="mt-6 inline-flex rounded-2xl bg-white/[0.06] p-1 ring-1 ring-inset ring-white/10" role="tablist" aria-label="Game mode">
          {[["solo", "Solo vs PC"], ["party", "Party (up to 6 players)"]].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={`rounded-xl px-5 py-2.5 font-display text-lg font-extrabold uppercase outline-none transition focus-visible:ring-2 focus-visible:ring-flare-400 ${mode === id ? "bg-flare-500 text-ink-950" : "text-chalk/70 hover:text-chalk"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "party" ? (
          <div className="mt-6">
            {party ? (
              <PartyLobby party={party} me={user} actions={actions} notice={notice} sens={sens} setSens={(v) => set({ sens: v })} />
            ) : (
              <section className="max-w-2xl rounded-3xl bg-white/[0.05] p-6 ring-1 ring-inset ring-white/10 backdrop-blur-xl">
                <h2 className="font-display text-3xl font-extrabold uppercase">Play together against the PC</h2>
                <p className="mt-2 text-chalk/60">Create a party and invite up to five friends. You all play on the blue team, each one in first person at his own position, against the red computer team. Positions nobody takes are played by the computer.</p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button size="lg" icon={Play} onClick={() => actions.create().catch(() => {})} disabled={connection !== "connected"}>Create a party</Button>
                  <span className="text-chalk/40">or</span>
                  <form
                    className="flex items-center gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!codeInput.trim()) return;
                      setJoining(true);
                      await actions.join(codeInput.trim()).catch(() => {});
                      setJoining(false);
                    }}
                  >
                    <label htmlFor="party-code" className="sr-only">Party code</label>
                    <input
                      id="party-code"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                      maxLength={6}
                      placeholder="CODE"
                      className="h-14 w-36 rounded-xl bg-ink-950/60 px-4 text-center font-display text-2xl font-extrabold uppercase tracking-[0.3em] outline-none ring-1 ring-inset ring-white/15 placeholder:text-chalk/25 focus:ring-2 focus:ring-flare-400"
                    />
                    <Button type="submit" size="lg" variant="secondary" loading={joining} disabled={connection !== "connected"}>Join</Button>
                  </form>
                </div>
                {connection !== "connected" ? <p className="mt-3 text-sm text-siren-400">Waiting for the server connection...</p> : null}
                {notice ? <p role="alert" className="mt-3 text-sm text-siren-400">{notice}</p> : null}
              </section>
            )}
          </div>
        ) : null}

        <div className={`mt-8 grid gap-6 lg:grid-cols-[1fr_1fr] ${mode === "party" ? "hidden" : ""}`}>
          <Section icon={Users} title="Your position">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl bg-turf-600/40 ring-1 ring-inset ring-white/15">
              <svg viewBox="0 0 100 125" className="absolute inset-0 h-full w-full text-chalk/40" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="0.6">
                <rect x="4" y="4" width="92" height="117" />
                <line x1="4" y1="62.5" x2="96" y2="62.5" />
                <circle cx="50" cy="62.5" r="9" />
                <rect x="28" y="4" width="44" height="18" />
                <rect x="28" y="103" width="44" height="18" />
              </svg>
              {POSITIONS.map((p) => {
                const s = SPOTS[p.id];
                const on = config.role === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ role: p.id })}
                    style={{ left: `${s.x}%`, top: `${s.y * 1.25}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-center font-display text-lg font-extrabold uppercase leading-none shadow-lg outline-none transition focus-visible:ring-2 focus-visible:ring-flare-300 ${on ? "scale-110 bg-flare-500 text-ink-950" : "bg-[#1f6fe0] text-white hover:bg-[#3b86f0]"}`}
                  >
                    {p.id}
                  </button>
                );
              })}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[#1f6fe0]/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">GK</div>
            </div>
            <p className="mt-3 text-center text-sm text-chalk/60">{POSITIONS.find((p) => p.id === config.role).label} &middot; you attack the top goal</p>
          </Section>

          <div className="space-y-6">
            <Section icon={Gauge} title="Difficulty">
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(DIFFICULTIES).map(([id, d]) => (
                  <Choice key={id} active={config.difficulty === id} onClick={() => set({ difficulty: id })}>{d.label}</Choice>
                ))}
              </div>
              <p className="mt-3 text-sm text-chalk/55">{DIFF_TEXT[config.difficulty]}</p>
            </Section>
            <Section icon={Timer} title="Match length">
              <div className="grid grid-cols-3 gap-3">
                {MATCH_LENGTHS.map((m) => (
                  <Choice key={m} active={config.minutes === m} onClick={() => set({ minutes: m })}>{m} min</Choice>
                ))}
              </div>
            </Section>
            <Section icon={Crosshair} title="Mouse sensitivity">
              <input
                type="range" min="0.4" max="2.5" step="0.1" value={config.sens}
                onChange={(e) => set({ sens: Number(e.target.value) })}
                className="w-full accent-[#ffb020]" aria-label="Mouse sensitivity"
              />
              <p className="mt-1 text-sm text-chalk/55">x{config.sens.toFixed(1)}</p>
            </Section>
          </div>
        </div>

        <div className={`mt-8 flex flex-wrap items-center gap-4 ${mode === "party" ? "hidden" : ""}`}>
          <Button size="xl" icon={Play} onClick={start} className="min-w-[16rem]">Kick off</Button>
          <p className="max-w-sm text-sm text-chalk/55">The mouse is captured while you play. Press Esc to pause.</p>
        </div>
      </main>
    </Screen>
  );
}
