import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import Stadium from "./stadium";
import Goal from "./goal";
import Ball from "./ball";
import CameraRig from "./cameraRig";
import { Shooter, Keeper, AimLayer } from "./actors";
import { endTransform, toWorld, elapsed, LAUNCH_S } from "./shared";

function KeyLight({ lightEnd }) {
  const light = useRef();
  const { scene } = useThree();
  useEffect(() => {
    const l = light.current;
    if (l) {
      scene.add(l.target);
      return () => scene.remove(l.target);
    }
    return undefined;
  }, [scene]);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const e = lightEnd.current;
    const p = toWorld(e, 7, 26, 20);
    const t = toWorld(e, 0, 0, 7);
    l.position.set(p[0], p[1], p[2]);
    l.target.position.set(t[0], t[1], t[2]);
    l.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light}
      intensity={2.1}
      color="#fff4dd"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-15}
      shadow-camera-right={15}
      shadow-camera-top={15}
      shadow-camera-bottom={-15}
      shadow-camera-near={1}
      shadow-camera-far={70}
      shadow-bias={-0.0004}
    />
  );
}

function EndGroup({ end, players, state, resolve, mySlot, mode, locked, onCommit, reveal, camEnd }) {
  const t = endTransform(end);
  const active = !!(resolve && state && resolve.round === state.round && resolve.shooterSlot === end);
  const shooter = players[end];
  const keeper = players[1 - end];
  return (
    <group position={t.position} rotation={[0, t.rotationY, 0]}>
      <Goal />
      <Ball resolve={resolve} active={active} />
      {shooter ? <Shooter player={shooter} resolve={resolve} active={active} isMe={mySlot === shooter.slot} /> : null}
      {keeper ? <Keeper player={keeper} resolve={resolve} active={active} isMe={mySlot === keeper.slot} /> : null}
      {camEnd === end ? <AimLayer mode={mode} locked={locked} onCommit={onCommit} reveal={reveal} /> : null}
    </group>
  );
}

export default function GameScene({ info, state, resolve, mySlot, mode, locked, onCommit, reveal }) {
  const lightEnd = useRef(0);
  const camEnd = state.state === "NEXT_ROUND" ? state.nextShooterSlot : state.shooterSlot;
  const players = [info.players[0], info.players[1]];
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;
  const stateRef = useRef(state);
  stateRef.current = state;

  const push = () => {
    const r = resolveRef.current;
    const s = stateRef.current;
    if (!r || !s || r.round !== s.round || r.shooterSlot !== camEnd) return 0;
    const t = elapsed(r) - LAUNCH_S;
    return Math.min(1, Math.max(0, t / 2.5));
  };

  return (
    <>
      <color attach="background" args={["#04070c"]} />
      <fog attach="fog" args={["#070b12", 80, 230]} />
      <hemisphereLight args={["#9db8ff", "#12301d", 0.55]} />
      <ambientLight intensity={0.25} />
      <KeyLight lightEnd={lightEnd} />
      <Stadium />
      {[0, 1].map((end) => (
        <EndGroup
          key={end}
          end={end}
          players={players}
          state={state}
          resolve={resolve}
          mySlot={mySlot}
          mode={mode}
          locked={locked}
          onCommit={onCommit}
          reveal={reveal}
          camEnd={camEnd}
        />
      ))}
      <CameraRig end={camEnd} push={push} lightEnd={lightEnd} />
    </>
  );
}
