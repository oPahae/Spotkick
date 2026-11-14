import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import Goal from "../goal";
import { grassTexture, crowdTexture, adTexture, Stand, FloodTower } from "../stadium";
import { HL, HW, PITCH_L, PITCH_W, GOAL_HALF, GOAL_H, AREA_DEPTH, AREA_HALF } from "./config";

const LW = 0.11;

function quad(out, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const nx = (-dz / len) * (LW / 2);
  const nz = (dx / len) * (LW / 2);
  const y = 0.012;
  out.push(
    ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz,
    ax + nx, y, az + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz
  );
}

function circle(out, cx, cz, r, steps = 48) {
  let px = cx + r;
  let pz = cz;
  for (let i = 1; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    quad(out, px, pz, x, z);
    px = x;
    pz = z;
  }
}

function buildLines() {
  const out = [];
  quad(out, -HW, -HL, HW, -HL);
  quad(out, -HW, HL, HW, HL);
  quad(out, -HW, -HL, -HW, HL);
  quad(out, HW, -HL, HW, HL);
  quad(out, -HW, 0, HW, 0);
  circle(out, 0, 0, 4.5);
  [-1, 1].forEach((s) => {
    const z = (d) => s * (HL - d);
    quad(out, -AREA_HALF, z(AREA_DEPTH), AREA_HALF, z(AREA_DEPTH));
    quad(out, -AREA_HALF, z(0), -AREA_HALF, z(AREA_DEPTH));
    quad(out, AREA_HALF, z(0), AREA_HALF, z(AREA_DEPTH));
    quad(out, -4.5, z(3), 4.5, z(3));
    quad(out, -4.5, z(0), -4.5, z(3));
    quad(out, 4.5, z(0), 4.5, z(3));
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  return g;
}

export default function SoccerPitch() {
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
    t.repeat.set(14, 1);
    return t;
  }, []);
  const ads = useMemo(() => {
    const t = adTexture();
    t.repeat.set(4, 1);
    return t;
  }, []);
  const adsEnd = useMemo(() => {
    const t = adTexture();
    t.repeat.set(2, 1);
    return t;
  }, []);
  const lines = useMemo(buildLines, []);
  const crowdMat = useMemo(() => new THREE.MeshStandardMaterial({ map: crowd, roughness: 1, emissive: "#ffffff", emissiveMap: crowd, emissiveIntensity: 0.28 }), [crowd]);
  const lineMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#eef2ea", polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), []);
  const adMat = useMemo(() => new THREE.MeshBasicMaterial({ map: ads, toneMapped: false }), [ads]);
  const adEndMat = useMemo(() => new THREE.MeshBasicMaterial({ map: adsEnd, toneMapped: false }), [adsEnd]);
  const spotGeo = useMemo(() => new THREE.CircleGeometry(0.14, 20), []);

  useEffect(() => () => {
    [grass, crowd, ads, adsEnd, lines, crowdMat, lineMat, adMat, adEndMat, spotGeo].forEach((o) => o.dispose());
  }, [grass, crowd, ads, adsEnd, lines, crowdMat, lineMat, adMat, adEndMat, spotGeo]);

  const sx = GOAL_HALF / 3.72;
  const sy = GOAL_H / 2.5;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#10301c" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[PITCH_W + 8, PITCH_L + 8]} />
        <meshStandardMaterial map={grass} roughness={0.95} />
      </mesh>
      <mesh geometry={lines} material={lineMat} />
      <mesh geometry={spotGeo} material={lineMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.013, 0]} />
      {[-1, 1].map((s) => (
        <mesh key={`ps${s}`} geometry={spotGeo} material={lineMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.013, s * (HL - 6)]} />
      ))}

      {[-1, 1].map((s) => (
        <group key={`g${s}`} position={[0, 0, s * HL]} rotation={[0, s > 0 ? Math.PI : 0, 0]}>
          <group scale={[sx, sy, 1]}>
            <Goal />
          </group>
        </group>
      ))}

      {[-1, 1].map((s) => (
        <mesh key={`side${s}`} material={adMat} position={[s * (HW + 3.2), 0.45, 0]} rotation={[0, s * -Math.PI / 2, 0]}>
          <boxGeometry args={[PITCH_L + 12, 0.9, 0.12]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`end${s}`} material={adEndMat} position={[0, 0.45, s * (HL + 4.2)]} rotation={[0, s > 0 ? Math.PI : 0, 0]}>
          <boxGeometry args={[PITCH_W + 8, 0.9, 0.12]} />
        </mesh>
      ))}

      <Stand position={[0, 0, -(HL + 7)]} rotationY={0} width={PITCH_W + 26} material={crowdMat} />
      <Stand position={[0, 0, HL + 7]} rotationY={Math.PI} width={PITCH_W + 26} material={crowdMat} />
      <Stand position={[-(HW + 6.5), 0, 0]} rotationY={Math.PI / 2} width={PITCH_L + 22} material={crowdMat} />
      <Stand position={[HW + 6.5, 0, 0]} rotationY={-Math.PI / 2} width={PITCH_L + 22} material={crowdMat} />

      {[
        [-HW - 12, 0, -HL - 10],
        [HW + 12, 0, -HL - 10],
        [-HW - 12, 0, HL + 10],
        [HW + 12, 0, HL + 10],
      ].map((p, i) => (
        <FloodTower key={i} position={p} />
      ))}
    </group>
  );
}
