// Configuration of the 6v6 single player match mode.
// World axes: x = lateral, y = up, z = along the pitch.
// Team 0 (blue, the human's team) defends the goal at z = -L/2 and attacks +z.
// Team 1 (red) defends the goal at z = +L/2 and attacks -z.

export const PITCH_L = 62;
export const PITCH_W = 40;
export const HL = PITCH_L / 2;
export const HW = PITCH_W / 2;

export const GOAL_HALF = 3.0; // post centre x
export const GOAL_H = 2.1; // crossbar centre y
export const POST_R = 0.06;
export const GOAL_DEPTH = 2.1;

export const BALL_R = 0.2;
export const GRAVITY = 9.81;
export const EYE_HEIGHT = 1.62;

export const AREA_DEPTH = 9;
export const AREA_HALF = 9;

export const DIFFICULTIES = {
  easy: { label: "Easy", opp: 0.45, team: 0.82, gk: 0.38, press: 0.5 },
  medium: { label: "Medium", opp: 0.7, team: 0.72, gk: 0.62, press: 0.75 },
  hard: { label: "Hard", opp: 0.92, team: 0.66, gk: 0.86, press: 1.0 },
};

export const POSITIONS = [
  { id: "LW", label: "Left winger" },
  { id: "RW", label: "Right winger" },
  { id: "ST", label: "Striker" },
  { id: "LB", label: "Left back" },
  { id: "RB", label: "Right back" },
];

// Formation in team-relative coordinates. u = lateral metres (negative = left when
// facing the opponent goal), v = metres from the own goal line toward the opponent.
// zoneU / zoneV are the ranges a player of this role normally works in.
export const ROLES = {
  GK: { u: 0, v: 1.2, zoneU: [-3, 3], zoneV: [0.5, 5], push: 0, pull: 0, shiftW: 0.1 },
  LB: { u: -7.5, v: 13, zoneU: [-19, 0.5], zoneV: [6, 36], push: 7, pull: -2, shiftW: 0.5 },
  RB: { u: 7.5, v: 13, zoneU: [-0.5, 19], zoneV: [6, 36], push: 7, pull: -2, shiftW: 0.5 },
  LW: { u: -13, v: 31, zoneU: [-19, -1], zoneV: [14, 58], push: 10, pull: -8, shiftW: 0.65 },
  RW: { u: 13, v: 31, zoneU: [1, 19], zoneV: [14, 58], push: 10, pull: -8, shiftW: 0.65 },
  ST: { u: 0, v: 41, zoneU: [-14, 14], zoneV: [24, 59], push: 9, pull: -10, shiftW: 0.7 },
};

export const ROLE_ORDER = ["GK", "LB", "RB", "LW", "RW", "ST"];

export const KITS = [
  { shirt: "#1f6fe0", shorts: "#0b2a5c", socks: "#1f6fe0", trim: "#f4f1ea", boots: "#101010", gloves: null },
  { shirt: "#e0283a", shorts: "#f4f1ea", socks: "#e0283a", trim: "#f4f1ea", boots: "#101010", gloves: null },
];
export const GK_KITS = [
  { shirt: "#123c8a", shorts: "#0a1a38", socks: "#123c8a", trim: "#f4f1ea", boots: "#2b2b2b", gloves: "#ffb020" },
  { shirt: "#8f1624", shorts: "#2a0a10", socks: "#8f1624", trim: "#f4f1ea", boots: "#2b2b2b", gloves: "#ffb020" },
];

export const MATCH_LENGTHS = [3, 5, 8];
