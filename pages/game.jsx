import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { Loader2 } from "lucide-react";
import { useRequireAuth } from "../lib/authContext";
import { useMatch } from "../lib/matchContext";

const GameView = dynamic(() => import("../game/gameView"), {
  ssr: false,
  loading: () => <Loading label="Loading stadium" />,
});

function Loading({ label }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-950" role="status">
      <Loader2 className="h-10 w-10 animate-spin text-flare-500" aria-hidden="true" />
      <p className="font-display text-2xl font-bold uppercase tracking-widest text-chalk/70">{label}</p>
    </div>
  );
}

export default function Game() {
  const { user, status } = useRequireAuth();
  const router = useRouter();
  const match = useMatch();
  const { info, state, finished, aborted, resumed } = match;

  useEffect(() => {
    if (!resumed) return;
    if (!info && !finished && !aborted) router.replace("/home");
    else if (info && state && state.state === "WAITING") router.replace("/lobby");
  }, [resumed, info, state, finished, aborted, router]);

  if (status !== "ready" || !user || !resumed) return <Loading label="Connecting" />;
  if (!info && !finished && !aborted) return <Loading label="Returning" />;
  return <GameView />;
}
