import C from "../shared/constants";

export const R = C.BALL_RADIUS;
export const END_Z = C.PITCH_LENGTH / 2;
export const SPOT_Z = C.PENALTY_DISTANCE;
export const SHOOTER_START = [-0.95, 13.9];
export const SHOOTER_PLANT = [-0.22, 11.62];
export const LAUNCH_S = C.LAUNCH_DELAY_MS / 1000;
export const RATE = C.PLAYBACK_RATE;

export const KITS = {
  0: { shirt: "#d62839", shorts: "#f4f1ea", socks: "#d62839", trim: "#f4f1ea", boots: "#101010", gloves: null },
  1: { shirt: "#1f7fe0", shorts: "#0d2a52", socks: "#1f7fe0", trim: "#f4f1ea", boots: "#101010", gloves: null },
  keeper: { shirt: "#b8e22a", shorts: "#15181a", socks: "#15181a", trim: "#15181a", boots: "#2b2b2b", gloves: "#ff7a1a" },
};

export function endTransform(end) {
  return end === 0 ? { position: [0, 0, -END_Z], rotationY: 0 } : { position: [0, 0, END_Z], rotationY: Math.PI };
}

export function toWorld(end, x, y, z) {
  return end === 0 ? [x, y, z - END_Z] : [-x, y, END_Z - z];
}

export const BEHIND = { pos: [0.95, 2.35, 17.2], look: [0, 1.05, 0] };

export function elapsed(resolve) {
  return resolve ? (performance.now() - resolve.receivedAt) / 1000 : 0;
}

export function tauOf(resolve) {
  return (elapsed(resolve) - LAUNCH_S) * (resolve.playbackRate || RATE);
}

export function sampleAt(arr, stride, dt, tau, out) {
  const n = arr.length / stride;
  const f = Math.min(Math.max(tau / dt, 0), n - 1);
  const i = Math.floor(f);
  const j = Math.min(i + 1, n - 1);
  const w = f - i;
  for (let k = 0; k < stride; k += 1) out[k] = arr[i * stride + k] * (1 - w) + arr[j * stride + k] * w;
  return out;
}
