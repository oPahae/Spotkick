import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Swords, Crosshair, Hand } from "lucide-react";
import Screen from "../components/screen";
import Logo from "../components/logo";
import Button from "../components/button";
import Avatar from "../components/avatar";
import { useGuestOnly } from "../lib/authContext";
import { api } from "../lib/api";

function TopThree() {
  const [players, setPlayers] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    api("/leaderboard?limit=3", { auth: false })
      .then((d) => alive && setPlayers(d.players))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="w-full max-w-sm rounded-3xl bg-white/[0.06] p-6 ring-1 ring-inset ring-white/15 backdrop-blur-xl">
      <p className="font-display text-sm font-bold uppercase tracking-[0.25em] text-flare-400">On the board tonight</p>
      <div className="mt-4 space-y-3" aria-live="polite">
        {players === null && !failed
          ? [0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/5" />)
          : null}
        {failed ? <p className="text-sm text-chalk/50">The leaderboard is unavailable right now.</p> : null}
        {players && players.length === 0 ? <p className="text-sm text-chalk/50">Nobody has played yet. Be the first name here.</p> : null}
        {players
          ? players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-ink-950/50 p-3">
                <span className="w-6 text-center font-display text-2xl font-extrabold text-flare-400">{p.rank}</span>
                <Avatar username={p.username} sex={p.sex} image={p.image} size={40} />
                <span className="min-w-0 flex-1 truncate font-semibold">{p.username}</span>
                <span className="font-bold tabular-nums">{p.score}</span>
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

export default function Landing() {
  useGuestOnly();
  return (
    <Screen>
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between py-6">
          <Logo />
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-chalk/70 outline-none transition hover:text-chalk focus-visible:ring-2 focus-visible:ring-flare-400">
            Sign in
          </Link>
        </header>
        <main className="grid flex-1 items-center gap-12 pb-16 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-4 py-1.5 text-sm font-semibold text-flare-300 ring-1 ring-inset ring-white/10">
              <Swords className="h-4 w-4" aria-hidden="true" />
              1v1 multiplayer shootouts
            </p>
            <h1 className="font-display text-7xl font-black uppercase italic leading-[0.88] tracking-tight sm:text-8xl lg:text-9xl">
              Eleven metres.
              <br />
              <span className="text-flare-500">One keeper.</span>
              <br />
              No second
              <br />
              chances.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-chalk/65">
              Step up to the spot against a real opponent. Aim your shot, read the dive, and win the shootout in a fully 3D stadium.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register" className="contents">
                <Button size="lg" icon={ArrowRight}>Create account</Button>
              </Link>
              <Link href="/login" className="contents">
                <Button size="lg" variant="secondary">Sign in</Button>
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-chalk/55">
              <li className="flex items-center gap-2"><Crosshair className="h-4 w-4 text-flare-400" aria-hidden="true" />Click anywhere around the goal to aim</li>
              <li className="flex items-center gap-2"><Hand className="h-4 w-4 text-flare-400" aria-hidden="true" />Dive on instinct as the keeper</li>
            </ul>
          </div>
          <div className="flex justify-center lg:justify-end">
            <TopThree />
          </div>
        </main>
      </div>
    </Screen>
  );
}
