import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import C from "../shared/constants";
import { END_Z } from "./shared";

const HW = C.PITCH_WIDTH / 2;
const LINE_W = 0.12;

function quad(out, ax, az, bx, bz, w) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const nx = (-dz / len) * (w / 2);
  const nz = (dx / len) * (w / 2);
  const y = 0.012;
  out.push(
    ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz,
    ax + nx, y, az + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz
  );
}

function arc(out, cx, cz, r, a0, a1, steps) {
  let px = cx + Math.sin(a0) * r;
  let pz = cz + Math.cos(a0) * r;
  for (let i = 1; i <= steps; i += 1) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const x = cx + Math.sin(a) * r;
    const z = cz + Math.cos(a) * r;
    quad(out, px, pz, x, z, LINE_W);
    px = x;
    pz = z;
  }
}

function endLines(sign) {
  const out = [];
  const z = (d) => sign * (END_Z - d);
  const s = sign;
  const rect = (halfW, depth) => {
    quad(out, -halfW, z(depth), halfW, z(depth), LINE_W);
    quad(out, -halfW, z(0), -halfW, z(depth), LINE_W);
    quad(out, halfW, z(0), halfW, z(depth), LINE_W);
  };
  rect(C.PENALTY_AREA_WIDTH / 2, C.PENALTY_AREA_DEPTH);
  rect(C.SIX_YARD_WIDTH / 2, C.SIX_YARD_DEPTH);
  const lim = Math.acos((C.PENALTY_AREA_DEPTH - C.PENALTY_DISTANCE) / C.PENALTY_ARC_RADIUS);
  const steps = 36;
  const cz = z(C.PENALTY_DISTANCE);
  let px = Math.sin(-lim) * C.PENALTY_ARC_RADIUS;
  let pz = cz - s * Math.cos(-lim) * C.PENALTY_ARC_RADIUS;
  for (let i = 1; i <= steps; i += 1) {
    const a = -lim + (2 * lim * i) / steps;
    const x = Math.sin(a) * C.PENALTY_ARC_RADIUS;
    const zz = cz - s * Math.cos(a) * C.PENALTY_ARC_RADIUS;
    quad(out, px, pz, x, zz, LINE_W);
    px = x;
    pz = zz;
  }
  return out;
}

function buildLines() {
  const out = [];
  quad(out, -HW, -END_Z, HW, -END_Z, LINE_W);
  quad(out, -HW, END_Z, HW, END_Z, LINE_W);
  quad(out, -HW, -END_Z, -HW, END_Z, LINE_W);
  quad(out, HW, -END_Z, HW, END_Z, LINE_W);
  quad(out, -HW, 0, HW, 0, LINE_W);
  arc(out, 0, 0, C.PENALTY_ARC_RADIUS, 0, Math.PI * 2, 56);
  out.push(...endLines(-1), ...endLines(1));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  return g;
}

