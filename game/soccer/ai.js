// AI for the 6v6 match: goalkeepers, ball carriers, off-ball support, pressing, marking,
// interceptions. Everything is derived from the world state (positions, speeds, passing
// lanes, time-to-ball), not from random roaming.
import {
  HL, HW, GOAL_HALF, GOAL_H, BALL_R as R, GRAVITY as G, ROLES, PITCH_L, AREA_DEPTH, AREA_HALF,
} from "./config";
import {
  clamp, dist, dirOf, goalZ, ownZ, adv, toWorld, lateralOf, segInfo, ROLL_K, ROLL_C, BOUNCE,
} from "./util";

// ---------- ballistics ----------
export function solveShot(from, tgt, speed) {
  const dx = tgt.x - from.x;
  const dz = tgt.z - from.z;
  const D = Math.hypot(dx, dz) || 0.01;
  const ux = dx / D;
  const uz = dz / D;
  if (tgt.y <= 0.3) return { vx: ux * speed, vz: uz * speed, vy: 0 };
  const T = D / speed;
  const vy = clamp((tgt.y - from.y) / T + 0.5 * G * T, -6, 13);
  return { vx: ux * speed, vz: uz * speed, vy };
}

export function solveLob(from, lx, lz) {
  const d = Math.hypot(lx - from.x, lz - from.z);
  const T = clamp(d / 17, 0.9, 2.3);
  return { vx: (lx - from.x) / T, vz: (lz - from.z) / T, vy: (R - from.y) / T + 0.5 * G * T };
}

function groundSpeed(d) {
  return clamp(8 + ROLL_K * 1.1 * d, 11, 26);
}

// ---------- prediction ----------
function predict(m) {
  const b = m.ball;
  const P = m.ctx.path;
  let { x, y, z, vx, vy, vz } = b;
  P.x[0] = x; P.y[0] = y; P.z[0] = z;
  const h = 0.05;
  for (let i = 1; i <= 40; i += 1) {
    for (let s = 0; s < 2; s += 1) {
      vy -= G * h;
      x += vx * h; y += vy * h; z += vz * h;
      if (y < R) {
        y = R;
        if (vy < -0.6) { vy = -vy * BOUNCE; vx *= 0.94; vz *= 0.94; } else vy = 0;
      }
      if (y <= R + 1e-3 && vy === 0) {
        const sp = Math.hypot(vx, vz);
        if (sp > 0) {
          const ns = Math.max(0, sp * Math.exp(-ROLL_K * h) - ROLL_C * h);
          vx *= ns / sp; vz *= ns / sp;
        }
      }
    }
    P.x[i] = x; P.y[i] = y; P.z[i] = z;
  }
}

function intercept(m, p) {
  const P = m.ctx.path;
  const sp = p.maxRun * 0.95;
  const maxY = p.isGK ? 2.0 : 1.05;
  for (let i = 1; i <= 40; i += 1) {
    if (P.y[i] > maxY) continue;
    const t = i * 0.1;
    const d = dist(p.x, p.z, P.x[i], P.z[i]);
    if (d - 0.6 <= sp * Math.max(0, t - p.react * 0.5)) return { t, x: P.x[i], z: P.z[i] };
  }
  return { t: Infinity, x: P.x[40], z: P.z[40] };
}

const opp = (m, team) => m.teamPlayers(1 - team);
const field = (m, team) => m.teamPlayers(team).filter((q) => !q.isGK);

function go(p, x, z, f) {
  p.tx = x; p.tz = z; p.tf = f;
}

function look(p, x, z) {
  p.lookX = x; p.lookZ = z;
}

// ---------- evaluation helpers ----------
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
    const f = (i / n) * 0.96;
    const qx = ax + (bx - ax) * f;
    const qz = az + (bz - az) * f;
    const tb = (len * f) / vAvg;
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

export function evalPass(m, c, q) {
  const dx = q.x - c.x;
  const dz = q.z - c.z;
  const d0 = Math.hypot(dx, dz);
  if (d0 < 2.8) return null;
  const lob = d0 > 24;
  let lx; let lz; let v0 = 0; let T = 0;
  if (!lob) {
    v0 = groundSpeed(d0);
    const tf = d0 / (0.5 * (v0 + 8));
    lx = q.x + q.vx * tf * 0.85; lz = q.z + q.vz * tf * 0.85;
  } else {
    T = clamp(d0 / 17, 0.9, 2.2);
    lx = q.x + q.vx * T * 0.8; lz = q.z + q.vz * T * 0.8;
  }
  lx = clamp(lx, -HW + 0.6, HW - 0.6); lz = clamp(lz, -HL + 0.6, HL - 0.6);
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
  return { score: xg * 3.0 * bestT.block * open * (1 - 0.35 * pr), tx: bestT.tx, ty: bestT.ty, dgz };
}

