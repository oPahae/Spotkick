const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smooth = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
const lerp = (a, b, t) => a + (b - a) * t;

export function applyPose(rig, p) {
  const hlx = p.hlx || 0;
  const hrx = p.hrx || 0;
  const knL = p.knL || 0;
  const knR = p.knR || 0;
  rig.spine.rotation.set(p.spineX || 0, p.spineY || 0, p.spineZ || 0);
  rig.head.rotation.set(p.headX || 0, p.headY || 0, p.headZ || 0);
  rig.shL.rotation.set(p.shLx || 0, 0, -(p.shLz || 0));
  rig.shR.rotation.set(p.shRx || 0, 0, p.shRz || 0);
  rig.elL.rotation.x = -(p.elL || 0);
  rig.elR.rotation.x = -(p.elR || 0);
  rig.hipL.rotation.set(hlx, 0, -(p.hlz || 0));
  rig.hipR.rotation.set(hrx, 0, p.hrz || 0);
  rig.knL.rotation.x = knL;
  rig.knR.rotation.x = knR;
  rig.anL.rotation.x = (p.footL || 0) - hlx - knL;
  rig.anR.rotation.x = (p.footR || 0) - hrx - knR;
  rig.hips.rotation.set(p.hipsRX || 0, p.hipsRY || 0, p.hipsRZ || 0);
  const hL = 0.08 + 0.45 * Math.cos(hlx) + 0.42 * Math.cos(hlx + knL);
  const hR = 0.08 + 0.45 * Math.cos(hrx) + 0.42 * Math.cos(hrx + knR);
  rig.hips.position.y = p.hipsY !== undefined ? p.hipsY : Math.max(hL, hR) + (p.lift || 0);
}

export function poseIdle(t) {
  const b = Math.sin(t * 1.7);
  return {
    spineX: 0.03 + b * 0.015,
    headX: -0.03,
    shLz: 0.1 + b * 0.015,
    shRz: 0.1 - b * 0.015,
    elL: 0.25,
    elR: 0.25,
    hlx: -0.02,
    hrx: 0.02,
    knL: 0.05,
    knR: 0.05,
    hipsRZ: Math.sin(t * 0.9) * 0.015,
  };
}

export function poseWaitShooter(t) {
  const b = Math.sin(t * 1.4);
  return {
    spineX: 0.08,
    headX: 0.1,
    shLz: 0.35,
    shRz: 0.35,
    shLx: -0.1,
    shRx: -0.1,
    elL: 1.1,
    elR: 1.1,
    hlx: -0.1,
    hrx: 0.05,
    knL: 0.15 + b * 0.02,
    knR: 0.12,
    hipsRZ: b * 0.02,
  };
}

export function poseReady(t) {
  const s = Math.sin(t * 3.1);
  return {
    spineX: 0.28,
    headX: -0.2,
    shLz: 0.75,
    shRz: 0.75,
    shLx: -0.35,
    shRx: -0.35,
    elL: 0.9,
    elR: 0.9,
    hlx: -0.5 + s * 0.04,
    hrx: -0.5 - s * 0.04,
    knL: 0.95,
    knR: 0.95,
    hlz: 0.22,
    hrz: 0.22,
    hipsRZ: s * 0.03,
  };
}

export function poseRun(t, k = 1) {
  const phase = t * Math.PI * 2 * 2.7;
  const leg = (ph) => ({
    hip: 0.5 * Math.sin(ph) - 0.1,
    knee: 0.1 + 0.95 * Math.max(0, -Math.cos(ph)),
  });
  const l = leg(phase);
  const r = leg(phase + Math.PI);
  return {
    spineX: 0.2 * k,
    headX: -0.12,
    hlx: l.hip * k,
    knL: l.knee * k,
    hrx: r.hip * k,
    knR: r.knee * k,
    shLx: -0.8 * Math.sin(phase) * k,
    shRx: 0.8 * Math.sin(phase) * k,
    shLz: 0.1,
    shRz: 0.1,
    elL: 1.5,
    elR: 1.5,
    hipsRY: 0.08 * Math.sin(phase),
    spineY: -0.1 * Math.sin(phase),
  };
}

