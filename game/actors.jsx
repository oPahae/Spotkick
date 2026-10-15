import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import PlayerModel from "./playerModel";
import Marker from "./marker";
import { applyPose, blendPose, poseCelebrate, poseDismay, poseDive, poseIdle, poseKick, poseReady, poseWaitShooter, smooth } from "./poses";
import { KITS, LAUNCH_S, RATE, SHOOTER_PLANT, SHOOTER_START, elapsed, sampleAt, tauOf } from "./shared";
import C from "../shared/constants";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function Shooter({ player, resolve, active, isMe }) {
  const model = useRef();
  const group = useRef();
  useFrame(({ clock }) => {
    const m = model.current;
    const g = group.current;
    if (!m || !g) return;
    const rig = m.rig;
    if (!rig.hips) return;
    const now = clock.elapsedTime;
    if (!active || !resolve) {
      g.position.set(SHOOTER_START[0], 0, SHOOTER_START[1]);
      g.rotation.y = Math.PI;
      applyPose(rig, poseWaitShooter(now));
      return;
    }
    const t = elapsed(resolve);
    const u = clamp(t / 0.78, 0, 1);
    const e = u * (2 - u);
    let z = SHOOTER_START[1] + (SHOOTER_PLANT[1] - SHOOTER_START[1]) * e;
    const x = SHOOTER_START[0] + (SHOOTER_PLANT[0] - SHOOTER_START[0]) * e;
    if (t > 0.78) z -= 0.35 * smooth((t - 0.78) / 0.7);
    g.position.set(x, 0, z);
    g.rotation.y = Math.PI;
    const reactAt = LAUNCH_S + resolve.decidedAt / RATE + 0.1;
    const base = poseKick(t);
    if (t < reactAt) {
      applyPose(rig, base);
    } else {
      const w = smooth((t - reactAt) / 0.5);
      const react = resolve.result === "GOAL" ? poseCelebrate(t - reactAt) : poseDismay(t - reactAt);
      applyPose(rig, blendPose(poseKick(1.6), react, w));
      if (resolve.result === "GOAL") g.position.z = z - 0.9 * smooth((t - reactAt) / 1.4);
    }
  });
  return (
    <group ref={group} position={[SHOOTER_START[0], 0, SHOOTER_START[1]]}>
      <PlayerModel ref={model} kit={KITS[player.slot]} sex={player.sex} seed={player.username} />
      <group position={[0, 2.3, 0]}>
        <Marker visible={isMe} />
      </group>
    </group>
  );
}

const tmp = new Float32Array(3);

export function Keeper({ player, resolve, active, isMe }) {
  const model = useRef();
  const pivot = useRef();
  const marker = useRef();
  useFrame(({ clock }) => {
    const m = model.current;
    const p = pivot.current;
    if (!m || !p) return;
    const rig = m.rig;
    if (!rig.hips) return;
    const now = clock.elapsedTime;
    let cx = Math.sin(now * 1.3) * 0.18;
    let cy = C.KEEPER_CENTER_Y - 0.07;
    let theta = 0;
    if (!active || !resolve) {
      p.position.set(cx, cy, C.KEEPER_Z);
      p.rotation.z = 0;
      applyPose(rig, poseReady(now));
    } else {
      const tau = tauOf(resolve);
      if (tau < 0) {
        p.position.set(cx, cy, C.KEEPER_Z);
        p.rotation.z = 0;
        applyPose(rig, poseReady(now));
      } else {
        sampleAt(resolve.keeper, 3, resolve.dt, tau, tmp);
        cx = tmp[0];
        cy = tmp[1] - 0.07;
        theta = tmp[2];
        p.position.set(cx, cy, C.KEEPER_Z);
        p.rotation.z = -theta;
        const real = tau / RATE;
        applyPose(rig, blendPose(poseReady(now), poseDive(real), smooth(real / 0.12)));
      }
    }
    if (marker.current) {
      marker.current.position.set(cx + Math.sin(theta) * 0.95, cy + 0.07 + Math.cos(theta) * 0.95 + 0.35, C.KEEPER_Z);
    }
  });
  return (
    <group>
      <group ref={pivot} position={[0, C.KEEPER_CENTER_Y - 0.07, C.KEEPER_Z]}>
        <group position={[0, -0.98, 0]}>
          <PlayerModel ref={model} kit={KITS.keeper} sex={player.sex} seed={player.username} />
        </group>
      </group>
      <group ref={marker}>
        <Marker visible={isMe} />
      </group>
    </group>
  );
}

const ringGeo = new THREE.RingGeometry(0.2, 0.27, 40);
const dotGeo = new THREE.CircleGeometry(0.045, 16);

export function AimLayer({ mode, locked, onCommit, reveal }) {
  const plane = useRef();
  const reticle = useRef();
  const shotMark = useRef();
  const diveMark = useRef();
  const hover = useRef({ x: 0, y: 1.2, has: false });
  const color = mode === "dive" ? "#5cc3ff" : "#ffb020";

  useEffect(() => {
    document.body.style.cursor = mode && !locked ? "crosshair" : "default";
    return () => {
      document.body.style.cursor = "default";
    };
  }, [mode, locked]);

  useFrame(({ clock }) => {
    const r = reticle.current;
    if (r) {
      if (locked) {
        r.visible = true;
        r.position.set(locked.x, locked.y, 0.08);
        r.scale.setScalar(1);
      } else if (mode && hover.current.has) {
        r.visible = true;
        r.position.set(hover.current.x, hover.current.y, 0.08);
        r.scale.setScalar(1 + Math.sin(clock.elapsedTime * 6) * 0.06);
      } else r.visible = false;
    }
    if (shotMark.current) {
      shotMark.current.visible = !!reveal;
      if (reveal) shotMark.current.position.set(reveal.shot.x, reveal.shot.y, 0.08);
    }
    if (diveMark.current) {
      diveMark.current.visible = !!reveal;
      if (reveal) diveMark.current.position.set(reveal.dive.x, reveal.dive.y, 0.08);
    }
  });

  const toLocal = (e) => {
    const parent = plane.current.parent;
    const p = parent.worldToLocal(e.point.clone());
    return { x: clamp(p.x, -C.AIM_LIMIT_X, C.AIM_LIMIT_X), y: clamp(p.y, C.AIM_MIN_Y, C.AIM_MAX_Y) };
  };

  return (
    <group>
      <mesh
        ref={plane}
        position={[0, 1.6, 0.02]}
        onPointerMove={(e) => {
          if (!mode || locked) return;
          e.stopPropagation();
          const p = toLocal(e);
          hover.current = { x: p.x, y: p.y, has: true };
        }}
        onClick={(e) => {
          if (!mode || locked) return;
          e.stopPropagation();
          onCommit(toLocal(e));
        }}
      >
        <planeGeometry args={[12, 5.4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={reticle} visible={false} renderOrder={20}>
        <mesh geometry={ringGeo}>
          <meshBasicMaterial color={locked ? "#ffffff" : color} depthTest={false} transparent opacity={0.95} toneMapped={false} />
        </mesh>
        <mesh geometry={dotGeo}>
          <meshBasicMaterial color={locked ? "#ffffff" : color} depthTest={false} toneMapped={false} />
        </mesh>
      </group>
      <group ref={shotMark} visible={false} renderOrder={19}>
        <mesh geometry={ringGeo}>
          <meshBasicMaterial color="#ffb020" depthTest={false} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      </group>
      <group ref={diveMark} visible={false} renderOrder={19}>
        <mesh geometry={ringGeo}>
          <meshBasicMaterial color="#5cc3ff" depthTest={false} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
