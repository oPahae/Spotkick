import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BEHIND, toWorld, END_Z } from "./shared";

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export default function CameraRig({ end, push, lightEnd }) {
  const { camera } = useThree();
  const s = useMemo(
    () => ({
      init: false,
      tweenEnd: null,
      start: 0,
      dur: 2.3,
      arc: 24,
      fromPos: new THREE.Vector3(),
      fromLook: new THREE.Vector3(),
      pos: new THREE.Vector3(),
      look: new THREE.Vector3(),
      toPos: new THREE.Vector3(),
      toLook: new THREE.Vector3(),
      done: false,
    }),
    []
  );

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    const p = push ? push() : 0;
    const bp = BEHIND.pos;
    const [lx, ly, lz] = BEHIND.look;
    const tp = toWorld(end, bp[0], bp[1], bp[2] - p * 1.6);
    const tl = toWorld(end, lx, ly, lz);
    s.toPos.set(tp[0], tp[1], tp[2]);
    s.toLook.set(tl[0], tl[1], tl[2]);

    if (!s.init) {
      s.init = true;
      s.fromPos.set(-46, 38, -END_Z + 30);
      s.fromLook.set(0, 1, -END_Z + 6);
      s.pos.copy(s.fromPos);
      s.look.copy(s.fromLook);
    }
    if (s.tweenEnd !== end) {
      const first = s.tweenEnd === null;
      s.tweenEnd = end;
      s.start = now;
      s.dur = first ? 3.2 : 2.3;
      s.arc = first ? 0 : 24;
      s.fromPos.copy(s.pos);
      s.fromLook.copy(s.look);
      s.done = false;
      if (first) lightEnd.current = end;
    }
    const raw = Math.min(1, (now - s.start) / s.dur);
    const k = ease(raw);
    if (raw < 1) {
      s.pos.lerpVectors(s.fromPos, s.toPos, k);
      s.pos.y += Math.sin(Math.PI * k) * s.arc;
      s.look.lerpVectors(s.fromLook, s.toLook, k);
      if (k >= 0.5) lightEnd.current = end;
    } else {
      s.pos.copy(s.toPos);
      s.pos.x += Math.sin(now * 0.5) * 0.03;
      s.pos.y += Math.sin(now * 0.7) * 0.02;
      s.look.copy(s.toLook);
    }
    camera.position.copy(s.pos);
    camera.lookAt(s.look);
  });
  return null;
}