export function poseKick(t) {
  const runEnd = 0.78;
  const contact = 1.0;
  if (t < runEnd) return poseRun(t, 1);
  if (t < contact) {
    const u = smooth((t - runEnd) / (contact - runEnd));
    const base = poseRun(runEnd, 1 - u);
    const hip = lerp(0.9, -1.1, u * u);
    return {
      ...base,
      hrx: hip,
      knR: lerp(1.6, 0.2, u),
      footR: lerp(0.2, 0.7, u),
      hlx: lerp(base.hlx, -0.22, u),
      knL: lerp(base.knL, 0.3, u),
      spineX: lerp(0.2, -0.1, u),
      shRz: lerp(0.3, 1.0, u),
      shLz: lerp(0.3, 0.9, u),
      shRx: lerp(0.2, 0.5, u),
      shLx: lerp(-0.2, -0.4, u),
      elL: 0.6,
      elR: 0.6,
      hipsRY: lerp(0.1, 0.4, u),
    };
  }
  const u = smooth((t - contact) / 0.45);
  return {
    hrx: lerp(-1.1, -0.2, u),
    knR: lerp(0.2, 0.5, u),
    footR: lerp(0.7, 0, u),
    hlx: lerp(-0.22, -0.05, u),
    knL: lerp(0.3, 0.08, u),
    spineX: lerp(-0.1, 0.1, u),
    shRz: lerp(1.0, 0.3, u),
    shLz: lerp(0.9, 0.3, u),
    shRx: 0.4,
    shLx: -0.3,
    elL: 0.7,
    elR: 0.7,
    hipsRY: lerp(0.4, 0, u),
    lift: lerp(0.04, 0, u),
  };
}

export function poseCelebrate(t) {
  const hop = Math.abs(Math.sin(t * 7)) * 0.12;
  const w = Math.sin(t * 7);
  return {
    spineX: -0.12,
    headX: -0.25,
    shLz: 2.5,
    shRz: 2.5,
    shLx: -0.3,
    shRx: -0.3,
    elL: 0.5 + w * 0.2,
    elR: 0.5 - w * 0.2,
    hlx: -0.15,
    hrx: 0.15,
    knL: 0.3,
    knR: 0.3,
    lift: hop,
  };
}

export function poseDismay(t) {
  const u = smooth(t / 0.5);
  return {
    spineX: 0.25 * u,
    headX: 0.35 * u,
    shLz: 0.6 * u,
    shRz: 0.6 * u,
    shLx: -2.4 * u,
    shRx: -2.4 * u,
    elL: 2.2 * u,
    elR: 2.2 * u,
    hlx: -0.05,
    hrx: 0.05,
    knL: 0.1,
    knR: 0.1,
  };
}

export function poseDive(t) {
  const u = smooth(t / 0.25);
  return {
    spineX: -0.1 * u,
    headX: -0.2 * u,
    shLz: 2.85 * u,
    shRz: 2.85 * u,
    shLx: -0.2 * u,
    shRx: -0.2 * u,
    elL: 0.1,
    elR: 0.1,
    hlx: 0.12 * u,
    hrx: -0.1 * u,
    knL: 0.25 * u,
    knR: 0.35 * u,
    hlz: 0.08 * u,
    hrz: 0.08 * u,
    hipsY: 0.95,
  };
}

export function blendPose(a, b, w) {
  const out = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.forEach((k) => {
    out[k] = lerp(a[k] || 0, b[k] || 0, w);
  });
  if (a.hipsY !== undefined && b.hipsY !== undefined) out.hipsY = lerp(a.hipsY, b.hipsY, w);
  else if (b.hipsY !== undefined && w > 0.5) out.hipsY = b.hipsY;
  else delete out.hipsY;
  return out;
}
