var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// game/soccer/serverEntry.js
var serverEntry_exports = {};
__export(serverEntry_exports, {
  Match: () => Match
});
module.exports = __toCommonJS(serverEntry_exports);

// game/soccer/config.js
var PITCH_L = 62;
var PITCH_W = 40;
var HL = PITCH_L / 2;
var HW = PITCH_W / 2;
var GOAL_HALF = 3;
var GOAL_H = 2.1;
var POST_R = 0.06;
var GOAL_DEPTH = 2.1;
var BALL_R = 0.2;
var GRAVITY = 9.81;
var EYE_HEIGHT = 1.62;
var AREA_DEPTH = 9;
var AREA_HALF = 9;
var DIFFICULTIES = {
  easy: { label: "Easy", opp: 0.45, team: 0.82, gk: 0.38, press: 0.5 },
  medium: { label: "Medium", opp: 0.7, team: 0.72, gk: 0.62, press: 0.75 },
  hard: { label: "Hard", opp: 0.92, team: 0.66, gk: 0.86, press: 1 }
};
var ROLES = {
  GK: { u: 0, v: 1.2, zoneU: [-3, 3], zoneV: [0.5, 5], push: 0, pull: 0, shiftW: 0.1 },
  LB: { u: -7.5, v: 13, zoneU: [-19, 0.5], zoneV: [6, 36], push: 7, pull: -2, shiftW: 0.5 },
  RB: { u: 7.5, v: 13, zoneU: [-0.5, 19], zoneV: [6, 36], push: 7, pull: -2, shiftW: 0.5 },
  LW: { u: -13, v: 31, zoneU: [-19, -1], zoneV: [14, 58], push: 10, pull: -8, shiftW: 0.65 },
  RW: { u: 13, v: 31, zoneU: [1, 19], zoneV: [14, 58], push: 10, pull: -8, shiftW: 0.65 },
  ST: { u: 0, v: 41, zoneU: [-14, 14], zoneV: [24, 59], push: 9, pull: -10, shiftW: 0.7 }
};
var ROLE_ORDER = ["GK", "LB", "RB", "LW", "RW", "ST"];

// game/soccer/util.js
var clamp = (v, a, b) => v < a ? a : v > b ? b : v;
var dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var dirOf = (team) => team === 0 ? 1 : -1;
var goalZ = (team) => dirOf(team) * HL;
var ownZ = (team) => -dirOf(team) * HL;
var adv = (team, z) => dirOf(team) * z + HL;
function toWorld(team, u, v) {
  const d = dirOf(team);
  return { x: -d * u, z: -d * HL + d * v };
}
var lateralOf = (team, x) => -dirOf(team) * x;
function segInfo(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 1e-9 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t;
  const cz = az + dz * t;
  return { d: Math.hypot(px - cx, pz - cz), t, x: cx, z: cz };
}
var ROLL_K = 0.55;
var ROLL_C = 0.45;
var BOUNCE = 0.58;

