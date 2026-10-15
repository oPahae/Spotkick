import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { R, SPOT_Z, LAUNCH_S, tauOf, sampleAt } from "./shared";

let ballTexture = null;

function getBallTexture() {
  if (ballTexture) return ballTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f6f6f2";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#16181a";
  const spots = [
    [64, 70], [192, 70], [320, 70], [448, 70], [0, 128], [128, 128], [256, 128], [384, 128], [512, 128],
    [64, 186], [192, 186], [320, 186], [448, 186], [256, 18], [256, 238], [0, 18], [128, 238], [384, 238],
  ];
  spots.forEach(([x, y], i) => {
    const r = i < 13 ? 22 : 26;
    ctx.beginPath();
    for (let k = 0; k < 5; k += 1) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * r * 1.35;
      const py = y + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  });
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 64, 0);
    ctx.lineTo(i * 64 + 32, 256);
    ctx.stroke();
  }
  ballTexture = new THREE.CanvasTexture(canvas);
  ballTexture.colorSpace = THREE.SRGBColorSpace;
  ballTexture.anisotropy = 4;
  return ballTexture;
}

export function disposeBallTexture() {
  if (ballTexture) ballTexture.dispose();
  ballTexture = null;
}

const tmp = new Float32Array(3);
const delta = new THREE.Vector3();
const axis = new THREE.Vector3();
const dq = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

export default function Ball({ resolve, active }) {
  const mesh = useRef();
  const lastTau = useRef(-1);
  const prev = useRef(new THREE.Vector3(0, R, SPOT_Z));
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: getBallTexture(), roughness: 0.45, metalness: 0.0 }), []);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    if (!active || !resolve) {
      m.position.set(0, R, SPOT_Z);
      m.quaternion.identity();
      lastTau.current = -1;
      prev.current.set(0, R, SPOT_Z);
      return;
    }
    const tau = tauOf(resolve);
    if (tau < 0) {
      m.position.set(0, R, SPOT_Z);
      prev.current.copy(m.position);
      return;
    }
    sampleAt(resolve.ball, 3, resolve.dt, tau, tmp);
    delta.set(tmp[0], tmp[1], tmp[2]).sub(prev.current);
    const dist = delta.length();
    if (dist > 1e-5) {
      axis.crossVectors(UP, delta).normalize();
      dq.setFromAxisAngle(axis, dist / R);
      m.quaternion.premultiply(dq);
    }
    m.position.set(tmp[0], tmp[1], tmp[2]);
    prev.current.copy(m.position);
    lastTau.current = tau;
  });

  return (
    <mesh ref={mesh} material={material} castShadow position={[0, R, SPOT_Z]}>
      <sphereGeometry args={[R, 24, 16]} />
    </mesh>
  );
}

export { LAUNCH_S };
