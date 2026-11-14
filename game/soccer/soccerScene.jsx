import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import SoccerPitch from "./soccerPitch";
import PlayerModel from "../playerModel";
import { getBallTexture } from "../ball";
import { applyPose, poseIdle, poseReady, poseRun, poseKick, poseCelebrate, poseDismay, poseDive } from "../poses";
import { KITS, GK_KITS, BALL_R, EYE_HEIGHT } from "./config";

const TAU = Math.PI * 2;

function Triangle() {
  const mesh = useRef();
  const geo = useMemo(() => new THREE.ConeGeometry(0.2, 0.34, 3), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffe066", toneMapped: false }), []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    mesh.current.position.y = 2.2 + Math.sin(clock.elapsedTime * 3) * 0.04;
    mesh.current.rotation.y = clock.elapsedTime * 1.8;
  });
  return <mesh ref={mesh} geometry={geo} material={mat} rotation={[Math.PI, 0, 0]} position={[0, 2.2, 0]} />;
}

function Player({ match, index }) {
  const p = match.players[index];
  const root = useRef();
  const model = useRef();
  const kit = p.isGK ? GK_KITS[p.team] : KITS[p.team];
  const showTriangle = p.team === 0 && !p.human;

  useFrame(({ clock }) => {
    const g = root.current;
    const m = model.current;
    if (!g || !m || !m.rig || !m.rig.hips) return;
    const t = clock.elapsedTime;
    g.position.set(p.x, 0, p.z);
    const yaw = Math.atan2(p.fx, p.fz);
    let lean = 0;
    let lift = 0;
    let pose;
    if (p.celeb === 1) pose = poseCelebrate(t + index);
    else if (p.celeb === -1) pose = poseDismay(Math.min(1, match.phaseT));
    else if (p.diveT > 0) {
      const u = Math.min(1, (0.5 - p.diveT) / 0.2);
      pose = poseDive(0.3);
      const side = Math.sign(-p.fz * p.diveVx + p.fx * (p.diveVz || 0)) || 1;
      lean = side * 1.25 * u;
      lift = 0.35 * u;
    } else if (p.kickT >= 0) pose = poseKick(0.78 + p.kickT * 2.3);
    else if (p.tackleAnim >= 0) pose = poseKick(0.78 + p.tackleAnim * 2.0);
    else if (p.speed > 0.5) pose = poseRun(p.runPhase * 0.1356, Math.min(1.1, Math.max(0.45, p.speed / 6.5)));
    else pose = p.isGK ? poseReady(t + index) : poseIdle(t + index);
    applyPose(m.rig, pose);
    m.rig.hips.position.y += lift;
    g.rotation.set(0, yaw, lean);
  });

  return (
    <group ref={root} visible={!p.human}>
      <PlayerModel ref={model} kit={kit} sex="male" seed={`${p.team}-${p.role}`} />
      {showTriangle ? <Triangle /> : null}
      {p.name && !p.human ? (
        <Html center position={[0, 2.75, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <span className="whitespace-nowrap rounded-full bg-ink-950/75 px-2 py-0.5 text-xs font-bold text-chalk ring-1 ring-white/20">{p.name}</span>
        </Html>
      ) : null}
    </group>
  );
}

function SoccerBall({ match }) {
  const mesh = useRef();
  const tex = useMemo(() => getBallTexture(), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }), [tex]);
  const prev = useMemo(() => new THREE.Vector3(), []);
  const delta = useMemo(() => new THREE.Vector3(), []);
  const axis = useMemo(() => new THREE.Vector3(), []);
  const dq = useMemo(() => new THREE.Quaternion(), []);
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const b = match.ball;
    delta.set(b.x, b.y, b.z).sub(prev);
    const d = delta.length();
    if (d > 1e-5 && d < 3) {
      axis.crossVectors(UP, delta).normalize();
      dq.setFromAxisAngle(axis, d / BALL_R);
      m.quaternion.premultiply(dq);
    }
    m.position.set(b.x, b.y, b.z);
    prev.copy(m.position);
  });
  return (
    <mesh ref={mesh} material={mat} castShadow>
      <sphereGeometry args={[BALL_R, 24, 16]} />
    </mesh>
  );
}

function Driver({ match, onEvents }) {
  const { camera } = useThree();
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
  useEffect(() => {
    camera.rotation.order = "YXZ";
  }, [camera]);

  useFrame((state, dt) => {
    match.step(dt);
    if (match.events.length) {
      const evs = match.events.splice(0, match.events.length);
      onEvents(evs);
    }
    const h = match.human;
    if (h) {
      const bob = Math.sin(h.runPhase * 2.2) * 0.035 * Math.min(1, h.speed / 6);
      camera.position.set(h.x, EYE_HEIGHT + bob, h.z);
      camera.rotation.set(match.input.pitch, match.input.yaw, 0, "YXZ");
      if (light.current) {
        light.current.position.set(h.x + 8, 28, h.z + 14);
        light.current.target.position.set(h.x, 0, h.z);
        light.current.target.updateMatrixWorld();
      }
    }
  });
  return (
    <directionalLight
      ref={light}
      intensity={2.3}
      color="#fff4dd"
      castShadow
      shadow-mapSize={[1024, 1024]}
      shadow-camera-left={-24}
      shadow-camera-right={24}
      shadow-camera-top={24}
      shadow-camera-bottom={-24}
      shadow-camera-near={1}
      shadow-camera-far={80}
      shadow-bias={-0.0004}
    />
  );
}

export default function SoccerScene({ match, onEvents }) {
  return (
    <>
      <color attach="background" args={["#04070c"]} />
      <fog attach="fog" args={["#070b12", 60, 200]} />
      <hemisphereLight args={["#b5c8ff", "#1d4a2c", 0.85]} />
      <ambientLight intensity={0.4} />
      <Driver match={match} onEvents={onEvents} />
      <SoccerPitch />
      <SoccerBall match={match} />
      {match.players.map((p, i) => (
        <Player key={p.id} match={match} index={i} />
      ))}
    </>
  );
}
export { TAU };