function grassTexture(maxAniso) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext("2d");
  const bands = 15;
  const bh = canvas.height / bands;
  for (let i = 0; i < bands; i += 1) {
    ctx.fillStyle = i % 2 ? "#2b8a46" : "#237a3c";
    ctx.fillRect(0, i * bh, canvas.width, bh);
  }
  for (let i = 0; i < 90000; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const l = Math.random() * 6 + 2;
    ctx.strokeStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 2, y - l);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function crowdTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#14181d";
  ctx.fillRect(0, 0, 512, 128);
  const palette = ["#c0392b", "#f1c40f", "#ecf0f1", "#2980b9", "#7f8c8d", "#e67e22", "#27ae60", "#2c3e50", "#d35400"];
  for (let row = 0; row < 14; row += 1) {
    for (let col = 0; col < 96; col += 1) {
      const x = col * 5.4 + (row % 2) * 2.7;
      const y = row * 9 + 4;
      ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
      ctx.globalAlpha = 0.55 + Math.random() * 0.35;
      ctx.fillRect(x, y + 2, 3.6, 5);
      ctx.fillStyle = ["#e8c4a0", "#c08a62", "#8a5a3c"][Math.floor(Math.random() * 3)];
      ctx.beginPath();
      ctx.arc(x + 1.8, y, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function adTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const items = [
    ["SPOT KICK", "#ffb020", "#0a0a0a"],
    ["IM PAHAEEEEE", "#1f7fe0", "#ffffff"],
    ["ATTACK ON TITAN", "#d62839", "#ffffff"],
    ["TATAKAE !", "#111111", "#ffb020"],
  ];
  const w = canvas.width / items.length;
  items.forEach(([text, bg, fg], i) => {
    ctx.fillStyle = bg;
    ctx.fillRect(i * w, 0, w, 64);
    ctx.fillStyle = fg;
    ctx.font = "800 34px 'Big Shoulders Display', Impact, 'Arial Narrow', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, i * w + w / 2, 34);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function Stand({ position, rotationY = 0, width, tiers = 12, material }) {
  const items = [];
  for (let i = 0; i < tiers; i += 1) {
    items.push(
      <mesh key={i} material={material} position={[0, 0.5 + i * 0.85 + 0.42, -i * 1.1]} receiveShadow={false}>
        <boxGeometry args={[width, 0.85, 1.1]} />
      </mesh>
    );
  }
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {items}
      <mesh position={[0, 5, -tiers * 1.1 - 0.6]}>
        <boxGeometry args={[width, 14, 1]} />
        <meshStandardMaterial color="#0c1116" roughness={1} />
      </mesh>
    </group>
  );
}

function FloodTower({ position }) {
  const x = position[0];
  const z = position[2];
  const lookY = Math.atan2(-x, -z);
  return (
    <group position={[x, 0, z]} rotation={[0, lookY, 0]}>
      <mesh position={[0, 17, 0]}>
        <cylinderGeometry args={[0.35, 0.6, 34, 8]} />
        <meshStandardMaterial color="#2a3036" roughness={0.8} />
      </mesh>
      <mesh position={[0, 35, 0.4]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[7, 4, 0.5]} />
        <meshBasicMaterial color="#fff6dc" toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function Stadium() {
  const gl = useThree((s) => s.gl);
  const grass = useMemo(() => {
    let aniso = 4;
    try {
      aniso = Math.min(16, gl.capabilities.getMaxAnisotropy() || 4);
    } catch (err) {
      aniso = 4;
    }
    return grassTexture(aniso);
  }, [gl]);
  const crowd = useMemo(() => {
    const t = crowdTexture();
    t.repeat.set(16, 1);
    return t;
  }, []);
  const ads = useMemo(() => {
    const t = adTexture();
    t.repeat.set(5, 1);
    return t;
  }, []);
  const adsEnd = useMemo(() => {
    const t = adTexture();
    t.repeat.set(3, 1);
    return t;
  }, []);
  const lines = useMemo(buildLines, []);
  const crowdMat = useMemo(() => new THREE.MeshStandardMaterial({ map: crowd, roughness: 1, emissive: "#ffffff", emissiveMap: crowd, emissiveIntensity: 0.28 }), [crowd]);
  const lineMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#eef2ea", polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), []);
  const adMat = useMemo(() => new THREE.MeshBasicMaterial({ map: ads, toneMapped: false }), [ads]);
  const adEndMat = useMemo(() => new THREE.MeshBasicMaterial({ map: adsEnd, toneMapped: false }), [adsEnd]);

  useEffect(() => () => {
    [grass, crowd, ads, adsEnd, lines, crowdMat, lineMat, adMat, adEndMat].forEach((o) => o.dispose());
  }, [grass, crowd, ads, adsEnd, lines, crowdMat, lineMat, adMat, adEndMat]);

  const sideLen = C.PITCH_LENGTH + 16;
  const spotGeo = useMemo(() => new THREE.CircleGeometry(0.15, 20), []);
  useEffect(() => () => spotGeo.dispose(), [spotGeo]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#10301c" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[C.PITCH_WIDTH, C.PITCH_LENGTH]} />
        <meshStandardMaterial map={grass} roughness={0.95} />
      </mesh>
      <mesh geometry={lines} material={lineMat} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={spotGeo} material={lineMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.013, s * (END_Z - C.PENALTY_DISTANCE)]} />
      ))}

      {[-1, 1].map((s) => (
        <mesh key={`side${s}`} material={adMat} position={[s * (HW + 5), 0.45, 0]} rotation={[0, s * -Math.PI / 2, 0]}>
          <boxGeometry args={[sideLen, 0.9, 0.12]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`end${s}`} material={adEndMat} position={[0, 0.45, s * (END_Z + 6)]} rotation={[0, s > 0 ? Math.PI : 0, 0]}>
          <boxGeometry args={[C.PITCH_WIDTH + 12, 0.9, 0.12]} />
        </mesh>
      ))}

      <Stand position={[0, 0, -(END_Z + 9)]} rotationY={0} width={C.PITCH_WIDTH + 40} material={crowdMat} />
      <Stand position={[0, 0, END_Z + 9]} rotationY={Math.PI} width={C.PITCH_WIDTH + 40} material={crowdMat} />
      <Stand position={[-(HW + 9), 0, 0]} rotationY={Math.PI / 2} width={C.PITCH_LENGTH + 30} material={crowdMat} />
      <Stand position={[HW + 9, 0, 0]} rotationY={-Math.PI / 2} width={C.PITCH_LENGTH + 30} material={crowdMat} />

      {[
        [-HW - 14, 0, -END_Z - 12],
        [HW + 14, 0, -END_Z - 12],
        [-HW - 14, 0, END_Z + 12],
        [HW + 14, 0, END_Z + 12],
      ].map((p, i) => (
        <FloodTower key={i} position={p} />
      ))}
    </group>
  );
}