// game/soccer/ai.js
function solveShot(from, tgt, speed) {
  const dx = tgt.x - from.x;
  const dz = tgt.z - from.z;
  const D = Math.hypot(dx, dz) || 0.01;
  const ux = dx / D;
  const uz = dz / D;
  if (tgt.y <= 0.3) return { vx: ux * speed, vz: uz * speed, vy: 0 };
  const T = D / speed;
  const vy = clamp((tgt.y - from.y) / T + 0.5 * GRAVITY * T, -6, 13);
  return { vx: ux * speed, vz: uz * speed, vy };
}
function solveLob(from, lx, lz) {
  const d = Math.hypot(lx - from.x, lz - from.z);
  const T = clamp(d / 17, 0.9, 2.3);
  return { vx: (lx - from.x) / T, vz: (lz - from.z) / T, vy: (BALL_R - from.y) / T + 0.5 * GRAVITY * T };
}
function groundSpeed(d) {
  return clamp(8 + ROLL_K * 1.1 * d, 11, 26);
}
function predict(m) {
  const b = m.ball;
  const P = m.ctx.path;
  let { x, y, z, vx, vy, vz } = b;
  P.x[0] = x;
  P.y[0] = y;
  P.z[0] = z;
  const h = 0.05;
  for (let i = 1; i <= 40; i += 1) {
    for (let s = 0; s < 2; s += 1) {
      vy -= GRAVITY * h;
      x += vx * h;
      y += vy * h;
      z += vz * h;
      if (y < BALL_R) {
        y = BALL_R;
        if (vy < -0.6) {
          vy = -vy * BOUNCE;
          vx *= 0.94;
          vz *= 0.94;
        } else vy = 0;
      }
      if (y <= BALL_R + 1e-3 && vy === 0) {
        const sp = Math.hypot(vx, vz);
        if (sp > 0) {
          const ns = Math.max(0, sp * Math.exp(-ROLL_K * h) - ROLL_C * h);
          vx *= ns / sp;
          vz *= ns / sp;
        }
      }
    }
    P.x[i] = x;
    P.y[i] = y;
    P.z[i] = z;
  }
}
function intercept(m, p) {
  const P = m.ctx.path;
  const sp = p.maxRun * 0.95;
  const maxY = p.isGK ? 2 : 1.05;
  for (let i = 1; i <= 40; i += 1) {
    if (P.y[i] > maxY) continue;
    const t = i * 0.1;
    const d = dist(p.x, p.z, P.x[i], P.z[i]);
    if (d - 0.6 <= sp * Math.max(0, t - p.react * 0.5)) return { t, x: P.x[i], z: P.z[i] };
  }
  return { t: Infinity, x: P.x[40], z: P.z[40] };
}
var opp = (m, team) => m.teamPlayers(1 - team);
var field = (m, team) => m.teamPlayers(team).filter((q) => !q.isGK);
function go(p, x, z, f) {
  p.tx = x;
  p.tz = z;
  p.tf = f;
}
function look(p, x, z) {
  p.lookX = x;
  p.lookZ = z;
}
function xgAt(team, x, z) {
  const gz = goalZ(team);
  const dgz = Math.abs(gz - z);
  if (dgz > 30) return 0;
  const dd = Math.max(0.6, dgz);
  const a = Math.abs(Math.atan2(GOAL_HALF - x, dd) - Math.atan2(-GOAL_HALF - x, dd));
  return clamp(Math.pow(a / 0.85, 1.5) * 0.45, 0, 0.7);
}
function laneMargin(m, ax, az, bx, bz, vAvg, oppTeam) {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(2, Math.ceil(len / 3));
  let worst = 9;
  const os = m.teamPlayers(oppTeam);
  for (let i = 1; i <= n; i += 1) {
    const f = i / n * 0.96;
    const qx = ax + (bx - ax) * f;
    const qz = az + (bz - az) * f;
    const tb = len * f / vAvg;
    for (let k = 0; k < os.length; k += 1) {
      const o = os[k];
      const d = dist(o.x, o.z, qx, qz);
      const to = Math.max(0, d - 0.65) / (o.maxRun * 0.92) + o.react * 0.4;
      const mg = to - tb;
      if (mg < worst) worst = mg;
    }
  }
  return worst;
}
function nearestOppDist(m, team, x, z) {
  let best = 99;
  opp(m, team).forEach((o) => {
    const d = dist(o.x, o.z, x, z);
    if (d < best) best = d;
  });
  return best;
}
function pressure(m, p) {
  let best = 99;
  opp(m, p.team).forEach((o) => {
    if (o.isGK) return;
    let d = dist(o.x, o.z, p.x, p.z);
    const toO = [(o.x - p.x) / (d || 1), (o.z - p.z) / (d || 1)];
    const front = p.fx * toO[0] + p.fz * toO[1];
    if (front < -0.2) d += 1.2;
    if (d < best) best = d;
  });
  return clamp(1 - (best - 0.9) / 3.6, 0, 1);
}
function evalPass(m, c, q) {
  const dx = q.x - c.x;
  const dz = q.z - c.z;
  const d0 = Math.hypot(dx, dz);
  if (d0 < 2.8) return null;
  const lob = d0 > 24;
  let lx;
  let lz;
  let v0 = 0;
  let T = 0;
  if (!lob) {
    v0 = groundSpeed(d0);
    const tf = d0 / (0.5 * (v0 + 8));
    lx = q.x + q.vx * tf * 0.85;
    lz = q.z + q.vz * tf * 0.85;
  } else {
    T = clamp(d0 / 17, 0.9, 2.2);
    lx = q.x + q.vx * T * 0.8;
    lz = q.z + q.vz * T * 0.8;
  }
  lx = clamp(lx, -HW + 0.6, HW - 0.6);
  lz = clamp(lz, -HL + 0.6, HL - 0.6);
  const d = dist(c.x, c.z, lx, lz);
  if (d < 2.5) return null;
  let safety;
  if (!lob) {
    const mg = laneMargin(m, c.x, c.z, lx, lz, 0.5 * (v0 + 8), 1 - c.team);
    safety = clamp(0.4 + mg * 1.3, 0, 1);
  } else {
    const tr = dist(q.x, q.z, lx, lz) / q.maxRun;
    let to = 9;
    opp(m, c.team).forEach((o) => {
      to = Math.min(to, Math.max(0, dist(o.x, o.z, lx, lz) - 0.9) / (o.maxRun * 0.92));
    });
    safety = clamp(0.45 + (to - tr) * 0.9, 0.05, 0.95) * 0.9;
  }
  const free = clamp((nearestOppDist(m, c.team, lx, lz) - 1.2) / 5, 0, 1);
  const prog = clamp((adv(c.team, lz) - adv(c.team, c.z)) / 20, -0.5, 1);
  const zone = Math.pow(adv(c.team, lz) / PITCH_L, 2);
  const shotV = xgAt(c.team, lx, lz) * 0.8;
  let base = 0.16 + 0.42 * Math.max(prog, 0) + 0.18 * zone + 0.25 * free + shotV - (prog < 0 ? 0.16 * -prog : 0);
  if (d < 5) base -= 0.1;
  if (lob) base *= 0.92;
  let score = safety * base;
  return { q, lob, lx, lz, v0, T, safety, score, d };
}
function evalShot(m, p) {
  const gz = goalZ(p.team);
  const dgz = Math.abs(gz - p.z);
  if (dgz > 27) return { score: 0 };
  const g = m.gk(1 - p.team);
  const xg = xgAt(p.team, p.x, p.z);
  let bestT = null;
  [-1, 1].forEach((sx) => {
    [0.45, 1.55].forEach((ty) => {
      const tx = sx * (GOAL_HALF - 0.65);
      let val = Math.abs(tx - g.x) + (ty > 1 ? 0.2 : 0);
      let block = 1;
      opp(m, p.team).forEach((o) => {
        if (o.isGK) return;
        const si = segInfo(o.x, o.z, p.x, p.z, tx, gz);
        if (si.t > 0.08 && si.t < 0.95 && si.d < 0.75) block *= 0.35;
      });
      if (!bestT || val * block > bestT.val) bestT = { tx, ty, val: val * block, block };
    });
  });
  const open = clamp(0.75 + (Math.abs(bestT.tx - g.x) - 2.5) * 0.12, 0.4, 1.1);
  const pr = pressure(m, p);
  return { score: xg * 3 * bestT.block * open * (1 - 0.35 * pr), tx: bestT.tx, ty: bestT.ty, dgz };
}
function doShot(m, p, shot) {
  const b = m.ball;
  const sk = p.skill;
  const speed = clamp(19 + shot.dgz * 0.3, 20, 28);
  let tx = shot.tx;
  let ty = shot.ty;
  const gz = goalZ(p.team);
  const sig = 0.01 + (1 - sk) * 0.07 + pressure(m, p) * 0.03;
  const ang = m.gauss() * sig;
  const dx = tx - b.x;
  const dz = gz - b.z;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const ndx = dx * c - dz * s;
  const ndz = dx * s + dz * c;
  tx = b.x + ndx;
  const tz = b.z + ndz;
  ty = Math.max(0.1, ty + m.gauss() * sig * shot.dgz * 0.6);
  m.kickBall(p, solveShot(b, { x: tx, y: ty, z: tz }, speed), "shot");
}
function doPass(m, p, o) {
  const b = m.ball;
  const sig = 8e-3 + (1 - p.skill) * 0.05 + (o.lob ? 0.012 : 0);
  let v;
  if (o.lob) {
    const ang = m.gauss() * sig;
    const dx = o.lx - b.x;
    const dz = o.lz - b.z;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    v = solveLob(b, b.x + dx * c - dz * s, b.z + dx * s + dz * c);
  } else {
    const dx = o.lx - b.x;
    const dz = o.lz - b.z;
    const d = Math.hypot(dx, dz) || 1;
    const ang = m.gauss() * sig;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const sp = o.v0 * (1 + m.gauss() * 0.03);
    v = { vx: (dx / d * c - dz / d * s) * sp, vz: (dx / d * s + dz / d * c) * sp, vy: 0 };
  }
  m.kickBall(p, v, "pass", o.q);
}
function doClear(m, p) {
  const b = m.ball;
  const side = p.x > 0 ? -1 : 1;
  const tz2 = toWorld(p.team, 0, 36).z;
  const lx = clamp(side * 11 + m.gauss() * 3, -HW + 1, HW - 1);
  const v = solveLob(b, lx, tz2);
  m.kickBall(p, v, "pass", null);
}
function dribbleDir(m, p) {
  const t = p.team;
  const gz = goalZ(t);
  let tx = p.x * (p.role === "LW" || p.role === "RW" ? 0.92 : 0.6);
  if (Math.abs(gz - p.z) < 16) tx = p.x * 0.35;
  let gx = tx - p.x;
  let gzv = gz - p.z;
  let l = Math.hypot(gx, gzv) || 1;
  gx /= l;
  gzv /= l;
  let rx = 0;
  let rz = 0;
  opp(m, t).forEach((o) => {
    const d = dist(o.x, o.z, p.x, p.z);
    if (d > 7 || d < 0.01) return;
    const nx = (p.x - o.x) / d;
    const nz = (p.z - o.z) / d;
    const front = (o.x - p.x) * gx + (o.z - p.z) * gzv;
    const w = Math.pow(1 - d / 7, 2) * (front > 0 ? 1 : 0.3);
    rx += nx * w;
    rz += nz * w;
  });
  let dx = gx + rx * 1.7;
  let dz = gzv + rz * 1.7;
  if (p.x > HW - 3) dx -= 0.8;
  if (p.x < -HW + 3) dx += 0.8;
  l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, z: dz / l };
}
function spaceAhead(m, p, dir) {
  let best = 12;
  opp(m, p.team).forEach((o) => {
    const rx = o.x - p.x;
    const rz = o.z - p.z;
    const d = Math.hypot(rx, rz);
    if (d > 12 || d < 0.01) return;
    const cosA = (rx * dir.x + rz * dir.z) / d;
    if (cosA > 0.62 && d < best) best = d;
  });
  return best;
}
function aiCarrier(m, p, h) {
  const t = m.t;
  p.holdTime += h;
  const dir = dribbleDir(m, p);
  const set = m.restartCarry;
  if (set) {
    go(p, p.x, p.z, 0);
    look(p, p.x + dir.x * 5, p.z + dir.z * 5);
  } else {
    go(p, p.x + dir.x * 8, p.z + dir.z * 8, 0.95);
    p.lookX = null;
  }
  const delay = p.react * 1.1 + (set ? 0.8 : 0);
  if (p.holdTime < delay || t < p.thinkAt) return;
  p.thinkAt = t + 0.12;
  const pr = pressure(m, p);
  const noise = (1.3 - p.skill) * 0.09;
  const shot = evalShot(m, p);
  let best = { type: "dribble", score: -1 };
  if (!set) {
    const space = spaceAhead(m, p, dir);
    let ds = 0.2 + 0.4 * clamp(space / 10, 0, 1) - 0.45 * pr - Math.max(0, p.holdTime - 2.5) * 0.08;
    if (adv(p.team, p.z) > PITCH_L - 4) ds -= 0.3;
    best = { type: "dribble", score: ds };
  }
  if (shot.score > 0.01 && shot.score + (p.noise - 0.5) * noise > best.score - 0.02) {
    best = { type: "shot", score: shot.score, shot };
  }
  const bonusOwnHalf = adv(p.team, p.z) < 16;
  let anyPass = null;
  m.teamPlayers(p.team).forEach((q) => {
    if (q === p) return;
    if (q.isGK && !(pr > 0.55 && bonusOwnHalf)) return;
    const o = evalPass(m, p, q);
    if (!o) return;
    o.score += 0.28 * pr * o.safety;
    if (q.human && q.callT > 0 && o.safety > 0.35) o.score += 0.22;
    if (q.isGK) o.score -= 0.1;
    o.score += (m.rng() - 0.5) * noise;
    if (!anyPass || o.score > anyPass.score) anyPass = o;
    if (o.score > best.score) best = { type: "pass", score: o.score, o };
  });
  if (set && best.type === "dribble") {
    best = anyPass ? { type: "pass", score: anyPass.score, o: anyPass } : { type: "clear", score: 0 };
  }
  if (best.type !== "shot" && pr > 0.55 && bonusOwnHalf && best.score < 0.22) best = { type: "clear", score: 0 };
  if (best.type === "dribble" && p.holdTime > 6 && anyPass) best = { type: "pass", score: anyPass.score, o: anyPass };
  if (best.type === "shot") doShot(m, p, best.shot);
  else if (best.type === "pass") doPass(m, p, best.o);
  else if (best.type === "clear") doClear(m, p);
  else if (pr > 0.5 && m.rng() < 0.01) look(p, p.x, p.z);
}
function gkDistribute(m, p) {
  let best = null;
  m.teamPlayers(p.team).forEach((q) => {
    if (q === p) return;
    const o = evalPass(m, p, q);
    if (!o) return;
    if (!best || o.score > best.score) best = o;
  });
  if (best && best.safety > 0.3) doPass(m, p, best);
  else doClear(m, p);
}
function aiGK(m, p, h) {
  const t = p.team;
  const dir = dirOf(t);
  const gz = ownZ(t);
  const b = m.ball;
  if (m.phase === "goal" || m.phase === "kickoff") {
    go(p, p.x, p.z, 0);
    return;
  }
  if (b.owner === p) {
    go(p, p.x, p.z, 0);
    look(p, p.x, p.z + dir * 10);
    p.holdT -= h;
    if (p.holdT <= 0 || m.restartCarry && p.holdT < 0.2) gkDistribute(m, p);
    return;
  }
  if (m.phase === "restart" && m.restart.taker === p) {
    go(p, b.x - dir * 0.3, b.z, 0.8);
    return;
  }
  const P = m.ctx.path;
  let threat = null;
  if (!b.owner && b.vz * dir < -2.5) {
    for (let i = 1; i <= 40; i += 1) {
      if ((P.z[i] - gz) * dir <= 0) {
        if (Math.abs(P.x[i]) < GOAL_HALF + 1.4 && P.y[i] < GOAL_H + 0.5) threat = { t: i * 0.1, x: P.x[i] };
        break;
      }
    }
  }
  if (threat && b.shot && b.shot.team !== t && p.gkSeen !== b.shot.id) {
    p.gkSeen = b.shot.id;
    p.gkReactAt = m.t + clamp(0.3 - 0.22 * p.skill + m.rng() * 0.1, 0.05, 0.4);
    p.diveDone = false;
  }
  if (threat && m.t >= p.gkReactAt) {
    const tx = clamp(threat.x, -(GOAL_HALF + 0.3), GOAL_HALF + 0.3);
    go(p, tx, gz + dir * 0.55, 1);
    look(p, b.x, b.z);
    if (threat.t < 0.55 && Math.abs(tx - p.x) > 1 && p.diveT <= 0 && !p.diveDone) {
      p.diveDone = true;
      p.diveT = 0.5;
      p.diveVx = clamp((tx - p.x) / Math.max(0.2, threat.t), -9.5, 9.5);
      p.diveDir = Math.sign(p.diveVx);
    }
    return;
  }
  if (!b.owner && m.phase === "live") {
    const inArea = adv(t, b.z) < AREA_DEPTH + 4 && Math.abs(b.x) < AREA_HALF + 3;
    if (inArea && Math.hypot(b.vx, b.vz) < 14) {
      const mine = intercept(m, p);
      let theirs = Infinity;
      opp(m, t).forEach((o) => {
        if (!o.isGK) theirs = Math.min(theirs, intercept(m, o).t);
      });
      if (mine.t < theirs - 0.2 && mine.t < 3) {
        go(p, mine.x, mine.z, 1);
        look(p, b.x, b.z);
        return;
      }
    }
  }
  const car = m.ctx.carrier;
  const dc = dist(car.x, car.z, 0, gz);
  let dGK = dc < 16 ? clamp(dc * 0.26, 1.1, 4) : clamp(1 + dc * 0.03, 1, 2.6);
  if (adv(t, car.z) > 38 && car.owner && car.owner.team === t) dGK += 3;
  const ux = (car.x - 0) / (dc || 1);
  const uz = (car.z - gz) / (dc || 1);
  let px = ux * dGK;
  px = clamp(px, -(GOAL_HALF + 0.4), GOAL_HALF + 0.4);
  go(p, px, gz + uz * dGK, 0.85);
  look(p, b.x, b.z);
}
function formTarget(m, p, mode) {
  const r = ROLES[p.role];
  const b = m.ctx.carrier;
  const bAdv = adv(p.team, b.z);
  const shift = clamp((bAdv - 31) * r.shiftW, -7, 14);
  let v = r.v + shift + (mode === "att" ? r.push : r.pull);
  if (mode === "def") v = Math.max(v, 4);
  v = clamp(v, r.zoneV[0], r.zoneV[1]);
  let u = r.u * (mode === "att" ? 1.05 : 0.85) + lateralOf(p.team, b.x) * 0.28;
  u = clamp(u, r.zoneU[0], r.zoneU[1]);
  return toWorld(p.team, u, v);
}
function supportBest(m, p, car) {
  const r = ROLES[p.role];
  const home = formTarget(m, p, "att");
  const cands = [home];
  if (p.supSet) cands.push({ x: p.supX, z: p.supZ });
  for (let i = 0; i < 8; i += 1) {
    const a = i / 8 * Math.PI * 2 + m.rng() * 0.5;
    const rad = 3 + m.rng() * 6;
    cands.push({ x: home.x + Math.cos(a) * rad, z: home.z + Math.sin(a) * rad });
  }
  const mates = m.teamPlayers(p.team);
  let best = null;
  cands.forEach((c) => {
    let cx = c.x;
    let cz = c.z;
    const u = lateralOf(p.team, cx);
    const v = adv(p.team, cz);
    const uc = clamp(u, r.zoneU[0], r.zoneU[1]);
    const vc = clamp(v, r.zoneV[0], r.zoneV[1]);
    const w = toWorld(p.team, uc, vc);
    cx = clamp(w.x, -HW + 1, HW - 1);
    cz = clamp(w.z, -HL + 1, HL - 1);
    const dc = dist(cx, cz, car.x, car.z);
    const mg = laneMargin(m, car.x, car.z, cx, cz, 13, 1 - p.team);
    const lane = clamp(0.4 + mg * 1.3, 0, 1);
    const space = clamp(nearestOppDist(m, p.team, cx, cz) / 6, 0, 1);
    const prog = clamp((adv(p.team, cz) - adv(p.team, car.z)) / 20, -0.3, 1);
    let sc = 0.9 * lane + 0.7 * space + 0.6 * prog + 0.5 * xgAt(p.team, cx, cz) - 0.04 * dist(cx, cz, home.x, home.z);
    let crowd = 0;
    mates.forEach((q) => {
      if (q !== p && !q.isGK && dist(q.x, q.z, cx, cz) < 4.5) crowd += 1;
    });
    sc -= 0.5 * crowd;
    if (dc < 5) sc -= 0.4;
    if (dc > 26) sc -= 0.3 * ((dc - 26) / 10);
    if (p.role === "LW" || p.role === "RW") sc += 0.15 * (Math.abs(cx) / HW);
    if (!best || sc > best.sc) best = { sc, x: cx, z: cz };
  });
  return best;
}
function aiSupport(m, p) {
  const car = m.ctx.carrier;
  if (m.t >= p.supAt || !p.supSet) {
    const r = supportBest(m, p, car);
    p.supX = r.x;
    p.supZ = r.z;
    p.supSet = true;
    p.supAt = m.t + 0.45 + m.rng() * 0.35;
  }
  const d = dist(p.x, p.z, p.supX, p.supZ);
  go(p, p.supX, p.supZ, d > 7 ? 1 : 0.85);
  look(p, car.x, car.z);
}
function aiDefend(m, p, h) {
  const t = p.team;
  const c = m.ctx;
  const car = c.carrier;
  const owner = car.owner;
  const press = m.diff.press * (t === 0 ? 0.9 : 1);
  const myGoalX = 0;
  const myGoalZ = ownZ(t);
  if (owner && c.press[t][0] === p) {
    const d = dist(p.x, p.z, owner.x, owner.z);
    const gxv = myGoalX - owner.x;
    const gzv = myGoalZ - owner.z;
    const gl = Math.hypot(gxv, gzv) || 1;
    const gx = gxv / gl;
    const gz = gzv / gl;
    const radius = 14 + 20 * press;
    if (d > radius && adv(t, owner.z) > 30) {
      const f2 = formTarget(m, p, "def");
      go(p, f2.x, f2.z, 0.8);
    } else if (d > 3.8) {
      go(p, owner.x + owner.vx * 0.3 + gx * 1, owner.z + owner.vz * 0.3 + gz * 1, 0.82 + 0.18 * press);
    } else {
      go(p, owner.x + gx * 1.35, owner.z + gz * 1.35, 0.75);
    }
    look(p, owner.x, owner.z);
    if (d < 1.2 && p.tackleCd <= 0 && m.phase === "live") {
      p.tackleCd = 0.55 + 0.4 / p.aggr;
      p.tackleAnim = 0;
      m.resolveTackle(p, owner, 0.5 * press * (0.6 + 0.6 * p.skill) * p.aggr);
    }
    return;
  }
  if (owner && c.press[t][1] === p) {
    const gxv = myGoalX - owner.x;
    const gzv = myGoalZ - owner.z;
    const gl = Math.hypot(gxv, gzv) || 1;
    const px = owner.x + gxv / gl * 5.5;
    const pz = owner.z + gzv / gl * 5.5;
    go(p, px * 0.8, pz, 0.85);
    look(p, owner.x, owner.z);
    return;
  }
  const mk = p.markId !== void 0 && p.markId !== null ? m.players[p.markId] : null;
  if (mk) {
    const gxv = myGoalX - mk.x;
    const gzv = myGoalZ - mk.z;
    const gl = Math.hypot(gxv, gzv) || 1;
    const danger = adv(1 - t, mk.z);
    const dx = car.x - mk.x;
    const dz = car.z - mk.z;
    const dl = Math.hypot(dx, dz) || 1;
    const wGoal = danger > PITCH_L * 0.55 ? 0.75 : 0.35;
    let px = mk.x + gxv / gl * 2 * wGoal + dx / dl * 2.4 * (1 - wGoal);
    let pz = mk.z + gzv / gl * 2 * wGoal + dz / dl * 2.4 * (1 - wGoal);
    if (m.phase === "restart" && m.restart.team !== t) {
      const bd = dist(px, pz, m.ball.x, m.ball.z);
      if (bd < 5.5) {
        px += (px - m.ball.x) / (bd || 1) * (5.5 - bd);
        pz += (pz - m.ball.z) / (bd || 1) * (5.5 - bd);
      }
    }
    const [cx, cz] = [clamp(px, -HW + 0.8, HW - 0.8), clamp(pz, -HL + 0.8, HL - 0.8)];
    go(p, cx, cz, 0.9);
    look(p, car.x, car.z);
    return;
  }
  const f = formTarget(m, p, "def");
  go(p, f.x, f.z, 0.8);
  look(p, car.x, car.z);
}
function assignMarks(m, t) {
  const c = m.ctx;
  const defenders = field(m, t).filter((q) => !q.human && c.press[t][0] !== q && c.press[t][1] !== q);
  defenders.forEach((q) => {
    q.markId = null;
  });
  const attackers = field(m, 1 - t).filter((o) => o !== c.carrier.owner).sort((a, b2) => adv(1 - t, b2.z) - adv(1 - t, a.z));
  const used = /* @__PURE__ */ new Set();
  attackers.forEach((a) => {
    let best = null;
    defenders.forEach((q) => {
      if (used.has(q.id)) return;
      const d = dist(q.x, q.z, a.x, a.z) + (q.markId === a.id ? -2 : 0);
      if (!best || d < best.d) best = { q, d };
    });
    if (best) {
      used.add(best.q.id);
      best.q.markId = a.id;
    }
  });
}
function aiChase(m, p) {
  const b = m.ball;
  const I = intercept(m, p);
  if (Number.isFinite(I.t)) go(p, I.x, I.z, 1);
  else go(p, m.ctx.path.x[12], m.ctx.path.z[12], 1);
  if (Math.hypot(b.vx, b.vz) < 1.5) go(p, b.x, b.z, 1);
  look(p, b.x, b.z);
}
function buildContext(m) {
  const c = m.ctx;
  const b = m.ball;
  const o = b.owner;
  c.carrier = o ? { x: o.x, z: o.z, vx: o.vx, vz: o.vz, owner: o } : { x: b.x, z: b.z, vx: b.vx, vz: b.vz, owner: null };
  if (!o) predict(m);
  else {
    const P = c.path;
    for (let i = 0; i <= 40; i += 1) {
      P.x[i] = b.x;
      P.y[i] = BALL_R;
      P.z[i] = b.z;
    }
  }
  let attTeam;
  if (m.phase === "restart") attTeam = m.restart.team;
  else if (m.phase === "kickoff") attTeam = m.kickoffTeam;
  else attTeam = o ? o.team : b.lastTeam;
  c.mode = [attTeam === 0 ? "att" : "def", attTeam === 1 ? "att" : "def"];
  c.chaser = [null, null];
  c.press = [[], []];
  for (let t = 0; t < 2; t += 1) {
    const fp = field(m, t);
    if (o) {
      if (o.team !== t) c.press[t] = fp.slice().sort((a, b2) => dist(a.x, a.z, o.x, o.z) - dist(b2.x, b2.z, o.x, o.z));
    } else if (m.phase === "restart") {
      if (m.restart.team === t) c.chaser[t] = m.restart.taker;
    } else if (m.phase === "live") {
      let best = null;
      fp.forEach((q) => {
        let ti = intercept(m, q).t;
        if (b.passTarget === q) ti -= 0.4;
        if (!best || ti < best.t) best = { q, t: ti };
      });
      if (best && Number.isFinite(best.t + 99)) c.chaser[t] = best.q;
    }
  }
  for (let t = 0; t < 2; t += 1) if (o && o.team !== t) assignMarks(m, t);
}
function updateAI(m, h) {
  buildContext(m);
  const c = m.ctx;
  const b = m.ball;
  m.players.forEach((p) => {
    if (p.human) return;
    p.lookX = null;
    if (m.phase === "goal" || m.phase === "ended") {
      go(p, p.x, p.z, 0);
      return;
    }
    if (m.phase === "kickoff") {
      if (p === m.kickoffTaker) look(p, p.x, p.z + dirOf(p.team) * 5);
      go(p, p.x, p.z, 0);
      return;
    }
    if (p.isGK) {
      aiGK(m, p, h);
      return;
    }
    if (b.owner === p) {
      aiCarrier(m, p, h);
      return;
    }
    const mode = c.mode[p.team];
    if (m.phase === "restart") {
      if (m.restart.taker === p) {
        go(p, b.x - dirOf(p.team) * 0.35, b.z, 0.9);
        look(p, b.x, b.z);
        return;
      }
      if (mode === "att") aiSupport(m, p);
      else aiDefendSet(m, p);
      return;
    }
    if (c.chaser[p.team] === p && !b.owner) {
      aiChase(m, p);
      return;
    }
    if (mode === "att") {
      if (b.owner && b.owner.team === p.team) aiSupport(m, p);
      else if (!b.owner) aiSupport(m, p);
      else aiDefend(m, p, h);
    } else {
      aiDefend(m, p, h);
    }
  });
}
function aiDefendSet(m, p) {
  const f = formTarget(m, p, "def");
  let { x, z } = f;
  const b = m.ball;
  const d = dist(x, z, b.x, b.z);
  if (d < 6) {
    x += (x - b.x) / (d || 1) * (6 - d);
    z += (z - b.z) / (d || 1) * (6 - d);
  }
  go(p, clamp(x, -HW + 0.8, HW - 0.8), clamp(z, -HL + 0.8, HL - 0.8), 0.85);
  look(p, b.x, b.z);
}

