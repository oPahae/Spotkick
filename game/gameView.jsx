import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import GameScene from "./gameScene";
import Hud from "./hud";
import { Countdown, Prompt, ResultBanner, TieBreak, OpponentStatus, FinalScreen, AbortedScreen, LeaveDialog } from "./overlays";
import { disposeSharedGeo } from "./playerModel";
import { disposeBallTexture } from "./ball";
import { LAUNCH_S, RATE } from "./shared";
import { useAuth } from "../lib/authContext";
import { useMatch } from "../lib/matchContext";
import { audio } from "../lib/audio";

function useResolveSounds(resolve) {
  useEffect(() => {
    if (!resolve) return undefined;
    const rate = resolve.playbackRate || RATE;
    const elapsedMs = performance.now() - resolve.receivedAt;
    const ids = [];
    const at = (ms, fn) => {
      const wait = ms - elapsedMs;
      if (wait < -300) return;
      ids.push(setTimeout(fn, Math.max(0, wait)));
    };
    resolve.events.forEach((ev) => {
      const ms = LAUNCH_S * 1000 + (ev.t * 1000) / rate;
      if (ev.type === "kick") at(ms, () => audio.play("kick"));
      else if (ev.type === "bounce") at(ms, () => audio.play("bounce"));
      else if (ev.type === "post") at(ms, () => audio.play("post"));
      else if (ev.type === "bar") at(ms, () => audio.play("bar"));
      else if (ev.type === "save") at(ms, () => audio.play("save"));
      else if (ev.type === "goal") at(ms, () => audio.play("goal"));
    });
    if (resolve.result === "MISS" || resolve.result === "POST" || resolve.result === "CROSSBAR") {
      at(LAUNCH_S * 1000 + (resolve.decidedAt * 1000) / rate + 150, () => audio.play("miss"));
    }
    return () => ids.forEach(clearTimeout);
  }, [resolve]);
}

export default function GameView() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { info, state, resolve, finished, aborted, opponent, connection, actions } = useMatch();
  const [committed, setCommitted] = useState(null);
  const [muted, setMuted] = useState(audio.isMuted());
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [error, setError] = useState("");

  useResolveSounds(resolve);

  useEffect(
    () => () => {
      disposeSharedGeo();
      disposeBallTexture();
    },
    []
  );

  const round = state ? state.round : 0;
  useEffect(() => {
    setCommitted(null);
  }, [round, info && info.id]);

  const mySlot = info ? info.you : 0;
  const mode = useMemo(() => {
    if (!state || !info || committed) return null;
    if (state.state === "SHOOTING" && mySlot === state.shooterSlot && !state.locked.shooter) return "shoot";
    if ((state.state === "SHOOTING" || state.state === "GOALKEEPING") && mySlot === state.keeperSlot && !state.locked.keeper) return "dive";
    return null;
  }, [state, info, committed, mySlot]);

  const onCommit = useCallback(
    (target) => {
      if (!mode) return;
      audio.unlock();
      audio.play("click");
      const r = state.round;
      setCommitted({ round: r, x: target.x, y: target.y });
      setError("");
      const send = mode === "shoot" ? actions.shoot : actions.dive;
      send(target.x, target.y).catch((err) => {
        if (err.code === "INVALID_STATE" || err.code === "ALREADY_ACTED") return;
        setCommitted(null);
        setError(err.message);
      });
    },
    [mode, state, actions]
  );

  const reveal = useMemo(() => {
    if (!resolve || !state || resolve.round !== state.round) return null;
    if (state.state !== "ROUND_RESULT" && state.state !== "NEXT_ROUND") return null;
    return { shot: resolve.shot, dive: resolve.dive };
  }, [resolve, state]);

  const goHome = () => {
    actions.clearMatch();
    router.push("/home");
  };
  const playAgain = () => {
    actions.clearMatch();
    router.push("/lobby");
  };
  const leave = async () => {
    setLeaving(true);
    await actions.leave();
    actions.clearMatch();
    refreshUser();
    router.replace("/home");
  };

  const toggleMute = () => {
    const next = !muted;
    audio.setMuted(next);
    setMuted(next);
    if (!next) {
      audio.unlock();
      audio.play("click");
    }
  };

  const live = info && state;
  const showFinished = finished && user;

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink-950 text-chalk">
      {live ? (
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ fov: 38, near: 0.1, far: 400, position: [-46, 38, -22] }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <PerformanceMonitor />
          <AdaptiveDpr pixelated={false} />
          <GameScene
            info={info}
            state={state}
            resolve={resolve}
            mySlot={mySlot}
            mode={mode}
            locked={committed}
            onCommit={onCommit}
            reveal={reveal}
          />
        </Canvas>
      ) : null}

      {live ? (
        <div className="pointer-events-none absolute inset-0">
          <Hud info={info} state={state} mySlot={mySlot} muted={muted} onToggleMute={toggleMute} onLeave={() => (state.state === "FINISHED" || finished ? goHome() : setConfirmLeave(true))} />
          {state.state === "COUNTDOWN" ? <Countdown state={state} info={info} serverNow={actions.serverNow} /> : null}
          <Prompt state={state} info={info} mySlot={mySlot} committed={committed} serverNow={actions.serverNow} />
          <ResultBanner resolve={resolve} state={state} info={info} />
          <TieBreak state={state} />
          {state.state !== "FINISHED" ? <OpponentStatus state={state} info={info} mySlot={mySlot} opponent={opponent} /> : null}
          {error ? (
            <p role="alert" className="absolute inset-x-0 bottom-24 mx-auto w-fit rounded-xl bg-siren-500/90 px-4 py-2 text-sm font-semibold text-white">
              {error}
            </p>
          ) : null}
          {connection !== "connected" && !finished ? (
            <div className="absolute inset-x-0 top-28 mx-auto w-fit rounded-full bg-ink-950/90 px-5 py-2 text-sm font-semibold ring-1 ring-siren-500/60" role="status">
              Connection lost. Reconnecting...
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="absolute inset-0 pointer-events-none">
        <div className="pointer-events-auto">
          {confirmLeave && !showFinished ? <LeaveDialog onStay={() => setConfirmLeave(false)} onLeave={leave} busy={leaving} /> : null}
          {showFinished ? <FinalScreen finished={finished} user={user} onAgain={playAgain} onHome={goHome} /> : null}
          {aborted && !finished ? <AbortedScreen aborted={aborted} onAgain={playAgain} onHome={goHome} /> : null}
        </div>
      </div>
    </div>
  );
}
