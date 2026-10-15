import Avatar from "./avatar";
import { Crown } from "lucide-react";

function PodiumSlot({ player, place, me }) {
  const heights = { 1: "h-44", 2: "h-32", 3: "h-24" };
  const tones = {
    1: "from-flare-400/40 to-flare-500/5 ring-flare-400/60",
    2: "from-white/25 to-white/5 ring-white/30",
    3: "from-orange-400/30 to-orange-500/5 ring-orange-300/40",
  };
  if (!player) {
    return <div className={`${heights[place]} flex-1 rounded-t-2xl bg-white/[0.03] ring-1 ring-inset ring-white/5`} aria-hidden="true" />;
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <div className="relative mb-2">
        {place === 1 ? <Crown className="absolute -top-7 left-1/2 h-6 w-6 -translate-x-1/2 text-flare-400" aria-hidden="true" /> : null}
        <Avatar username={player.username} sex={player.sex} image={player.image} size={place === 1 ? 76 : 60} ring={place === 1} />
      </div>
      <p className={`max-w-full truncate px-1 text-sm font-bold ${me ? "text-flare-400" : "text-chalk"}`}>{player.username}</p>
      <div className={`mt-2 flex w-full flex-col items-center justify-start rounded-t-2xl bg-gradient-to-b pt-3 ring-1 ring-inset ${tones[place]} ${heights[place]}`}>
        <span className="font-display text-5xl font-extrabold leading-none">{place}</span>
        <span className="mt-1 text-sm font-semibold tabular-nums text-chalk/80">{player.score} pts</span>
        <span className="text-xs text-chalk/50">{player.wins} wins</span>
      </div>
    </div>
  );
}

export function Podium({ players, meId }) {
  const [first, second, third] = [players[0], players[1], players[2]];
  return (
    <div className="flex items-end gap-2 sm:gap-3" role="group" aria-label="Top three players">
      <PodiumSlot player={second} place={2} me={second && second.id === meId} />
      <PodiumSlot player={first} place={1} me={first && first.id === meId} />
      <PodiumSlot player={third} place={3} me={third && third.id === meId} />
    </div>
  );
}

export function LeaderboardTable({ players, meId, startAt = 0 }) {
  const rows = players.slice(startAt);
  if (!rows.length) return null;
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-inset ring-white/10">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Leaderboard</caption>
        <thead className="bg-white/5 text-xs uppercase tracking-wider text-chalk/50">
          <tr>
            <th scope="col" className="w-14 px-4 py-3 font-semibold">Rank</th>
            <th scope="col" className="px-2 py-3 font-semibold">Player</th>
            <th scope="col" className="px-3 py-3 text-right font-semibold">Score</th>
            <th scope="col" className="px-3 py-3 text-right font-semibold">Wins</th>
            <th scope="col" className="hidden px-4 py-3 text-right font-semibold sm:table-cell">Matches</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((p) => (
            <tr key={p.id} className={p.id === meId ? "bg-flare-500/10" : "transition hover:bg-white/[0.03]"}>
              <td className="px-4 py-2.5 font-display text-xl font-bold tabular-nums text-chalk/70">{p.rank}</td>
              <td className="px-2 py-2.5">
                <div className="flex items-center gap-3">
                  <Avatar username={p.username} sex={p.sex} image={p.image} size={34} />
                  <span className={`truncate font-semibold ${p.id === meId ? "text-flare-400" : ""}`}>{p.username}</span>
                  {p.id === meId ? <span className="rounded bg-flare-500/20 px-1.5 py-0.5 text-[11px] font-bold text-flare-300">YOU</span> : null}
                </div>
              </td>
              <td className="px-3 py-2.5 text-right font-bold tabular-nums">{p.score}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-chalk/70">{p.wins}</td>
              <td className="hidden px-4 py-2.5 text-right tabular-nums text-chalk/70 sm:table-cell">{p.matchesPlayed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Loading leaderboard">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-12 animate-shimmer rounded-xl bg-[linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.1),rgba(255,255,255,0.04))] bg-[length:200%_100%]" />
      ))}
    </div>
  );
}
