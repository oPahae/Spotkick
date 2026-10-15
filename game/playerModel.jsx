import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";

let geoCache = null;

export function sharedGeo() {
  if (!geoCache) {
    geoCache = {
      cap: new THREE.CapsuleGeometry(0.5, 1, 4, 10),
      sphere: new THREE.SphereGeometry(1, 20, 14),
      hair: new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
    };
  }
  return geoCache;
}

export function disposeSharedGeo() {
  if (geoCache) Object.values(geoCache).forEach((g) => g.dispose());
  geoCache = null;
}

const SKINS = ["#f1c9a5", "#e0ac84", "#c68d62", "#a06a45", "#7a4a2e"];
const HAIRS = ["#17110d", "#2c1b10", "#5a3a1e", "#b98d3e", "#111111"];

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function Part({ geo, mat, position, scale, rotation, shadow = true }) {
  const g = sharedGeo();
  return <mesh geometry={g[geo]} material={mat} position={position} scale={scale} rotation={rotation} castShadow={shadow} />;
}

const PlayerModel = forwardRef(function PlayerModel({ kit, sex = "male", seed = "player" }, ref) {
  const female = sex === "female";
  const h = hash(seed);
  const skinColor = SKINS[h % SKINS.length];
  const hairColor = HAIRS[(h >>> 4) % HAIRS.length];
  const rig = useRef({});
  const refs = {
    root: useRef(),
    hips: useRef(),
    spine: useRef(),
    head: useRef(),
    shL: useRef(),
    shR: useRef(),
    elL: useRef(),
    elR: useRef(),
    hipL: useRef(),
    hipR: useRef(),
    knL: useRef(),
    knR: useRef(),
    anL: useRef(),
    anR: useRef(),
  };

  const mats = useMemo(() => {
    const std = (color, rough = 0.7) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02 });
    return {
      skin: std(skinColor, 0.65),
      hair: std(hairColor, 0.9),
      shirt: std(kit.shirt, 0.75),
      shorts: std(kit.shorts, 0.75),
      socks: std(kit.socks, 0.85),
      trim: std(kit.trim, 0.7),
      boots: std(kit.boots, 0.5),
      gloves: std(kit.gloves || skinColor, kit.gloves ? 0.6 : 0.65),
      eyes: new THREE.MeshBasicMaterial({ color: "#1a1a1a" }),
    };
  }, [kit, skinColor, hairColor]);

  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useImperativeHandle(
    ref,
    () => ({
      get rig() {
        const r = rig.current;
        Object.keys(refs).forEach((k) => {
          r[k] = refs[k].current;
        });
        return r;
      },
    }),
    []
  );

  const shoulderX = female ? 0.185 : 0.215;
  const torsoW = female ? 0.34 : 0.4;
  const hipX = female ? 0.095 : 0.09;
  const gloveSize = kit.gloves ? 1.55 : 1;

  const arm = (side) => {
    const sx = side === "L" ? -shoulderX : shoulderX;
    return (
      <group ref={refs[`sh${side}`]} position={[sx, 0.5, 0]}>
        <Part geo="cap" mat={mats.shirt} position={[0, -0.1, 0]} scale={[0.1, 0.11, 0.1]} />
        <Part geo="cap" mat={mats.skin} position={[0, -0.22, 0]} scale={[0.075, 0.07, 0.075]} />
        <group ref={refs[`el${side}`]} position={[0, -0.3, 0]}>
          <Part geo="cap" mat={mats.skin} position={[0, -0.12, 0]} scale={[0.066, 0.13, 0.066]} />
          <Part geo="sphere" mat={mats.gloves} position={[0, -0.29, 0.005]} scale={[0.05 * gloveSize, 0.065 * gloveSize, 0.032 * gloveSize]} />
        </group>
      </group>
    );
  };

  const leg = (side) => {
    const sx = side === "L" ? -hipX : hipX;
    return (
      <group ref={refs[`hip${side}`]} position={[sx, -0.03, 0]}>
        <Part geo="cap" mat={mats.skin} position={[0, -0.24, 0]} scale={[0.17, 0.17, 0.17]} />
        <Part geo="cap" mat={mats.shorts} position={[0, -0.1, 0]} scale={[0.2, 0.1, 0.2]} />
        <group ref={refs[`kn${side}`]} position={[0, -0.45, 0]}>
          <Part geo="cap" mat={mats.socks} position={[0, -0.2, 0]} scale={[0.125, 0.17, 0.125]} />
          <group ref={refs[`an${side}`]} position={[0, -0.42, 0]}>
            <Part geo="box" mat={mats.boots} position={[0, -0.01, 0.07]} scale={[0.095, 0.08, 0.27]} />
          </group>
        </group>
      </group>
    );
  };

  return (
    <group ref={refs.root}>
      <group ref={refs.hips} position={[0, 0.95, 0]}>
        <Part geo="cap" mat={mats.shorts} position={[0, 0.0, 0]} scale={[female ? 0.34 : 0.33, 0.12, 0.21]} />
        <group ref={refs.spine} position={[0, 0.06, 0]}>
          <Part geo="cap" mat={mats.shirt} position={[0, 0.27, 0]} scale={[torsoW, 0.27, 0.22]} />
          <Part geo="box" mat={mats.trim} position={[0, 0.5, 0.01]} scale={[0.14, 0.02, 0.21]} />
          <Part geo="cyl" mat={mats.skin} position={[0, 0.58, 0]} scale={[0.045, 0.1, 0.045]} />
          <group ref={refs.head} position={[0, 0.64, 0]}>
            <Part geo="sphere" mat={mats.skin} position={[0, 0.11, 0.005]} scale={[0.092, 0.115, 0.105]} />
            <Part geo="hair" mat={mats.hair} position={[0, 0.125, -0.012]} scale={[0.1, 0.115, 0.112]} rotation={[-0.25, 0, 0]} />
            {female ? <Part geo="cap" mat={mats.hair} position={[0, 0.08, -0.13]} scale={[0.06, 0.12, 0.06]} rotation={[0.45, 0, 0]} /> : null}
            <Part geo="sphere" mat={mats.eyes} position={[-0.035, 0.125, 0.094]} scale={[0.011, 0.011, 0.008]} shadow={false} />
            <Part geo="sphere" mat={mats.eyes} position={[0.035, 0.125, 0.094]} scale={[0.011, 0.011, 0.008]} shadow={false} />
          </group>
          {arm("L")}
          {arm("R")}
        </group>
        {leg("L")}
        {leg("R")}
      </group>
    </group>
  );
});

export default PlayerModel;