// ---------- executing actions ----------
function doShot(m, p, shot) {
  const b = m.ball;
  const sk = p.skill;
  const speed = clamp(19 + shot.dgz * 0.3, 20, 28);
  let tx = shot.tx; let ty = shot.ty;
  const gz = goalZ(p.team);
  const sig = 0.01 + (1 - sk) * 0.07 + pressure(m, p) * 0.03;
  const ang = m.gauss() * sig;
  const dx = tx - b.x; const dz = gz - b.z;
  const c = Math.cos(ang); const s = Math.sin(ang);
  const ndx = dx * c - dz * s; const ndz = dx * s + dz * c;
  tx = b.x + ndx; const tz = b.z + ndz;
  ty = Math.max(0.1, ty + m.gauss() * sig * shot.dgz * 0.6);
  m.kickBall(p, solveShot(b, { x: tx, y: ty, z: tz }, speed), "shot");
}

function doPass(m, p, o) {
  const b = m.ball;
  const sig = 0.008 + (1 - p.skill) * 0.05 + (o.lob ? 0.012 : 0);
  let v;
  if (o.lob) {
    const ang = m.gauss() * sig;
    const dx = o.lx - b.x; const dz = o.lz - b.z;
    const c = Math.cos(ang); const s = Math.sin(ang);
    v = solveLob(b, b.x + dx * c - dz * s, b.z + dx * s + dz * c);
  } else {
    const dx = o.lx - b.x; const dz = o.lz - b.z;
    const d = Math.hypot(dx, dz) || 1;
    const ang = m.gauss() * sig;
    const c = Math.cos(ang); const s = Math.sin(ang);
    const sp = o.v0 * (1 + m.gauss() * 0.03);
    v = { vx: ((dx / d) * c - (dz / d) * s) * sp, vz: ((dx / d) * s + (dz / d) * c) * sp, vy: 0 };
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

// ---------- carrier ----------
function dribbleDir(m, p) {
  const t = p.team;
  const gz = goalZ(t);
  let tx = p.x * (p.role === "LW" || p.role === "RW" ? 0.92 : 0.6);
  if (Math.abs(gz - p.z) < 16) tx = p.x * 0.35;
  let gx = tx - p.x; let gzv = gz - p.z;
  let l = Math.hypot(gx, gzv) || 1;
  gx /= l; gzv /= l;
  let rx = 0; let rz = 0;
  opp(m, t).forEach((o) => {
    const d = dist(o.x, o.z, p.x, p.z);
    if (d > 7 || d < 0.01) return;
    const nx = (p.x - o.x) / d; const nz = (p.z - o.z) / d;
    const front = (o.x - p.x) * gx + (o.z - p.z) * gzv;
    const w = Math.pow(1 - d / 7, 2) * (front > 0 ? 1 : 0.3);
    rx += nx * w; rz += nz * w;
  });
  let dx = gx + rx * 1.7; let dz = gzv + rz * 1.7;
  if (p.x > HW - 3) dx -= 0.8;
  if (p.x < -HW + 3) dx += 0.8;
  l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, z: dz / l };
}

function spaceAhead(m, p, dir) {
  let best = 12;
  opp(m, p.team).forEach((o) => {
    const rx = o.x - p.x; const rz = o.z - p.z;
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

// ---------- goalkeeper ----------
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
  if (m.phase === "goal" || m.phase === "kickoff") { go(p, p.x, p.z, 0); return; }
  if (b.owner === p) {
    go(p, p.x, p.z, 0);
    look(p, p.x, p.z + dir * 10);
    p.holdT -= h;
    if (p.holdT <= 0 || (m.restartCarry && p.holdT < 0.2)) gkDistribute(m, p);
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
    go(p, tx, gz + dir * 0.55, 1.0);
    look(p, b.x, b.z);
    if (threat.t < 0.55 && Math.abs(tx - p.x) > 1.0 && p.diveT <= 0 && !p.diveDone) {
      p.diveDone = true;
      p.diveT = 0.5;
      p.diveVx = clamp((tx - p.x) / Math.max(0.2, threat.t), -9.5, 9.5);
      p.diveDir = Math.sign(p.diveVx);
    }
    return;
  }
  // loose ball inside / near the area: come and collect when it is faster
  if (!b.owner && m.phase === "live") {
    const inArea = adv(t, b.z) < AREA_DEPTH + 4 && Math.abs(b.x) < AREA_HALF + 3;
    if (inArea && Math.hypot(b.vx, b.vz) < 14) {
      const mine = intercept(m, p);
      let theirs = Infinity;
      opp(m, t).forEach((o) => { if (!o.isGK) theirs = Math.min(theirs, intercept(m, o).t); });
      if (mine.t < theirs - 0.2 && mine.t < 3) { go(p, mine.x, mine.z, 1.0); look(p, b.x, b.z); return; }
    }
  }
  const car = m.ctx.carrier;
  const dc = dist(car.x, car.z, 0, gz);
  let dGK = dc < 16 ? clamp(dc * 0.26, 1.1, 4.0) : clamp(1.0 + dc * 0.03, 1, 2.6);
  if (adv(t, car.z) > 38 && car.owner && car.owner.team === t) dGK += 3;
  const ux = (car.x - 0) / (dc || 1); const uz = (car.z - gz) / (dc || 1);
  let px = ux * dGK;
  px = clamp(px, -(GOAL_HALF + 0.4), GOAL_HALF + 0.4);
  go(p, px, gz + uz * dGK, 0.85);
  look(p, b.x, b.z);
}

// ---------- support (team in possession) ----------
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
    const a = (i / 8) * Math.PI * 2 + m.rng() * 0.5;
    const rad = 3 + m.rng() * 6;
    cands.push({ x: home.x + Math.cos(a) * rad, z: home.z + Math.sin(a) * rad });
  }
  const mates = m.teamPlayers(p.team);
  let best = null;
  cands.forEach((c) => {
    let cx = c.x; let cz = c.z;
    const u = lateralOf(p.team, cx);
    const v = adv(p.team, cz);
    const uc = clamp(u, r.zoneU[0], r.zoneU[1]);
    const vc = clamp(v, r.zoneV[0], r.zoneV[1]);
    const w = toWorld(p.team, uc, vc);
    cx = clamp(w.x, -HW + 1, HW - 1); cz = clamp(w.z, -HL + 1, HL - 1);
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
    p.supX = r.x; p.supZ = r.z; p.supSet = true;
    p.supAt = m.t + 0.45 + m.rng() * 0.35;
  }
  const d = dist(p.x, p.z, p.supX, p.supZ);
  go(p, p.supX, p.supZ, d > 7 ? 1.0 : 0.85);
  look(p, car.x, car.z);
}

// ---------- defending ----------
function aiDefend(m, p, h) {
  const t = p.team;
  const c = m.ctx;
  const car = c.carrier;
  const owner = car.owner;
  const press = m.diff.press * (t === 0 ? 0.9 : 1.0);
  const myGoalX = 0; const myGoalZ = ownZ(t);
  if (owner && c.press[t][0] === p) {
    const d = dist(p.x, p.z, owner.x, owner.z);
    const gxv = myGoalX - owner.x; const gzv = myGoalZ - owner.z;
    const gl = Math.hypot(gxv, gzv) || 1;
    const gx = gxv / gl; const gz = gzv / gl;
    const radius = 14 + 20 * press;
    if (d > radius && adv(t, owner.z) > 30) {
      const f = formTarget(m, p, "def");
      go(p, f.x, f.z, 0.8);
    } else if (d > 3.8) {
      go(p, owner.x + owner.vx * 0.3 + gx * 1.0, owner.z + owner.vz * 0.3 + gz * 1.0, 0.82 + 0.18 * press);
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
    const gxv = myGoalX - owner.x; const gzv = myGoalZ - owner.z;
    const gl = Math.hypot(gxv, gzv) || 1;
    const px = owner.x + (gxv / gl) * 5.5;
    const pz = owner.z + (gzv / gl) * 5.5;
    go(p, px * 0.8, pz, 0.85);
    look(p, owner.x, owner.z);
    return;
  }
  // marking
  const mk = p.markId !== undefined && p.markId !== null ? m.players[p.markId] : null;
  if (mk) {
    const gxv = myGoalX - mk.x; const gzv = myGoalZ - mk.z;
    const gl = Math.hypot(gxv, gzv) || 1;
    const danger = adv(1 - t, mk.z);
    const dx = car.x - mk.x; const dz = car.z - mk.z;
    const dl = Math.hypot(dx, dz) || 1;
    const wGoal = danger > PITCH_L * 0.55 ? 0.75 : 0.35;
    let px = mk.x + (gxv / gl) * 2.0 * wGoal + (dx / dl) * 2.4 * (1 - wGoal);
    let pz = mk.z + (gzv / gl) * 2.0 * wGoal + (dz / dl) * 2.4 * (1 - wGoal);
    if (m.phase === "restart" && m.restart.team !== t) {
      const bd = dist(px, pz, m.ball.x, m.ball.z);
      if (bd < 5.5) { px += ((px - m.ball.x) / (bd || 1)) * (5.5 - bd); pz += ((pz - m.ball.z) / (bd || 1)) * (5.5 - bd); }
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
  defenders.forEach((q) => { q.markId = null; });
  const attackers = field(m, 1 - t)
    .filter((o) => o !== c.carrier.owner)
    .sort((a, b2) => adv(1 - t, b2.z) - adv(1 - t, a.z));
  const used = new Set();
  attackers.forEach((a) => {
    let best = null;
    defenders.forEach((q) => {
      if (used.has(q.id)) return;
      const d = dist(q.x, q.z, a.x, a.z) + (q.markId === a.id ? -2 : 0);
      if (!best || d < best.d) best = { q, d };
    });
    if (best) { used.add(best.q.id); best.q.markId = a.id; }
  });
}

// ---------- chasing loose balls ----------
function aiChase(m, p) {
  const b = m.ball;
  const I = intercept(m, p);
  if (Number.isFinite(I.t)) go(p, I.x, I.z, 1.0);
  else go(p, m.ctx.path.x[12], m.ctx.path.z[12], 1.0);
  if (Math.hypot(b.vx, b.vz) < 1.5) go(p, b.x, b.z, 1.0);
  look(p, b.x, b.z);
}

// ---------- context ----------
function buildContext(m) {
  const c = m.ctx;
  const b = m.ball;
  const o = b.owner;
  c.carrier = o
    ? { x: o.x, z: o.z, vx: o.vx, vz: o.vz, owner: o }
    : { x: b.x, z: b.z, vx: b.vx, vz: b.vz, owner: null };
  if (!o) predict(m);
  else {
    const P = c.path;
    for (let i = 0; i <= 40; i += 1) { P.x[i] = b.x; P.y[i] = R; P.z[i] = b.z; }
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

export function updateAI(m, h) {
  buildContext(m);
  const c = m.ctx;
  const b = m.ball;
  m.players.forEach((p) => {
    if (p.human) return;
    p.lookX = null;
    if (m.phase === "goal" || m.phase === "ended") { go(p, p.x, p.z, 0); return; }
    if (m.phase === "kickoff") {
      if (p === m.kickoffTaker) look(p, p.x, p.z + dirOf(p.team) * 5);
      go(p, p.x, p.z, 0);
      return;
    }
    if (p.isGK) { aiGK(m, p, h); return; }
    if (b.owner === p) { aiCarrier(m, p, h); return; }
    const mode = c.mode[p.team];
    if (m.phase === "restart") {
      if (m.restart.taker === p) { go(p, b.x - dirOf(p.team) * 0.35, b.z, 0.9); look(p, b.x, b.z); return; }
      if (mode === "att") aiSupport(m, p); else aiDefendSet(m, p);
      return;
    }
    if (c.chaser[p.team] === p && !b.owner) { aiChase(m, p); return; }
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
  // set piece for the other team: hold shape, keep distance from the ball
  const f = formTarget(m, p, "def");
  let { x, z } = f;
  const b = m.ball;
  const d = dist(x, z, b.x, b.z);
  if (d < 6) { x += ((x - b.x) / (d || 1)) * (6 - d); z += ((z - b.z) / (d || 1)) * (6 - d); }
  go(p, clamp(x, -HW + 0.8, HW - 0.8), clamp(z, -HL + 0.8, HL - 0.8), 0.85);
  look(p, b.x, b.z);
}