// game/soccer/engine.js
var FIXED = 1 / 60;
var Match = class {
  constructor({ role = "ST", humanRoles, difficulty = "medium", minutes = 5, seed, humanControlled = true } = {}) {
    this.humanRoles = humanRoles || [role];
    this.opts = { role, difficulty, minutes };
    this.diff = DIFFICULTIES[difficulty] || DIFFICULTIES.medium;
    this.rng = mulberry32(seed === void 0 ? Math.random() * 1e9 | 0 : seed);
    this.humanControlled = humanControlled;
    this.t = 0;
    this.clock = 0;
    this.total = minutes * 60;
    this.score = [0, 0];
    this.stats = [0, 1].map(() => ({ shots: 0, onTarget: 0, passes: 0, passOk: 0, possession: 0, tackles: 0, saves: 0 }));
    this.events = [];
    this.players = [];
    this.ball = { x: 0, y: BALL_R, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTeam: 0, lastPlayer: null, passTarget: null, passTimer: 0, shot: null, passer: null, kind: null };
    this.phase = "kickoff";
    this.phaseT = 0;
    this.restart = null;
    this.inNet = false;
    this.ended = false;
    this.ctx = { path: { x: new Float32Array(41), y: new Float32Array(41), z: new Float32Array(41) }, teams: [{}, {}] };
    this.lastGoal = null;
    this.paused = false;
    this.createPlayers();
    this.setupKickoff(0);
  }
  gauss() {
    return (this.rng() + this.rng() + this.rng() + this.rng() - 2) * 1.2;
  }
  emit(type, data) {
    this.events.push({ type, ...data });
  }
  createPlayers() {
    let id = 0;
    for (let team = 0; team < 2; team += 1) {
      const base = team === 0 ? this.diff.team : this.diff.opp;
      ROLE_ORDER.forEach((role) => {
        const gk = role === "GK";
        const skill = clamp(gk ? this.diff.gk + (team === 0 ? 0.1 : 0) : base + (this.rng() - 0.5) * 0.14, 0.2, 0.98);
        const human = this.humanControlled && team === 0 && this.humanRoles.includes(role);
        this.players.push({
          id: id++,
          team,
          role,
          isGK: gk,
          human,
          skill,
          x: 0,
          z: 0,
          vx: 0,
          vz: 0,
          fx: 0,
          fz: dirOf(team),
          maxRun: (gk ? 5 : 5.5) + 1.5 * skill,
          react: 0.34 - 0.22 * skill,
          accel: 12 + 5 * skill,
          stamina: 100,
          exhausted: false,
          sprinting: false,
          tx: 0,
          tz: 0,
          tf: 0,
          lookX: null,
          lookZ: null,
          kickT: -1,
          kickLock: 0,
          tackleCd: 0,
          stun: 0,
          diveT: 0,
          diveDir: 0,
          diveVx: 0,
          holdT: 0,
          holdTime: 0,
          thinkAt: 0,
          supAt: 0,
          supX: 0,
          supZ: 0,
          supSet: false,
          gkReactAt: 0,
          gkSeen: -1,
          charge: 0,
          callT: 0,
          aggr: 0.75 + this.rng() * 0.5,
          noise: this.rng(),
          runPhase: this.rng() * 6,
          speed: 0,
          celeb: 0,
          tackleAnim: -1,
          decision: null,
          diveVz: 0,
          canKickFlag: false,
          input: { mx: 0, mz: 0, yaw: team === 0 ? Math.PI : 0, pitch: 0, sprint: false, fireDown: false, fireUp: false, pass: false, lob: false, tackle: false, call: false }
        });
      });
    }
    this.humans = this.players.filter((p) => p.human);
    this.human = this.humans[0] || null;
    this.input = this.human ? this.human.input : { mx: 0, mz: 0, yaw: Math.PI, pitch: 0, sprint: false, fireDown: false, fireUp: false, pass: false, lob: false, tackle: false, call: false };
  }
  gk(team) {
    return this.players[team * 6];
  }
  teamPlayers(team) {
    return this.players.slice(team * 6, team * 6 + 6);
  }
  // ---------- phases ----------
  setupKickoff(team) {
    this.phase = "kickoff";
    this.phaseT = 0;
    this.restart = null;
    this.inNet = false;
    this.kickoffTeam = team;
    const b = this.ball;
    b.owner = null;
    b.x = 0;
    b.y = BALL_R;
    b.z = 0;
    b.vx = 0;
    b.vy = 0;
    b.vz = 0;
    b.passTarget = null;
    b.shot = null;
    b.passer = null;
    b.lastTeam = team;
    this.players.forEach((p) => {
      const r = ROLES[p.role];
      const own = p.team === team ? HL - 2.2 : HL - 5.5;
      const w = toWorld(p.team, r.u * 0.9, Math.min(r.v, own));
      p.x = w.x;
      p.z = w.z;
      p.vx = 0;
      p.vz = 0;
      p.fx = 0;
      p.fz = dirOf(p.team);
      p.stun = 0;
      p.diveT = 0;
      p.kickT = -1;
      p.charge = 0;
      p.holdTime = 0;
      p.celeb = 0;
      p.supSet = false;
      p.tx = p.x;
      p.tz = p.z;
      p.tf = 0;
    });
    const taker = this.players[team * 6 + ROLE_ORDER.indexOf("ST")];
    taker.x = -dirOf(team) * 0;
    taker.z = -dirOf(team) * 0.9;
    taker.fz = dirOf(team);
    taker.fx = 0;
    this.kickoffTaker = taker;
    this.humans.forEach((hp) => {
      hp.input.yaw = hp.team === 0 ? Math.PI : 0;
      hp.input.pitch = 0;
    });
    this.emit("banner", { text: "KICK OFF" });
  }
  startLive() {
    this.phase = "live";
    this.restartCarry = true;
    const taker = this.kickoffTaker;
    this.giveBall(taker);
    taker.holdTime = 0;
    this.emit("whistle", {});
    this.emit("banner", { text: "GO!" });
  }
  giveBall(p) {
    const b = this.ball;
    b.owner = p;
    b.lastTeam = p.team;
    b.lastPlayer = p;
    b.passTarget = null;
    b.vx = p.vx;
    b.vz = p.vz;
    b.vy = 0;
    p.holdTime = 0;
    p.decision = null;
  }
  onGoal(team) {
    this.phase = "goal";
    this.phaseT = 0;
    this.inNet = true;
    this.score[team] += 1;
    if (this.ball.shot && this.ball.shot.team === team) this.stats[team].onTarget += 1;
    this.lastGoal = { team, scorer: this.ball.lastPlayer };
    this.players.forEach((p) => {
      p.celeb = p.team === team ? 1 : -1;
    });
    this.emit("goal", { team });
    this.emit("banner", { text: "GOAL!", team });
  }
  setRestart(kind, team, x, z) {
    this.phase = "restart";
    this.phaseT = 0;
    this.restartCarry = true;
    const b = this.ball;
    b.owner = null;
    b.x = x;
    b.z = z;
    b.y = BALL_R;
    b.vx = 0;
    b.vy = 0;
    b.vz = 0;
    b.passTarget = null;
    b.shot = null;
    this.restart = { kind, team, x, z, taker: null };
    const cand = this.teamPlayers(team).filter((p) => !p.isGK || kind === "goalkick");
    let best = null;
    cand.forEach((p) => {
      let d = dist(p.x, p.z, x, z);
      if (kind === "goalkick") d = p.isGK ? 0 : 999;
      if (!best || d < best.d) best = { p, d };
    });
    this.restart.taker = best.p;
    this.emit("whistle", {});
    this.emit("banner", { text: { throwin: "THROW-IN", corner: "CORNER", goalkick: "GOAL KICK" }[kind] });
  }
  // ---------- main step ----------
  step(dt) {
    if (this.paused || this.ended) return;
    this.acc = (this.acc || 0) + Math.min(dt, 0.1);
    while (this.acc >= FIXED) {
      this.acc -= FIXED;
      this.fixed(FIXED);
    }
  }
  fixed(h) {
    this.t += h;
    this.phaseT += h;
    const ph = this.phase;
    if (ph === "kickoff") {
      if (this.phaseT >= 3) this.startLive();
    } else if (ph === "goal") {
      if (this.phaseT >= 3.6) this.setupKickoff(1 - this.lastGoal.team);
    } else if (ph === "live" || ph === "restart") {
      if (ph === "live") {
        this.clock += h;
        const o = this.ball.owner;
        if (o) this.stats[o.team].possession += h;
        if (this.clock >= this.total) {
          this.ended = true;
          this.phase = "ended";
          this.emit("whistle", {});
          this.emit("ended", {});
          return;
        }
      }
      if (ph === "restart") {
        if (this.ball.owner || Math.hypot(this.ball.vx, this.ball.vz) > 1) this.phase = "live";
        else if (this.phaseT > 5 && this.restart.taker.human) {
          const alt = this.nearestAI(this.restart.team, this.restart.x, this.restart.z);
          if (alt) this.restart.taker = alt;
          else if (this.phaseT > 9) {
            this.giveBall(this.restart.taker);
            this.phase = "live";
          }
        }
      }
    }
    updateAI(this, h);
    this.humans.forEach((hp) => this.humanUpdate(hp, h));
    this.movePlayers(h);
    this.updateBall(h);
    this.players.forEach((p) => {
      if (p.kickT >= 0) {
        p.kickT += h;
        if (p.kickT > 0.45) p.kickT = -1;
      }
      if (p.tackleAnim >= 0) {
        p.tackleAnim += h;
        if (p.tackleAnim > 0.5) p.tackleAnim = -1;
      }
      if (p.tackleCd > 0) p.tackleCd -= h;
      if (p.stun > 0) p.stun -= h;
      if (p.callT > 0) p.callT -= h;
    });
    const b = this.ball;
    if (b.passTimer > 0) {
      b.passTimer -= h;
      if (b.passTimer <= 0) b.passTarget = null;
    }
  }
  nearestAI(team, x, z) {
    let best = null;
    this.teamPlayers(team).forEach((p) => {
      if (p.human || p.isGK) return;
      const d = dist(p.x, p.z, x, z);
      if (!best || d < best.d) best = { p, d };
    });
    return best ? best.p : null;
  }
  // ---------- human ----------
  canKick(p) {
    const b = this.ball;
    if (this.phase !== "live" && this.phase !== "restart") return false;
    if (b.owner === p) return true;
    if (b.owner) return false;
    if (this.phase === "restart" && this.restart.team !== p.team) return false;
    return dist(p.x, p.z, b.x, b.z) < 1.7 && b.y < 1.2 && p.kickLock <= this.t && p.stun <= 0;
  }
  aimRay(h) {
    const { yaw, pitch } = (h || this.human).input;
    const cp = Math.cos(pitch);
    return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
  }
  humanUpdate(h, dt) {
    const inp = h.input;
    const frozen = this.phase === "kickoff" || this.phase === "ended";
    h.fx = -Math.sin(inp.yaw);
    h.fz = -Math.cos(inp.yaw);
    let ax = 0;
    let az = 0;
    const sp = frozen || h.stun > 0 || h.diveT > 0 ? 0 : 1;
    const fwd = [-Math.sin(inp.yaw), -Math.cos(inp.yaw)];
    const right = [Math.cos(inp.yaw), -Math.sin(inp.yaw)];
    ax = fwd[0] * inp.mz + right[0] * inp.mx;
    az = fwd[1] * inp.mz + right[1] * inp.mx;
    const m = Math.hypot(ax, az);
    if (m > 0) {
      ax /= m;
      az /= m;
    }
    const moving = m > 0 && sp > 0;
    const wantSprint = inp.sprint && moving && !h.exhausted && h.stamina > 0;
    h.sprinting = wantSprint;
    if (wantSprint) h.stamina = Math.max(0, h.stamina - 22 * dt);
    else h.stamina = Math.min(100, h.stamina + (moving ? 9 : 16) * dt);
    if (h.stamina <= 0) h.exhausted = true;
    if (h.exhausted && h.stamina > 28) h.exhausted = false;
    let speed = wantSprint ? 7.1 : 5.2;
    if (inp.mz < 0 && !inp.mx) speed *= 0.7;
    else if (inp.mz <= 0 && inp.mx) speed *= 0.85;
    if (this.ball.owner === h) speed *= 0.94;
    if (h.charge > 0) speed *= 0.85;
    h.tx = h.x + ax * 5;
    h.tz = h.z + az * 5;
    h.tf = moving ? speed : 0;
    h.humanDir = [ax, az];
    if (this.phase === "kickoff" || this.phase === "ended") {
      h.charge = 0;
      inp.fireDown = false;
      inp.fireUp = false;
      inp.pass = inp.lob = inp.tackle = false;
      return;
    }
    if (inp.call) {
      h.callT = 1.6;
      inp.call = false;
      this.emit("call", {});
    }
    const can = this.canKick(h);
    if (inp.fireDown && can) h.charge = Math.min(1, h.charge + dt / 0.85);
    if (inp.fireUp) {
      if (h.charge > 0 && can) this.humanShoot(h, Math.max(0.3, h.charge));
      h.charge = 0;
      inp.fireUp = false;
    }
    if (!inp.fireDown && h.charge > 0 && !can) h.charge = 0;
    if (inp.pass) {
      if (can) this.humanPass(h, false);
      inp.pass = false;
    }
    if (inp.lob) {
      if (can) this.humanPass(h, true);
      inp.lob = false;
    }
    if (inp.tackle) {
      if (!can) {
        if (h.isGK) this.humanDive(h);
        else this.humanTackle(h);
      }
      inp.tackle = false;
    }
  }
  eye(h) {
    return { x: h.x, y: EYE_HEIGHT, z: h.z };
  }
  humanShoot(h, power) {
    const ray = this.aimRay(h);
    const e = this.eye(h);
    const gzv = goalZ(h.team);
    let t = 45;
    if (Math.abs(ray.z) > 1e-3) {
      const tg = (gzv - e.z) / ray.z;
      if (tg > 0 && tg < 80) t = tg;
    }
    if (ray.y < -0.01) {
      const tgr = e.y / -ray.y;
      if (tgr < t) t = tgr;
    }
    let tx = e.x + ray.x * t;
    let ty = Math.max(0, e.y + ray.y * t);
    let tz = e.z + ray.z * t;
    ty = Math.min(ty, 14);
    const b = this.ball;
    const speed = 17 + 16 * power;
    const spread = 8e-3 + (power > 0.85 ? (power - 0.85) * 0.25 : 0) + (h.sprinting ? 0.012 : 0);
    const d0 = Math.hypot(tx - b.x, tz - b.z);
    const ang = this.gauss() * spread;
    const dx = tx - b.x;
    const dz = tz - b.z;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    tx = b.x + dx * c - dz * s;
    tz = b.z + dx * s + dz * c;
    ty += this.gauss() * spread * d0 * 0.5;
    this.kickBall(h, solveShot(b, { x: tx, y: Math.max(0, ty), z: tz }, speed), "shot");
  }
  // find a teammate under the crosshair
  crosshairTeammate(h, minD, maxD) {
    const ray = this.aimRay(h);
    const e = this.eye(h);
    let best = null;
    this.teamPlayers(h.team).forEach((q) => {
      if (q === h) return;
      const dx = q.x - e.x;
      const dy = 1 - e.y;
      const dz = q.z - e.z;
      const d = Math.hypot(dx, dy, dz);
      const dh = Math.hypot(dx, dz);
      if (dh < minD || dh > maxD) return;
      const cosA = (dx * ray.x + dy * ray.y + dz * ray.z) / d;
      const a = Math.acos(clamp(cosA, -1, 1));
      const lim = Math.max(0.1, Math.atan(1 / d));
      if (a < lim && (!best || a < best.a)) best = { q, a };
    });
    return best ? best.q : null;
  }
  humanPass(h, lob) {
    const b = this.ball;
    const ray = this.aimRay(h);
    let hx = ray.x;
    let hz = ray.z;
    const hm = Math.hypot(hx, hz) || 1;
    hx /= hm;
    hz /= hm;
    const target = this.crosshairTeammate(h, lob ? 8 : 3, lob ? 60 : 38);
    let kick;
    if (!lob) {
      let dx = hx;
      let dz = hz;
      let v = 15;
      if (target) {
        const d0 = dist(b.x, b.z, target.x, target.z);
        const tf = d0 / 14;
        const lx = clamp(target.x + target.vx * tf * 0.8, -HW + 0.5, HW - 0.5);
        const lz = clamp(target.z + target.vz * tf * 0.8, -HL + 0.5, HL - 0.5);
        const d = dist(b.x, b.z, lx, lz);
        dx = (lx - b.x) / d;
        dz = (lz - b.z) / d;
        v = clamp(8 + ROLL_K * 1.1 * d, 11, 26);
      }
      const ang = this.gauss() * 0.012;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      kick = { vx: (dx * c - dz * s) * v, vz: (dx * s + dz * c) * v, vy: 0 };
    } else {
      let lx;
      let lz;
      if (target) {
        const d0 = dist(b.x, b.z, target.x, target.z);
        const T0 = clamp(d0 / 17, 0.9, 2.2);
        lx = target.x + target.vx * T0 * 0.8;
        lz = target.z + target.vz * T0 * 0.8;
      } else {
        const D = 16 + 34 * clamp((h.input.pitch + 0.3) / 0.75, 0, 1);
        lx = b.x + hx * D;
        lz = b.z + hz * D;
      }
      lx = clamp(lx, -HW + 0.4, HW - 0.4);
      lz = clamp(lz, -HL + 0.4, HL - 0.4);
      kick = solveLob(b, lx, lz);
    }
    this.kickBall(h, kick, "pass", target);
  }
  humanDive(h) {
    if (h.diveT > 0 || h.tackleCd > 0) return;
    const inp = h.input;
    const right = [Math.cos(inp.yaw), -Math.sin(inp.yaw)];
    const fwd = [-Math.sin(inp.yaw), -Math.cos(inp.yaw)];
    let dx = right[0] * inp.mx + fwd[0] * (inp.mz > 0 ? 0.6 : 0);
    let dz = right[1] * inp.mx + fwd[1] * (inp.mz > 0 ? 0.6 : 0);
    const l = Math.hypot(dx, dz);
    if (l < 0.1) return;
    dx /= l;
    dz /= l;
    h.diveT = 0.5;
    h.diveVx = dx * 8.5;
    h.diveVz = dz * 8.5;
    h.tackleCd = 1.2;
  }
  humanTackle(h) {
    if (h.tackleCd > 0 || h.stun > 0) return;
    h.tackleCd = 0.9;
    h.tackleAnim = 0;
    const b = this.ball;
    const o = b.owner;
    if (!o || o.team === h.team) return;
    const d = dist(h.x, h.z, o.x, o.z);
    if (d > 1.9) return;
    const toO = [(o.x - h.x) / (d || 1), (o.z - h.z) / (d || 1)];
    const facing = h.fx * toO[0] + h.fz * toO[1];
    if (facing < 0.2) return;
    this.resolveTackle(h, o, 0.62);
  }
  // shared by humans and AI. returns true on success.
  resolveTackle(t, o, base) {
    const p = clamp(base * (1.25 - 0.55 * o.skill) * (o.sprinting ? 0.8 : 1), 0.08, 0.9);
    if (this.rng() < p) {
      this.stats[t.team].tackles += 1;
      const b = this.ball;
      o.stun = 0.45;
      if (this.rng() < 0.55) {
        this.giveBall(t);
      } else {
        b.owner = null;
        b.lastTeam = t.team;
        b.lastPlayer = t;
        const fx = t.fx;
        const fz = t.fz;
        b.vx = fx * 4.5 + (this.rng() - 0.5) * 3;
        b.vz = fz * 4.5 + (this.rng() - 0.5) * 3;
        b.vy = 0;
        t.kickLock = this.t + 0.15;
        o.kickLock = this.t + 0.5;
      }
      this.emit("tackle", {});
      return true;
    }
    t.stun = Math.max(t.stun, 0.35);
    return false;
  }
  // ---------- kicking ----------
  kickBall(p, v, kind, target = null) {
    const b = this.ball;
    const wasOwner = b.owner === p;
    b.owner = null;
    b.vx = v.vx;
    b.vy = v.vy;
    b.vz = v.vz;
    if (!wasOwner) {
    }
    b.lastTeam = p.team;
    b.lastPlayer = p;
    b.kind = kind;
    this.restartCarry = false;
    p.kickT = 0;
    p.kickLock = this.t + 0.4;
    p.holdTime = 0;
    b.passTarget = null;
    b.passer = null;
    if (kind === "shot") {
      b.shot = { team: p.team, id: this.t };
      this.stats[p.team].shots += 1;
      b.passer = null;
    } else {
      b.shot = null;
      b.passer = p;
      this.stats[p.team].passes += 1;
      if (target) {
        b.passTarget = target;
        b.passTimer = 3;
      }
    }
    if (this.phase === "restart") this.phase = "live";
    const sp = Math.hypot(v.vx, v.vy, v.vz);
    this.emit("kick", { power: sp });
  }
  // ---------- movement ----------
  movePlayers(h) {
    const b = this.ball;
    this.players.forEach((p) => {
      let dvx = 0;
      let dvz = 0;
      if (p.diveT > 0) {
        p.diveT -= h;
        dvx = p.diveVx * clamp(p.diveT / 0.5, 0, 1);
        dvz = p.diveVz * clamp(p.diveT / 0.5, 0, 1);
        const k = Math.min(1, 6 * h);
        p.vx += (dvx - p.vx) * k;
        p.vz += (dvz - p.vz) * k;
      } else if (p.stun > 0 || this.phase === "kickoff" && this.phaseT >= 0 || this.phase === "ended") {
        const k = Math.min(1, 9 * h);
        p.vx -= p.vx * k;
        p.vz -= p.vz * k;
        if (this.phase === "goal") {
        }
      } else if (p.human) {
        const dir = p.humanDir || [0, 0];
        const sp = p.tf;
        const dvx2 = dir[0] * sp;
        const dvz2 = dir[1] * sp;
        const ax = dvx2 - p.vx;
        const az = dvz2 - p.vz;
        const al = Math.hypot(ax, az);
        const mx = 19 * h;
        if (al > mx) {
          p.vx += ax / al * mx;
          p.vz += az / al * mx;
        } else {
          p.vx = dvx2;
          p.vz = dvz2;
        }
      } else {
        const dx = p.tx - p.x;
        const dz = p.tz - p.z;
        const d = Math.hypot(dx, dz);
        let sp = Math.min(p.maxRun * p.tf * (b.owner === p ? 0.93 : 1), d * 3.4);
        if (d < 0.12) sp = 0;
        p.sprinting = sp > p.maxRun * 0.82;
        const dvx2 = d > 0 ? dx / d * sp : 0;
        const dvz2 = d > 0 ? dz / d * sp : 0;
        const ax = dvx2 - p.vx;
        const az = dvz2 - p.vz;
        const al = Math.hypot(ax, az);
        const mx = p.accel * h;
        if (al > mx) {
          p.vx += ax / al * mx;
          p.vz += az / al * mx;
        } else {
          p.vx = dvx2;
          p.vz = dvz2;
        }
      }
      p.x += p.vx * h;
      p.z += p.vz * h;
      p.speed = Math.hypot(p.vx, p.vz);
      p.runPhase += p.speed * h * 1.35;
      if (!p.human) {
        let gx = p.vx;
        let gz = p.vz;
        let want = p.speed > 0.7;
        if (!want && p.lookX !== null) {
          gx = p.lookX - p.x;
          gz = p.lookZ - p.z;
          want = true;
        }
        if (want) {
          const l = Math.hypot(gx, gz) || 1;
          const k = Math.min(1, 9 * h);
          p.fx += (gx / l - p.fx) * k;
          p.fz += (gz / l - p.fz) * k;
          const fl = Math.hypot(p.fx, p.fz) || 1;
          p.fx /= fl;
          p.fz /= fl;
        }
      }
    });
    for (let i = 0; i < this.players.length; i += 1) {
      for (let j = i + 1; j < this.players.length; j += 1) {
        const a = this.players[i];
        const c = this.players[j];
        const dx = c.x - a.x;
        const dz = c.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.8 && d > 1e-4) {
          const push = (0.8 - d) * 0.5;
          const nx = dx / d;
          const nz = dz / d;
          a.x -= nx * push;
          a.z -= nz * push;
          c.x += nx * push;
          c.z += nz * push;
        }
      }
    }
    this.players.forEach((p) => {
      p.x = clamp(p.x, -HW + 0.3, HW - 0.3);
      p.z = clamp(p.z, -HL + 0.3, HL - 0.3);
    });
  }
  // ---------- ball ----------
  updateBall(h) {
    const b = this.ball;
    const owner = b.owner;
    if (owner) {
      if (owner.stun > 0.3 && !owner.human) {
      }
      const off = 0.62 + 0.28 * (0.5 + 0.5 * Math.sin(owner.runPhase * 2.2));
      const o = owner.human ? 1 + (owner.speed < 0.3 ? 0 : 0.2 * Math.sin(owner.runPhase * 2.2)) : owner.speed < 0.3 ? 0.7 : off;
      let nx = owner.x + owner.fx * o;
      let nz = owner.z + owner.fz * o;
      nx = clamp(nx, -HW + 0.15, HW - 0.15);
      nz = clamp(nz, -HL + 0.15, HL - 0.15);
      b.vx = (nx - b.x) / h;
      b.vz = (nz - b.z) / h;
      b.x = nx;
      b.z = nz;
      b.y = BALL_R;
      b.vy = 0;
      return;
    }
    const px = b.x;
    const pz = b.z;
    const sub = 2;
    const hh = h / sub;
    for (let s = 0; s < sub; s += 1) {
      b.vy -= GRAVITY * hh;
      b.x += b.vx * hh;
      b.y += b.vy * hh;
      b.z += b.vz * hh;
      if (b.y < BALL_R) {
        b.y = BALL_R;
        if (b.vy < -0.6) {
          b.vy = -b.vy * BOUNCE;
          b.vx *= 0.94;
          b.vz *= 0.94;
          if (b.vy > 1.5) this.emit("bounce", { v: b.vy });
        } else b.vy = 0;
      }
      if (b.y <= BALL_R + 1e-3 && b.vy === 0) {
        const sp = Math.hypot(b.vx, b.vz);
        if (sp > 0) {
          const ns = Math.max(0, sp * Math.exp(-ROLL_K * hh) - ROLL_C * hh);
          b.vx *= ns / sp;
          b.vz *= ns / sp;
        }
      }
      this.collideFrame(b);
      if (this.inNet) this.netConstrain(b);
    }
    if (this.phase === "live" || this.phase === "restart") this.contacts(px, pz);
    if (this.phase === "live") this.boundsCheck();
  }
  collideFrame(b) {
    for (let e = -1; e <= 1; e += 2) {
      const gz = e * HL;
      if (Math.abs(b.z - gz) > 1) continue;
      this.hitSeg(b, -GOAL_HALF, 0, gz, -GOAL_HALF, GOAL_H, gz);
      this.hitSeg(b, GOAL_HALF, 0, gz, GOAL_HALF, GOAL_H, gz);
      this.hitSeg(b, -GOAL_HALF, GOAL_H, gz, GOAL_HALF, GOAL_H, gz);
    }
  }
  hitSeg(b, ax, ay, az, bx, by, bz) {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const l2 = dx * dx + dy * dy + dz * dz;
    let t = ((b.x - ax) * dx + (b.y - ay) * dy + (b.z - az) * dz) / l2;
    t = clamp(t, 0, 1);
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    const cz = az + dz * t;
    let nx = b.x - cx;
    let ny = b.y - cy;
    let nz = b.z - cz;
    const d = Math.hypot(nx, ny, nz);
    const rr = BALL_R + POST_R;
    if (d >= rr || d < 1e-6) return;
    nx /= d;
    ny /= d;
    nz /= d;
    b.x = cx + nx * rr;
    b.y = cy + ny * rr;
    b.z = cz + nz * rr;
    const vn = b.vx * nx + b.vy * ny + b.vz * nz;
    if (vn < 0) {
      const e = 0.62;
      b.vx -= (1 + e) * vn * nx;
      b.vy -= (1 + e) * vn * ny;
      b.vz -= (1 + e) * vn * nz;
      if (-vn > 2.5) this.emit("post", { v: -vn });
      if (this.ball.shot) this.ball.shot.hit = true;
    }
  }
  netConstrain(b) {
    const s = Math.sign(b.z) || 1;
    const back = HL + GOAL_DEPTH - BALL_R;
    if (Math.abs(b.z) > back) {
      b.z = s * back;
      b.vz *= -0.12;
      b.vx *= 0.6;
    }
    if (Math.abs(b.x) > GOAL_HALF - BALL_R && Math.abs(b.z) > HL) {
      b.x = Math.sign(b.x) * (GOAL_HALF - BALL_R);
      b.vx *= -0.2;
    }
    if (b.y > GOAL_H - BALL_R && Math.abs(b.z) > HL) {
      b.y = GOAL_H - BALL_R;
      b.vy *= -0.2;
    }
  }
  contacts(px, pz) {
    const b = this.ball;
    for (const p of this.players) {
      if (p.kickLock > this.t) continue;
      if (this.phase === "restart" && this.restart && p.team !== this.restart.team) continue;
      if (p.stun > 0.2) continue;
      if (p.isGK) {
        if (this.gkContact(p)) return;
        continue;
      }
      if (b.y > (p.human ? 1.5 : 1.05)) continue;
      const si = segInfo(p.x, p.z, px, pz, b.x, b.z);
      const reach = p.human ? 1.5 : 0.62 + (p.speed > 3 ? 0.12 : 0);
      if (si.d > reach) continue;
      if (this.footContact(p)) return;
    }
  }
  footContact(p) {
    const b = this.ball;
    const relV = Math.hypot(b.vx - p.vx, b.vz - p.vz, b.vy * 0.4);
    const skill = p.human ? 0.85 : p.skill;
    const prevOwner = b.lastPlayer;
    const sameTeamPasser = b.passer && b.passer.team === p.team && b.passer !== p;
    if (relV > 15 + 11 * skill) {
      const ang = (this.rng() - 0.5) * 1.6;
      const sp = Math.hypot(b.vx, b.vz) * 0.35;
      const a0 = Math.atan2(b.vz, b.vx) + Math.PI + ang;
      b.vx = Math.cos(a0) * sp + p.vx * 0.3;
      b.vz = Math.sin(a0) * sp + p.vz * 0.3;
      b.vy = 1 + this.rng() * 2;
      b.lastTeam = p.team;
      b.lastPlayer = p;
      p.kickLock = this.t + 0.25;
      b.passTarget = null;
      if (b.shot && b.shot.team !== p.team) b.shot = null;
      this.emit("kick", { power: 8 });
      return true;
    }
    const failP = clamp((relV - 9) / 18, 0, 0.6) * (1.2 - skill);
    if (!p.human && relV > 9 && this.rng() < failP) {
      const sp = relV * 0.45 + 2;
      const l = Math.hypot(b.vx - p.vx, b.vz - p.vz) || 1;
      b.vx = p.vx + (b.vx - p.vx) / l * sp;
      b.vz = p.vz + (b.vz - p.vz) / l * sp;
      b.vy = 0;
      b.lastTeam = p.team;
      b.lastPlayer = p;
      p.kickLock = this.t + 0.3;
      b.passTarget = null;
      return true;
    }
    if (b.passer && b.kind === "pass") {
      if (sameTeamPasser) this.stats[p.team].passOk += 1;
    }
    if (b.shot && b.shot.team !== p.team) b.shot = null;
    this.giveBall(p);
    b.kind = null;
    b.passer = null;
    void prevOwner;
    return true;
  }
  gkContact(p) {
    const b = this.ball;
    const dx = b.x - p.x;
    const dz = b.z - p.z;
    const dh = Math.hypot(dx, dz);
    const diving = p.diveT > 0;
    const reachH = (diving ? 1.6 : 0.85) + (p.human ? 0.3 : 0);
    const reachY = diving ? 2.1 : 2;
    if (dh > reachH || b.y > reachY) return false;
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    const shot = b.shot && b.shot.team !== p.team;
    const catchLim = 10 + 13 * p.skill;
    const fumble = (1 - p.skill) * 0.35;
    if (shot) {
      this.stats[1 - p.team].onTarget += 1;
      b.shot = null;
    }
    if (sp < catchLim && this.rng() > fumble) {
      if (shot) {
        this.stats[p.team].saves += 1;
        this.emit("save", {});
      }
      this.giveBall(p);
      p.holdT = 1 + this.rng() * 0.8;
      b.kind = null;
      return true;
    }
    this.stats[p.team].saves += shot ? 1 : 0;
    const away = Math.sign(b.x - p.x) || (this.rng() < 0.5 ? -1 : 1);
    const inward = dirOf(p.team);
    b.vx = away * (2 + this.rng() * 4) + b.vx * 0.2;
    b.vz = inward * (1.5 + this.rng() * 3);
    b.vy = 1.5 + this.rng() * 2.5;
    b.lastTeam = p.team;
    b.lastPlayer = p;
    b.passTarget = null;
    p.kickLock = this.t + 0.5;
    this.emit("save", {});
    return true;
  }
  boundsCheck() {
    const b = this.ball;
    if (this.inNet) return;
    if (Math.abs(b.z) > HL) {
      if (Math.abs(b.x) < GOAL_HALF - 0.04 && b.y < GOAL_H - 0.04) {
        this.onGoal(b.z > 0 ? 0 : 1);
        return;
      }
      if (Math.abs(b.z) > HL + BALL_R) {
        const sgn = Math.sign(b.z);
        const defTeam = sgn > 0 ? 1 : 0;
        if (b.lastTeam === defTeam) {
          const att = 1 - defTeam;
          this.setRestart("corner", att, Math.sign(b.x || 1) * (HW - 0.4), sgn * (HL - 0.4));
        } else {
          this.setRestart("goalkick", defTeam, 0, sgn * (HL - 5));
        }
        this.emit("out", {});
      }
      return;
    }
    if (Math.abs(b.x) > HW + BALL_R) {
      const team = 1 - b.lastTeam;
      this.setRestart("throwin", team, Math.sign(b.x) * (HW - 0.3), clamp(b.z, -HL + 4, HL - 4));
      this.emit("out", {});
    }
  }
  // ---------- network ----------
  setHuman(id, on) {
    const p = this.players[id];
    if (!p || p.team !== 0) return;
    p.human = on;
    p.tf = 0;
    p.vx *= 0.5;
    p.vz *= 0.5;
    p.input.fireDown = false;
    p.charge = 0;
    this.humans = this.players.filter((q) => q.human);
    this.human = this.humans[0] || null;
  }
  serialize() {
    const r = (v) => Math.round(v * 100) / 100;
    const b = this.ball;
    return {
      ph: this.phase,
      pt: r(this.phaseT),
      ck: r(this.clock),
      sc: this.score.slice(),
      rs: this.restart ? this.restart.kind : null,
      st: this.stats.map((s) => [s.shots, s.onTarget, s.passes, s.passOk, Math.round(s.possession), s.tackles, s.saves]),
      b: [r(b.x), r(b.y), r(b.z), r(b.vx), r(b.vy), r(b.vz), b.owner ? b.owner.id : -1],
      p: this.players.map((p) => [
        r(p.x),
        r(p.z),
        r(p.fx),
        r(p.fz),
        r(p.vx),
        r(p.vz),
        r(p.speed),
        r(p.runPhase),
        r(p.kickT),
        r(p.tackleAnim),
        r(p.diveT),
        r(p.diveVx),
        r(p.diveVz),
        p.celeb,
        p.human ? Math.round(p.stamina) : 0,
        r(p.charge),
        r(p.callT),
        p.human && this.canKick(p) ? 1 : 0,
        p.exhausted ? 1 : 0
      ])
    };
  }
  // ---------- snapshot for HUD ----------
  snapshot(who) {
    const h = who || this.human;
    return {
      score: this.score.slice(),
      clock: this.clock,
      total: this.total,
      phase: this.phase,
      phaseT: this.phaseT,
      stamina: h ? h.stamina : 0,
      exhausted: h ? h.exhausted : false,
      charge: h ? h.charge : 0,
      hasBall: !!(h && this.ball.owner === h),
      canKick: !!(h && this.canKick(h)),
      stats: this.stats,
      restart: this.restart ? this.restart.kind : null,
      callT: h ? h.callT : 0
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Match
});
