const C = require("../shared/constants");

const R = C.BALL_RADIUS;
const G = 9.81;
const PR = C.POST_RADIUS;
const HALF = C.GOAL_WIDTH / 2 + PR;
const BAR_Y = C.GOAL_HEIGHT + PR;
const KEEPER_HALF = 1.15;
const KEEPER_REACH = 0.5;
const DT = 1 / 480;
const SAMPLE_EVERY = 8;
const MAX_T = 4.2;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng) {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sanitizeTarget(t) {
  return {
    x: clamp(Number(t.x), -C.AIM_LIMIT_X, C.AIM_LIMIT_X),
    y: clamp(Number(t.y), C.AIM_MIN_Y, C.AIM_MAX_Y),
  };
}

function keeperPlan(target) {
  const dx = target.x;
  const dy = target.y - C.KEEPER_CENTER_Y;
  const dist = Math.hypot(dx, dy);
  const dhx = dist > 1e-6 ? dx / dist : 0;
  const dhy = dist > 1e-6 ? dy / dist : 1;
  const travel = Math.max(0, dist - KEEPER_HALF * 0.9);
  let ax = dhx;
  let ay = Math.max(dhy, -0.35);
  if (ay < 0 && Math.abs(ax) < 0.2) ax = ax >= 0 ? 0.2 : -0.2;
  const an = Math.hypot(ax, ay) || 1;
  ax /= an;
  ay /= an;
  const tilt = clamp((dist - 0.35) / 0.5, 0, 1);
  let hx = tilt * ax;
  let hy = (1 - tilt) + tilt * ay;
  const hn = Math.hypot(hx, hy) || 1;
  return {
    finalX: dhx * travel,
    finalY: C.KEEPER_CENTER_Y + dhy * travel,
    hx: hx / hn,
    hy: hy / hn,
    duration: 0.3 + 0.11 * dist,
  };
}

function keeperAt(plan, t) {
  const u = clamp(t / plan.duration, 0, 1);
  const e = 1 - (1 - u) * (1 - u);
  const cx = plan.finalX * e;
  const cy = C.KEEPER_CENTER_Y + (plan.finalY - C.KEEPER_CENTER_Y) * e;
  let hx = e * plan.hx;
  let hy = (1 - e) + e * plan.hy;
  const hn = Math.hypot(hx, hy) || 1;
  hx /= hn;
  hy /= hn;
  return { cx, cy, hx, hy, r: KEEPER_REACH * (1 - 0.2 * e), theta: Math.atan2(hx, hy) };
}

function closestOnSegment(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const len2 = abx * abx + aby * aby + abz * abz;
  let t = len2 > 0 ? ((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / len2 : 0;
  t = clamp(t, 0, 1);
  return [ax + abx * t, ay + aby * t, az + abz * t];
}

function bounceOff(p, v, q, radius, restitution) {
  let dx = p.x - q[0];
  let dy = p.y - q[1];
  let dz = p.z - q[2];
  const dist = Math.hypot(dx, dy, dz);
  if (dist >= radius + R) return false;
  if (dist < 1e-9) {
    dx = 0;
    dy = 0;
    dz = 1;
  } else {
    dx /= dist;
    dy /= dist;
    dz /= dist;
  }
  const push = radius + R;
  p.x = q[0] + dx * push;
  p.y = q[1] + dy * push;
  p.z = q[2] + dz * push;
  const vn = v.x * dx + v.y * dy + v.z * dz;
  if (vn < 0) {
    v.x -= (1 + restitution) * vn * dx;
    v.y -= (1 + restitution) * vn * dy;
    v.z -= (1 + restitution) * vn * dz;
    v.x *= 0.96;
    v.y *= 0.96;
    v.z *= 0.96;
  }
  return true;
}

const POSTS = [
  [-HALF, 0, 0, -HALF, BAR_Y, 0],
  [HALF, 0, 0, HALF, BAR_Y, 0],
];
const BAR = [-HALF, BAR_Y, 0, HALF, BAR_Y, 0];

function simulate(shotInput, diveInput, seed) {
  const rng = mulberry32(seed);
  const aim = sanitizeTarget(shotInput);
  const diveTarget = sanitizeTarget(diveInput);
  const sx = 0.16 + 0.03 * Math.abs(aim.x);
  const sy = 0.14 + 0.03 * aim.y;
  const tx = aim.x + gauss(rng) * sx;
  const ty = Math.max(0.15, aim.y + gauss(rng) * sy);
  const curve = (rng() * 2 - 1) * 5;
  const speed = 27.5 - 1.6 * clamp(aim.y / C.GOAL_HEIGHT, 0, 1.3);
  const horizontal = Math.hypot(C.PENALTY_DISTANCE, tx);
  const tf = horizontal / (speed * 0.97);

  const p = { x: 0, y: R, z: C.PENALTY_DISTANCE };
  const v = {
    x: (tx - 0.5 * curve * tf * tf) / tf,
    y: (ty - R + 0.5 * G * tf * tf) / tf,
    z: -C.PENALTY_DISTANCE / tf,
  };

  const plan = keeperPlan(diveTarget);
  const ball = [];
  const keeper = [];
  const events = [{ t: 0, type: "kick" }];

  let t = 0;
  let step = 0;
  let curveActive = true;
  let goal = false;
  let saved = false;
  let wood = null;
  let tGoal = null;
  let tSave = null;
  let tWood = null;
  let tCross = null;
  let settleT = null;
  let groundHits = 0;

  const record = () => {
    ball.push(+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3));
    const k = keeperAt(plan, t);
    keeper.push(+k.cx.toFixed(3), +k.cy.toFixed(3), +k.theta.toFixed(3));
  };

  while (t <= MAX_T) {
    if (step % SAMPLE_EVERY === 0) record();
    if (settleT !== null && t >= settleT) break;

    const prevZ = p.z;
    v.y -= G * DT;
    if (curveActive) v.x += curve * DT;
    p.x += v.x * DT;
    p.y += v.y * DT;
    p.z += v.z * DT;

    if (p.y < R) {
      p.y = R;
      if (v.y < 0) {
        v.y = -v.y * 0.6;
        if (Math.abs(v.y) < 0.6) v.y = 0;
        v.x *= 0.96;
        v.z *= 0.96;
        curveActive = false;
        groundHits += 1;
        if (groundHits <= 3) events.push({ t, type: "bounce" });
      }
    }
    if (p.y <= R + 0.001 && v.y === 0) {
      v.x -= v.x * 0.9 * DT;
      v.z -= v.z * 0.9 * DT;
    }

    for (let i = 0; i < POSTS.length; i += 1) {
      const s = POSTS[i];
      const q = closestOnSegment(p.x, p.y, p.z, s[0], s[1], s[2], s[3], s[4], s[5]);
      if (bounceOff(p, v, q, PR, 0.7)) {
        curveActive = false;
        if (!wood) {
          wood = "POST";
          tWood = t;
          events.push({ t, type: "post" });
          if (settleT === null) settleT = t + 1.6;
        }
      }
    }
    {
      const q = closestOnSegment(p.x, p.y, p.z, BAR[0], BAR[1], BAR[2], BAR[3], BAR[4], BAR[5]);
      if (bounceOff(p, v, q, PR, 0.7)) {
        curveActive = false;
        if (!wood) {
          wood = "CROSSBAR";
          tWood = t;
          events.push({ t, type: "bar" });
          if (settleT === null) settleT = t + 1.6;
        }
      }
    }

    if (!goal && !saved) {
      const k = keeperAt(plan, t);
      const ax = k.cx - k.hx * KEEPER_HALF;
      const ay = k.cy - k.hy * KEEPER_HALF;
      const bx = k.cx + k.hx * KEEPER_HALF;
      const by = k.cy + k.hy * KEEPER_HALF;
      const q = closestOnSegment(p.x, p.y, p.z, ax, ay, C.KEEPER_Z, bx, by, C.KEEPER_Z);
      if (bounceOff(p, v, q, k.r, 0.35)) {
        saved = true;
        tSave = t;
        curveActive = false;
        v.x *= 0.7;
        v.y *= 0.7;
        v.z *= 0.7;
        if (v.z < 3) v.z = 3 + Math.abs(v.z) * 0.2;
        events.push({ t, type: "save" });
        settleT = t + 1.4;
      }
    }

    if (!goal && !saved && prevZ > -R && p.z <= -R && Math.abs(p.x) < HALF && p.y < BAR_Y) {
      goal = true;
      tGoal = t;
      curveActive = false;
      events.push({ t, type: "goal" });
      settleT = t + 1.4;
    }

    if (goal) {
      v.x -= v.x * 6 * DT;
      v.y -= v.y * 6 * DT;
      v.z -= v.z * 6 * DT;
      const frac = clamp(p.y / BAR_Y, 0, 1);
      const zMin = -(C.NET_DEPTH_BOTTOM - (C.NET_DEPTH_BOTTOM - C.NET_DEPTH_TOP) * frac) + R;
      if (p.z < zMin) {
        p.z = zMin;
        if (v.z < 0) v.z = -v.z * 0.1;
      }
      if (p.x > HALF - R) {
        p.x = HALF - R;
        if (v.x > 0) v.x = -v.x * 0.1;
      }
      if (p.x < -HALF + R) {
        p.x = -HALF + R;
        if (v.x < 0) v.x = -v.x * 0.1;
      }
      if (p.y > BAR_Y - R) {
        p.y = BAR_Y - R;
        if (v.y > 0) v.y = -v.y * 0.1;
      }
    } else if (tCross === null && prevZ > -R && p.z <= -R) {
      tCross = t;
      if (settleT === null) settleT = t + 1.2;
    }

    if (settleT === null && t > 3.2) settleT = t;

    t += DT;
    step += 1;
  }
  record();

  let result = "MISS";
  let decidedAt = tCross !== null ? tCross : t;
  if (goal) {
    result = "GOAL";
    decidedAt = tGoal;
  } else if (saved) {
    result = "SAVED";
    decidedAt = tSave;
  } else if (wood) {
    result = wood;
    decidedAt = tWood;
  }

  return {
    result,
    decidedAt: +decidedAt.toFixed(3),
    duration: +(ball.length / 3 - 1) / 60,
    dt: 1 / 60,
    aim,
    actual: { x: +tx.toFixed(3), y: +ty.toFixed(3) },
    dive: diveTarget,
    ball,
    keeper,
    events,
  };
}

module.exports = { simulate, sanitizeTarget };
