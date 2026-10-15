import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, Loader2, PlusCircle, LogIn, Swords, X, RefreshCw } from "lucide-react";
import Screen from "../components/screen";
import TopBar from "../components/topBar";
import Avatar from "../components/avatar";
import Button from "../components/button";
import { useRequireAuth } from "../lib/authContext";
import { useMatch } from "../lib/matchContext";
import { audio } from "../lib/audio";

export default function Lobby() {
  const { user, status } = useRequireAuth();
  const router = useRouter();
  const { info, state, lobby, connection, resumed, notice, actions, aborted } = useMatch();
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user || connection !== "connected") return undefined;
    actions.subscribeLobby().catch(() => setMessage("Could not load matches. Try refreshing."));
    return () => actions.unsubscribeLobby();
  }, [user && user.id, connection]);

  useEffect(() => {
    if (info && state && state.state !== "WAITING" && state.state !== "FINISHED") router.replace("/game");
  }, [info, state, router]);

  useEffect(() => {
    if (aborted) setMessage(aborted.reason === "CANCELLED" ? "" : "The opponent left before the match began.");
  }, [aborted]);

  if (status !== "ready" || !user) return null;

  const hosting = info && state && state.state === "WAITING";

  const create = async () => {
    audio.unlock();
    setMessage("");
    setCreating(true);
    try {
      await actions.create();
    } catch (err) {
      setMessage(err.message);
    }
    setCreating(false);
  };

  const join = async (id) => {
    audio.unlock();
    setMessage("");
    setJoiningId(id);
    try {
      await actions.join(id);
    } catch (err) {
      setMessage(err.message);
      actions.subscribeLobby().catch(() => {});
    }
    setJoiningId(null);
  };

  const cancel = async () => {
    await actions.leave();
    actions.clearMatch();
  };

  const loadingList = lobby === null;
  const others = (lobby || []).filter((m) => !(hosting && info && m.id === info.id));

  return (
    <Screen>
      <TopBar />
      <main className="mx-auto max-w-5xl px-5 pb-16 sm:px-8">
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="mb-6 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-chalk/60 outline-none transition hover:text-chalk focus-visible:ring-2 focus-visible:ring-flare-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to home
        </button>

        {(message || notice) && !hosting ? (
          <p role="alert" className="mb-5 rounded-xl bg-siren-500/15 px-4 py-3 text-sm font-semibold text-siren-400 ring-1 ring-inset ring-siren-500/40">
            {message || notice}
          </p>
        ) : null}

        {!resumed ? (
          <div className="flex items-center gap-3 py-20 text-chalk/60" role="status">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> Connecting to the lobby
          </div>
        ) : hosting ? (
          <section className="relative mx-auto flex max-w-xl flex-col items-center overflow-hidden rounded-3xl bg-white/[0.06] px-8 py-14 text-center ring-1 ring-inset ring-white/15 backdrop-blur-xl" aria-live="polite">
            <div className="relative flex h-40 w-40 items-center justify-center">
              <span className="absolute inset-0 animate-pulseRing rounded-full ring-2 ring-flare-500/70" />
              <span className="absolute inset-0 animate-pulseRing rounded-full ring-2 ring-flare-500/70 [animation-delay:1.2s]" />
              <Avatar username={user.username} sex={user.sex} image={user.image} size={96} ring />
            </div>
            <p className="mt-8 font-display text-sm font-bold uppercase tracking-[0.3em] text-flare-400">Match #{info.id}</p>
            <h1 className="mt-2 font-display text-5xl font-black uppercase leading-none sm:text-6xl">Waiting for an opponent</h1>
            <p className="mt-4 max-w-sm text-chalk/55">Your match is listed in the lobby. The countdown starts the moment someone joins.</p>
            <Button variant="secondary" icon={X} onClick={cancel} className="mt-8">Cancel match</Button>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,rgba(255,176,32,0.22),rgba(8,20,15,0.6)_65%)] p-7 ring-1 ring-inset ring-flare-500/30 backdrop-blur-xl">
              <Swords className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 text-chalk/[0.06]" aria-hidden="true" />
              <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-flare-300">Host</p>
              <h1 className="mt-2 font-display text-5xl font-black uppercase italic leading-[0.95]">Start a new match</h1>
              <p className="mt-3 text-sm text-chalk/60">Create a match and wait for an opponent to pick it from the lobby.</p>
              <Button size="lg" icon={PlusCircle} loading={creating} onClick={create} className="mt-6 w-full" disabled={connection !== "connected"}>
                {creating ? "Creating" : "Create match"}
              </Button>
            </section>

            <section aria-label="Available matches" className="rounded-3xl bg-white/[0.05] p-6 ring-1 ring-inset ring-white/10 backdrop-blur-xl sm:p-8">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-display text-3xl font-extrabold uppercase">Available matches</h2>
                <button
                  type="button"
                  onClick={() => actions.subscribeLobby().catch(() => {})}
                  aria-label="Refresh list"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-chalk/60 outline-none transition hover:bg-white/10 hover:text-chalk focus-visible:ring-2 focus-visible:ring-flare-400"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {loadingList ? (
                <div className="flex items-center gap-3 py-10 text-chalk/55" role="status">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading matches
                </div>
              ) : others.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center">
                  <p className="font-display text-2xl font-bold uppercase text-chalk/70">No open matches</p>
                  <p className="mt-1 text-sm text-chalk/45">Create one and the next player in the lobby can join you.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {others.map((m) => (
                    <li key={m.id} className="flex items-center gap-4 rounded-2xl bg-ink-950/50 p-4 ring-1 ring-inset ring-white/5 transition hover:ring-flare-500/40">
                      <Avatar username={m.host.username} sex={m.host.sex} image={m.host.image} size={48} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-bold">{m.host.username}</p>
                        <p className="text-sm text-chalk/50">Score {m.host.rating} &middot; Match #{m.id}</p>
                      </div>
                      <Button size="sm" icon={LogIn} loading={joiningId === m.id} disabled={joiningId !== null || connection !== "connected"} onClick={() => join(m.id)}>
                        Join
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
    </Screen>
  );
}
