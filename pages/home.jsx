import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Play, User, UserRound, Trophy, Target, ShieldX, Swords, ArrowRight } from "lucide-react";
import Screen from "../components/screen";
import TopBar from "../components/topBar";
import Avatar from "../components/avatar";
import Button from "../components/button";
import { Podium, LeaderboardTable, LeaderboardSkeleton } from "../components/leaderboardList";
import { useRequireAuth } from "../lib/authContext";
import { useMatch } from "../lib/matchContext";
import { api } from "../lib/api";
import { audio } from "../lib/audio";

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-ink-950/50 p-4 ring-1 ring-inset ring-white/5">
      <Icon className="h-4 w-4 text-flare-400" aria-hidden="true" />
      <p className="mt-2 font-display text-4xl font-extrabold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-chalk/45">{label}</p>
    </div>
  );
}

export default function Home() {
  const { user, status } = useRequireAuth();
  const router = useRouter();
  const { info, state } = useMatch();
  const [board, setBoard] = useState(null);
  const [boardError, setBoardError] = useState("");

  const load = () => {
    setBoardError("");
    setBoard(null);
    api("/leaderboard?limit=10")
      .then((d) => setBoard(d.players))
      .catch((err) => setBoardError(err.message));
  };

  useEffect(() => {
    if (user) load();
  }, [user && user.id, user && user.score]);

  if (status !== "ready" || !user) return null;
  const inMatch = info && state && state.state !== "FINISHED";

  const play = () => {
    audio.unlock();
    audio.play("click");
    router.push(inMatch && state.state !== "WAITING" ? "/game" : "/lobby");
  };

  return (
    <Screen>
      <TopBar />
      <main className="mx-auto grid max-w-7xl gap-6 px-5 pb-16 sm:px-8 lg:grid-cols-[380px_1fr]">
        <section aria-label="Your profile" className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-white/[0.1] to-white/[0.03] p-7 ring-1 ring-inset ring-white/15 backdrop-blur-xl lg:row-span-2">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-flare-500/20 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col items-center text-center">
            <Avatar username={user.username} sex={user.sex} image={user.image} size={128} ring />
            <h1 className="mt-5 font-display text-5xl font-extrabold uppercase leading-none">{user.username}</h1>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-chalk/75">
              {user.sex === "female" ? <UserRound className="h-4 w-4" aria-hidden="true" /> : <User className="h-4 w-4" aria-hidden="true" />}
              {user.sex === "female" ? "Female" : "Male"}
              {user.rank ? <span className="text-chalk/40">&middot; Rank {user.rank}</span> : null}
            </p>
            <div className="mt-6 w-full rounded-2xl bg-flare-500/10 p-5 ring-1 ring-inset ring-flare-500/30">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-flare-300">Total score</p>
              <p className="font-display text-7xl font-black leading-none tabular-nums text-flare-400">{user.score}</p>
            </div>
            <div className="mt-3 grid w-full grid-cols-3 gap-3">
              <Stat icon={Trophy} label="Wins" value={user.wins} />
              <Stat icon={ShieldX} label="Losses" value={user.losses} />
              <Stat icon={Swords} label="Played" value={user.matchesPlayed} />
            </div>
          </div>
        </section>

        <section aria-label="Play" className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,rgba(47,191,113,0.28),rgba(8,20,15,0.6)_60%)] p-8 ring-1 ring-inset ring-turf-500/30 backdrop-blur-xl sm:p-10">
          <Target className="pointer-events-none absolute -right-8 -top-8 h-56 w-56 text-chalk/[0.05]" aria-hidden="true" />
          <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-turf-400">Next shootout</p>
          <h2 className="mt-2 max-w-md font-display text-5xl font-black uppercase italic leading-[0.95] sm:text-6xl">
            Five kicks each. Win it from the spot.
          </h2>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button size="xl" icon={Play} onClick={play} className="min-w-[16rem]">
              {inMatch ? "Rejoin match" : "Play"}
            </Button>
            <p className="max-w-[16rem] text-sm text-chalk/55">Host a match or join one that is already waiting for an opponent.</p>
          </div>
        </section>

        <section aria-label="Leaderboard" className="rounded-3xl bg-white/[0.05] p-6 ring-1 ring-inset ring-white/10 backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-3xl font-extrabold uppercase">Leaderboard</h2>
            <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-flare-400 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-flare-400">
              Full table <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {boardError ? (
            <div role="alert" className="rounded-2xl bg-siren-500/10 p-5 text-sm text-siren-400 ring-1 ring-inset ring-siren-500/30">
              {boardError}{" "}
              <button type="button" onClick={load} className="font-bold underline">Retry</button>
            </div>
          ) : board === null ? (
            <LeaderboardSkeleton />
          ) : board.length === 0 ? (
            <p className="text-chalk/55">No players ranked yet.</p>
          ) : (
            <div className="space-y-6">
              <Podium players={board} meId={user.id} />
              <LeaderboardTable players={board} meId={user.id} startAt={3} />
            </div>
          )}
        </section>
      </main>
    </Screen>
  );
}
