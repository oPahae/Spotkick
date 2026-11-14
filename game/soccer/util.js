import { HL, HW, PITCH_L } from "./config";

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Team 0 attacks +z, team 1 attacks -z.
export const dirOf = (team) => (team === 0 ? 1 : -1);
export const goalZ = (team) => dirOf(team) * HL; // the goal this team attacks
export const ownZ = (team) => -dirOf(team) * HL; // the goal this team defends
export const adv = (team, z) => dirOf(team) * z + HL; // 0 at own goal line .. PITCH_L at the opponent line

// team-relative (u = lateral to the right of the attack direction, v = depth) -> world
export function toWorld(team, u, v) {
  const d = dirOf(team);
  return { x: -d * u, z: -d * HL + d * v };
}
export const lateralOf = (team, x) => -dirOf(team) * x;

export function clampPitch(x, z, m = 0.3) {
  return [clamp(x, -HW + m, HW - m), clamp(z, -HL + m, HL - m)];
}

export function segInfo(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 1e-9 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t;
  const cz = az + dz * t;
  return { d: Math.hypot(px - cx, pz - cz), t, x: cx, z: cz };
}

export const ROLL_K = 0.55; // exponential decay of a rolling ball
export const ROLL_C = 0.45; // constant deceleration m/s^2
export const BOUNCE = 0.58;

export function lenZone() {
  return PITCH_L;
}
