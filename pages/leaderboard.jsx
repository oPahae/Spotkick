import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import Screen from "../components/screen";
import TopBar from "../components/topBar";
import Button from "../components/button";
import { Podium, LeaderboardTable, LeaderboardSkeleton } from "../components/leaderboardList";
import { useRequireAuth } from "../lib/authContext";
import { api } from "../lib/api";

export default function Leaderboard() {
  const { user, status } = useRequireAuth();
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    setPlayers(null);
    api("/leaderboard?limit=50")
      .then((d) => setPlayers(d.players))
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    if (user) load();
  }, [user && user.id]);

  if (status !== "ready" || !user) return null;

  return (
    <Screen>
      <TopBar />
      <main className="mx-auto max-w-4xl px-5 pb-16 sm:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-flare-400">Season standings</p>
            <h1 className="font-display text-6xl font-black uppercase italic leading-none">Leaderboard</h1>
          </div>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load} disabled={players === null && !error}>
            Refresh
          </Button>
        </div>
        <div className="rounded-3xl bg-white/[0.05] p-6 ring-1 ring-inset ring-white/10 backdrop-blur-xl sm:p-8">
          {error ? (
            <p role="alert" className="text-siren-400">{error}</p>
          ) : players === null ? (
            <LeaderboardSkeleton />
          ) : players.length === 0 ? (
            <p className="text-chalk/55">No players ranked yet.</p>
          ) : (
            <div className="space-y-6">
              <Podium players={players} meId={user.id} />
              <LeaderboardTable players={players} meId={user.id} startAt={3} />
            </div>
          )}
        </div>
      </main>
    </Screen>
  );
}
