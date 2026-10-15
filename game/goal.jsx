import { useEffect, useMemo } from "react";
import * as THREE from "three";
import C from "../shared/constants";

const PR = C.POST_RADIUS;
const HALF = C.GOAL_WIDTH / 2 + PR;
const BAR_Y = C.GOAL_HEIGHT + PR;
const DB = C.NET_DEPTH_BOTTOM;
const DT = C.NET_DEPTH_TOP;

function gridLines(a, b, c, d, nu, nv, out) {
  const p = (u, v) => {
    const top = new THREE.Vector3().lerpVectors(a, b, u);
    const bottom = new THREE.Vector3().lerpVectors(d, c, u);
    return new THREE.Vector3().lerpVectors(top, bottom, v);
  };
  for (let i = 0; i <= nu; i += 1) {
    const u = i / nu;
    const s = p(u, 0);
    const e = p(u, 1);
    out.push(s.x, s.y, s.z, e.x, e.y, e.z);
  }
  for (let j = 0; j <= nv; j += 1) {
    const v = j / nv;
    const s = p(0, v);
    const e = p(1, v);
    out.push(s.x, s.y, s.z, e.x, e.y, e.z);
  }
}

function buildNet() {
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const FTL = v(-HALF, BAR_Y, 0);
  const FTR = v(HALF, BAR_Y, 0);
  const FBL = v(-HALF, 0, 0);
  const FBR = v(HALF, 0, 0);
  const BTL = v(-HALF, BAR_Y, -DT);
  const BTR = v(HALF, BAR_Y, -DT);
  const BBL = v(-HALF, 0, -DB);
  const BBR = v(HALF, 0, -DB);
  const out = [];
  gridLines(BTL, BTR, BBR, BBL, 72, 26, out);
  gridLines(FTL, BTL, BBL, FBL, 14, 26, out);
  gridLines(BTR, FTR, FBR, BBR, 14, 26, out);
  gridLines(FTL, FTR, BTR, BTL, 72, 12, out);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  return g;
}

export default function Goal() {
  const netGeo = useMemo(buildNet, []);
  const netMat = useMemo(() => new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.38 }), []);
  const frameMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f5f5f2", roughness: 0.35, metalness: 0.15 }), []);
  const supportMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9ccd0", roughness: 0.5, metalness: 0.3 }), []);
  useEffect(() => () => {
    netGeo.dispose();
    netMat.dispose();
    frameMat.dispose();
    supportMat.dispose();
  }, [netGeo, netMat, frameMat, supportMat]);

  const barLen = HALF * 2 + PR * 2;
  const slope = Math.hypot(BAR_Y, DB - DT);
  return (
    <group>
      <mesh material={frameMat} position={[-HALF, BAR_Y / 2, 0]} castShadow>
        <cylinderGeometry args={[PR, PR, BAR_Y + PR, 16]} />
      </mesh>
      <mesh material={frameMat} position={[HALF, BAR_Y / 2, 0]} castShadow>
        <cylinderGeometry args={[PR, PR, BAR_Y + PR, 16]} />
      </mesh>
      <mesh material={frameMat} position={[0, BAR_Y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[PR, PR, barLen, 16]} />
      </mesh>
      {[-HALF, HALF].map((x) => (
        <group key={x}>
          <mesh material={supportMat} position={[x, BAR_Y, -DT / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, DT, 8]} />
          </mesh>
          <mesh
            material={supportMat}
            position={[x, BAR_Y / 2, -(DB + DT) / 2]}
            rotation={[Math.atan2(DB - DT, BAR_Y), 0, 0]}
          >
            <cylinderGeometry args={[0.02, 0.02, slope, 8]} />
          </mesh>
          <mesh material={supportMat} position={[x, 0.02, -DB / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, DB, 8]} />
          </mesh>
        </group>
      ))}
      <lineSegments geometry={netGeo} material={netMat} />
    </group>
  );
}
