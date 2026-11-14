// Single player 6v6 match engine: physics, rules, human control. AI lives in ai.js.
import {
  HL, HW, GOAL_HALF, GOAL_H, POST_R, GOAL_DEPTH, BALL_R as R, GRAVITY as G, EYE_HEIGHT,
  ROLES, ROLE_ORDER, DIFFICULTIES, PITCH_L,
} from "./config";
import {
  clamp, dist, mulberry32, dirOf, goalZ, ownZ, adv, toWorld, segInfo, ROLL_K, ROLL_C, BOUNCE,
} from "./util";
import { updateAI, solveShot, solveLob } from "./ai";

const FIXED = 1 / 60;

export class Match {
  constructor({ role = "ST", humanRoles, difficulty = "medium", minutes = 5, seed, humanControlled = true } = {}) {
    this.humanRoles = humanRoles || [role];
    this.opts = { role, difficulty, minutes };
    this.diff = DIFFICULTIES[difficulty] || DIFFICULTIES.medium;
    this.rng = mulberry32(seed === undefined ? (Math.random() * 1e9) | 0 : seed);
    this.humanControlled = humanControlled;
    this.t = 0;
    this.clock = 0;
    this.total = minutes * 60;
    this.score = [0, 0];
    this.stats = [0, 1].map(() => ({ shots: 0, onTarget: 0, passes: 0, passOk: 0, possession: 0, tackles: 0, saves: 0 }));
    this.events = [];
    this.players = [];
    this.ball = { x: 0, y: R, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTeam: 0, lastPlayer: null, passTarget: null, passTimer: 0, shot: null, passer: null, kind: null };
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
          id: id++, team, role, isGK: gk, human, skill,
          x: 0, z: 0, vx: 0, vz: 0, fx: 0, fz: dirOf(team),
          maxRun: (gk ? 5.0 : 5.5) + 1.5 * skill, react: 0.34 - 0.22 * skill, accel: 12 + 5 * skill,
          stamina: 100, exhausted: false, sprinting: false,
          tx: 0, tz: 0, tf: 0, lookX: null, lookZ: null,
          kickT: -1, kickLock: 0, tackleCd: 0, stun: 0,
          diveT: 0, diveDir: 0, diveVx: 0, holdT: 0, holdTime: 0, thinkAt: 0, supAt: 0, supX: 0, supZ: 0, supSet: false,
          gkReactAt: 0, gkSeen: -1,
          charge: 0, callT: 0, aggr: 0.75 + this.rng() * 0.5, noise: this.rng(),
          runPhase: this.rng() * 6, speed: 0, celeb: 0, tackleAnim: -1, decision: null, diveVz: 0, canKickFlag: false,
          input: { mx: 0, mz: 0, yaw: team === 0 ? Math.PI : 0, pitch: 0, sprint: false, fireDown: false, fireUp: false, pass: false, lob: false, tackle: false, call: false },
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
    b.x = 0; b.y = R; b.z = 0; b.vx = 0; b.vy = 0; b.vz = 0;
    b.passTarget = null; b.shot = null; b.passer = null; b.lastTeam = team;
    this.players.forEach((p) => {
      const r = ROLES[p.role];
      const own = p.team === team ? HL - 2.2 : HL - 5.5;
      const w = toWorld(p.team, r.u * 0.9, Math.min(r.v, own));
      p.x = w.x; p.z = w.z; p.vx = 0; p.vz = 0;
      p.fx = 0; p.fz = dirOf(p.team);
      p.stun = 0; p.diveT = 0; p.kickT = -1; p.charge = 0; p.holdTime = 0; p.celeb = 0; p.supSet = false;
      p.tx = p.x; p.tz = p.z; p.tf = 0;
    });
    const taker = this.players[team * 6 + ROLE_ORDER.indexOf("ST")];
    taker.x = -dirOf(team) * 0.0; taker.z = -dirOf(team) * 0.9;
    taker.fz = dirOf(team); taker.fx = 0;
    this.kickoffTaker = taker;
    this.humans.forEach((hp) => { hp.input.yaw = hp.team === 0 ? Math.PI : 0; hp.input.pitch = 0; });
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
    b.vx = p.vx; b.vz = p.vz; b.vy = 0;
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
    b.owner = null; b.x = x; b.z = z; b.y = R; b.vx = 0; b.vy = 0; b.vz = 0;
    b.passTarget = null; b.shot = null;
    this.restart = { kind, team, x, z, taker: null };
    // designate the taker
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
      if (this.phaseT >= 3.0) this.startLive();
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
          else if (this.phaseT > 9) { this.giveBall(this.restart.taker); this.phase = "live"; }
        }
      }
    }

    updateAI(this, h);
    this.humans.forEach((hp) => this.humanUpdate(hp, h));
    this.movePlayers(h);
    this.updateBall(h);
    this.players.forEach((p) => {
      if (p.kickT >= 0) { p.kickT += h; if (p.kickT > 0.45) p.kickT = -1; }
      if (p.tackleAnim >= 0) { p.tackleAnim += h; if (p.tackleAnim > 0.5) p.tackleAnim = -1; }
      if (p.tackleCd > 0) p.tackleCd -= h;
      if (p.stun > 0) p.stun -= h;
      if (p.callT > 0) p.callT -= h;
    });
    const b = this.ball;
    if (b.passTimer > 0) { b.passTimer -= h; if (b.passTimer <= 0) b.passTarget = null; }
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
    // movement
    let ax = 0; let az = 0;
    const sp = frozen || h.stun > 0 || h.diveT > 0 ? 0 : 1;
    const fwd = [-Math.sin(inp.yaw), -Math.cos(inp.yaw)];
    const right = [Math.cos(inp.yaw), -Math.sin(inp.yaw)];
    ax = fwd[0] * inp.mz + right[0] * inp.mx;
    az = fwd[1] * inp.mz + right[1] * inp.mx;
    const m = Math.hypot(ax, az);
    if (m > 0) { ax /= m; az /= m; }
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
    h.tx = h.x + ax * 5; h.tz = h.z + az * 5;
    h.tf = moving ? speed : 0; // human: tf is absolute speed
    h.humanDir = [ax, az];

    // actions
    if (this.phase === "kickoff" || this.phase === "ended") { h.charge = 0; inp.fireDown = false; inp.fireUp = false; inp.pass = inp.lob = inp.tackle = false; return; }
    if (inp.call) { h.callT = 1.6; inp.call = false; this.emit("call", {}); }
    const can = this.canKick(h);
    if (inp.fireDown && can) h.charge = Math.min(1, h.charge + dt / 0.85);
    if (inp.fireUp) {
      if (h.charge > 0 && can) this.humanShoot(h, Math.max(0.3, h.charge));
      h.charge = 0;
      inp.fireUp = false;
    }
    if (!inp.fireDown && h.charge > 0 && !can) h.charge = 0;
    if (inp.pass) { if (can) this.humanPass(h, false); inp.pass = false; }
    if (inp.lob) { if (can) this.humanPass(h, true); inp.lob = false; }
    if (inp.tackle) {
      if (!can) { if (h.isGK) this.humanDive(h); else this.humanTackle(h); }
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
    // intersection with the goal plane
    if (Math.abs(ray.z) > 1e-3) {
      const tg = (gzv - e.z) / ray.z;
      if (tg > 0 && tg < 80) t = tg;
    }
    // ground intersection
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
    const spread = 0.008 + (power > 0.85 ? (power - 0.85) * 0.25 : 0) + (h.sprinting ? 0.012 : 0);
    const d0 = Math.hypot(tx - b.x, tz - b.z);
    const ang = this.gauss() * spread;
    const dx = tx - b.x; const dz = tz - b.z;
    const c = Math.cos(ang); const s = Math.sin(ang);
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
      const dx = q.x - e.x; const dy = 1.0 - e.y; const dz = q.z - e.z;
      const d = Math.hypot(dx, dy, dz);
      const dh = Math.hypot(dx, dz);
      if (dh < minD || dh > maxD) return;
      const cosA = (dx * ray.x + dy * ray.y + dz * ray.z) / d;
      const a = Math.acos(clamp(cosA, -1, 1));
      const lim = Math.max(0.1, Math.atan(1.0 / d));
      if (a < lim && (!best || a < best.a)) best = { q, a };
    });
    return best ? best.q : null;
  }

  humanPass(h, lob) {
    const b = this.ball;
    const ray = this.aimRay(h);
    let hx = ray.x; let hz = ray.z;
    const hm = Math.hypot(hx, hz) || 1;
    hx /= hm; hz /= hm;
    const target = this.crosshairTeammate(h, lob ? 8 : 3, lob ? 60 : 38);
    let kick;
    if (!lob) {
      let dx = hx; let dz = hz; let v = 15;
      if (target) {
        const d0 = dist(b.x, b.z, target.x, target.z);
        const tf = d0 / 14;
        const lx = clamp(target.x + target.vx * tf * 0.8, -HW + 0.5, HW - 0.5);
        const lz = clamp(target.z + target.vz * tf * 0.8, -HL + 0.5, HL - 0.5);
        const d = dist(b.x, b.z, lx, lz);
        dx = (lx - b.x) / d; dz = (lz - b.z) / d;
        v = clamp(8 + ROLL_K * 1.1 * d, 11, 26);
      }
      const ang = this.gauss() * 0.012;
      const c = Math.cos(ang); const s = Math.sin(ang);
      kick = { vx: (dx * c - dz * s) * v, vz: (dx * s + dz * c) * v, vy: 0 };
    } else {
      let lx; let lz;
      if (target) {
        const d0 = dist(b.x, b.z, target.x, target.z);
        const T0 = clamp(d0 / 17, 0.9, 2.2);
        lx = target.x + target.vx * T0 * 0.8; lz = target.z + target.vz * T0 * 0.8;
      } else {
        const D = 16 + 34 * clamp((h.input.pitch + 0.3) / 0.75, 0, 1);
        lx = b.x + hx * D; lz = b.z + hz * D;
      }
      lx = clamp(lx, -HW + 0.4, HW - 0.4); lz = clamp(lz, -HL + 0.4, HL - 0.4);
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
    dx /= l; dz /= l;
    h.diveT = 0.5; h.diveVx = dx * 8.5; h.diveVz = dz * 8.5; h.tackleCd = 1.2;
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
        b.lastTeam = t.team; b.lastPlayer = t;
        const fx = t.fx; const fz = t.fz;
        b.vx = fx * 4.5 + (this.rng() - 0.5) * 3; b.vz = fz * 4.5 + (this.rng() - 0.5) * 3; b.vy = 0;
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
    b.vx = v.vx; b.vy = v.vy; b.vz = v.vz;
    if (!wasOwner) { /* first-time kick keeps ball position */ }
    b.lastTeam = p.team; b.lastPlayer = p;
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
      if (target) { b.passTarget = target; b.passTimer = 3.0; }
    }
    if (this.phase === "restart") this.phase = "live";
    const sp = Math.hypot(v.vx, v.vy, v.vz);
    this.emit("kick", { power: sp });
  }

  // ---------- movement ----------
  movePlayers(h) {
    const b = this.ball;
    this.players.forEach((p) => {
      let dvx = 0; let dvz = 0;
      if (p.diveT > 0) {
        p.diveT -= h;
        dvx = p.diveVx * clamp(p.diveT / 0.5, 0, 1); dvz = p.diveVz * clamp(p.diveT / 0.5, 0, 1);
        const k = Math.min(1, 6 * h);
        p.vx += (dvx - p.vx) * k; p.vz += (dvz - p.vz) * k;
      } else if (p.stun > 0 || this.phase === "kickoff" && this.phaseT >= 0 || this.phase === "ended") {
        const k = Math.min(1, 9 * h);
        p.vx -= p.vx * k; p.vz -= p.vz * k;
        if (this.phase === "goal") { /* celebration stays put */ }
      } else if (p.human) {
        const dir = p.humanDir || [0, 0];
        const sp = p.tf;
        const dvx2 = dir[0] * sp; const dvz2 = dir[1] * sp;
        const ax = dvx2 - p.vx; const az = dvz2 - p.vz;
        const al = Math.hypot(ax, az);
        const mx = 19 * h;
        if (al > mx) { p.vx += (ax / al) * mx; p.vz += (az / al) * mx; } else { p.vx = dvx2; p.vz = dvz2; }
      } else {
        const dx = p.tx - p.x; const dz = p.tz - p.z;
        const d = Math.hypot(dx, dz);
        let sp = Math.min(p.maxRun * p.tf * (b.owner === p ? 0.93 : 1), d * 3.4);
        if (d < 0.12) sp = 0;
        p.sprinting = sp > p.maxRun * 0.82;
        const dvx2 = d > 0 ? (dx / d) * sp : 0; const dvz2 = d > 0 ? (dz / d) * sp : 0;
        const ax = dvx2 - p.vx; const az = dvz2 - p.vz;
        const al = Math.hypot(ax, az);
        const mx = p.accel * h;
        if (al > mx) { p.vx += (ax / al) * mx; p.vz += (az / al) * mx; } else { p.vx = dvx2; p.vz = dvz2; }
      }
      p.x += p.vx * h; p.z += p.vz * h;
      p.speed = Math.hypot(p.vx, p.vz);
      p.runPhase += p.speed * h * 1.35;
      if (!p.human) {
        let gx = p.vx; let gz = p.vz;
        let want = p.speed > 0.7;
        if (!want && p.lookX !== null) { gx = p.lookX - p.x; gz = p.lookZ - p.z; want = true; }
        if (want) {
          const l = Math.hypot(gx, gz) || 1;
          const k = Math.min(1, 9 * h);
          p.fx += (gx / l - p.fx) * k; p.fz += (gz / l - p.fz) * k;
          const fl = Math.hypot(p.fx, p.fz) || 1;
          p.fx /= fl; p.fz /= fl;
        }
      }
    });
    // separation
    for (let i = 0; i < this.players.length; i += 1) {
      for (let j = i + 1; j < this.players.length; j += 1) {
        const a = this.players[i]; const c = this.players[j];
        const dx = c.x - a.x; const dz = c.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.8 && d > 1e-4) {
          const push = (0.8 - d) * 0.5;
          const nx = dx / d; const nz = dz / d;
          a.x -= nx * push; a.z -= nz * push; c.x += nx * push; c.z += nz * push;
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
      if (owner.stun > 0.3 && !owner.human) { /* tackled: lose the ball */ }
      const off = 0.62 + 0.28 * (0.5 + 0.5 * Math.sin(owner.runPhase * 2.2));
      const o = owner.human ? 1.0 + (owner.speed < 0.3 ? 0 : 0.2 * Math.sin(owner.runPhase * 2.2)) : owner.speed < 0.3 ? 0.7 : off;
      let nx = owner.x + owner.fx * o;
      let nz = owner.z + owner.fz * o;
      nx = clamp(nx, -HW + 0.15, HW - 0.15);
      nz = clamp(nz, -HL + 0.15, HL - 0.15);
      b.vx = (nx - b.x) / h; b.vz = (nz - b.z) / h;
      b.x = nx; b.z = nz; b.y = R; b.vy = 0;
      return;
    }
    const px = b.x; const pz = b.z;
    const sub = 2;
    const hh = h / sub;
    for (let s = 0; s < sub; s += 1) {
      b.vy -= G * hh;
      b.x += b.vx * hh; b.y += b.vy * hh; b.z += b.vz * hh;
      if (b.y < R) {
        b.y = R;
        if (b.vy < -0.6) {
          b.vy = -b.vy * BOUNCE;
          b.vx *= 0.94; b.vz *= 0.94;
          if (b.vy > 1.5) this.emit("bounce", { v: b.vy });
        } else b.vy = 0;
      }
      if (b.y <= R + 1e-3 && b.vy === 0) {
        const sp = Math.hypot(b.vx, b.vz);
        if (sp > 0) {
          const ns = Math.max(0, sp * Math.exp(-ROLL_K * hh) - ROLL_C * hh);
          b.vx *= ns / sp; b.vz *= ns / sp;
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
    const dx = bx - ax; const dy = by - ay; const dz = bz - az;
    const l2 = dx * dx + dy * dy + dz * dz;
    let t = ((b.x - ax) * dx + (b.y - ay) * dy + (b.z - az) * dz) / l2;
    t = clamp(t, 0, 1);
    const cx = ax + dx * t; const cy = ay + dy * t; const cz = az + dz * t;
    let nx = b.x - cx; let ny = b.y - cy; let nz = b.z - cz;
    const d = Math.hypot(nx, ny, nz);
    const rr = R + POST_R;
    if (d >= rr || d < 1e-6) return;
    nx /= d; ny /= d; nz /= d;
    b.x = cx + nx * rr; b.y = cy + ny * rr; b.z = cz + nz * rr;
    const vn = b.vx * nx + b.vy * ny + b.vz * nz;
    if (vn < 0) {
      const e = 0.62;
      b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; b.vz -= (1 + e) * vn * nz;
      if (-vn > 2.5) this.emit("post", { v: -vn });
      if (this.ball.shot) this.ball.shot.hit = true;
    }
  }

  netConstrain(b) {
    const s = Math.sign(b.z) || 1;
    const back = HL + GOAL_DEPTH - R;
    if (Math.abs(b.z) > back) { b.z = s * back; b.vz *= -0.12; b.vx *= 0.6; }
    if (Math.abs(b.x) > GOAL_HALF - R && Math.abs(b.z) > HL) { b.x = Math.sign(b.x) * (GOAL_HALF - R); b.vx *= -0.2; }
    if (b.y > GOAL_H - R && Math.abs(b.z) > HL) { b.y = GOAL_H - R; b.vy *= -0.2; }
  }

  contacts(px, pz) {
    const b = this.ball;
    // GK first (hands), then feet
    for (const p of this.players) {
      if (p.kickLock > this.t) continue;
      if (this.phase === "restart" && this.restart && p.team !== this.restart.team) continue;
      if (p.stun > 0.2) continue;
      if (p.isGK) { if (this.gkContact(p)) return; continue; }
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
      // block / deflection
      const ang = (this.rng() - 0.5) * 1.6;
      const sp = Math.hypot(b.vx, b.vz) * 0.35;
      const a0 = Math.atan2(b.vz, b.vx) + Math.PI + ang;
      b.vx = Math.cos(a0) * sp + p.vx * 0.3; b.vz = Math.sin(a0) * sp + p.vz * 0.3; b.vy = 1 + this.rng() * 2;
      b.lastTeam = p.team; b.lastPlayer = p;
      p.kickLock = this.t + 0.25;
      b.passTarget = null;
      if (b.shot && b.shot.team !== p.team) b.shot = null;
      this.emit("kick", { power: 8 });
      return true;
    }
    const failP = clamp((relV - 9) / 18, 0, 0.6) * (1.2 - skill);
    if (!p.human && relV > 9 && this.rng() < failP) {
      // heavy first touch
      const sp = relV * 0.45 + 2;
      const l = Math.hypot(b.vx - p.vx, b.vz - p.vz) || 1;
      b.vx = p.vx + ((b.vx - p.vx) / l) * sp; b.vz = p.vz + ((b.vz - p.vz) / l) * sp; b.vy = 0;
      b.lastTeam = p.team; b.lastPlayer = p;
      p.kickLock = this.t + 0.3;
      b.passTarget = null;
      return true;
    }
    if (b.passer && b.kind === "pass") {
      if (sameTeamPasser) this.stats[p.team].passOk += 1;
    }
    if (b.shot && b.shot.team !== p.team) b.shot = null;
    this.giveBall(p);
    b.kind = null; b.passer = null;
    void prevOwner;
    return true;
  }

  gkContact(p) {
    const b = this.ball;
    const dx = b.x - p.x; const dz = b.z - p.z;
    const dh = Math.hypot(dx, dz);
    const diving = p.diveT > 0;
    const reachH = (diving ? 1.6 : 0.85) + (p.human ? 0.3 : 0);
    const reachY = diving ? 2.1 : 2.0;
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
      if (shot) { this.stats[p.team].saves += 1; this.emit("save", {}); }
      this.giveBall(p);
      p.holdT = 1.0 + this.rng() * 0.8;
      b.kind = null;
      return true;
    }
    // parry
    this.stats[p.team].saves += shot ? 1 : 0;
    const away = Math.sign(b.x - p.x) || (this.rng() < 0.5 ? -1 : 1);
    const inward = dirOf(p.team);
    b.vx = away * (2 + this.rng() * 4) + b.vx * 0.2;
    b.vz = inward * (1.5 + this.rng() * 3);
    b.vy = 1.5 + this.rng() * 2.5;
    b.lastTeam = p.team; b.lastPlayer = p;
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
      if (Math.abs(b.z) > HL + R) {
        const sgn = Math.sign(b.z);
        const defTeam = sgn > 0 ? 1 : 0; // team defending this end
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
    if (Math.abs(b.x) > HW + R) {
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
    p.tf = 0; p.vx *= 0.5; p.vz *= 0.5;
    p.input.fireDown = false; p.charge = 0;
    this.humans = this.players.filter((q) => q.human);
    this.human = this.humans[0] || null;
  }

  serialize() {
    const r = (v) => Math.round(v * 100) / 100;
    const b = this.ball;
    return {
      ph: this.phase, pt: r(this.phaseT), ck: r(this.clock), sc: this.score.slice(),
      rs: this.restart ? this.restart.kind : null,
      st: this.stats.map((s) => [s.shots, s.onTarget, s.passes, s.passOk, Math.round(s.possession), s.tackles, s.saves]),
      b: [r(b.x), r(b.y), r(b.z), r(b.vx), r(b.vy), r(b.vz), b.owner ? b.owner.id : -1],
      p: this.players.map((p) => [
        r(p.x), r(p.z), r(p.fx), r(p.fz), r(p.vx), r(p.vz), r(p.speed), r(p.runPhase), r(p.kickT), r(p.tackleAnim),
        r(p.diveT), r(p.diveVx), r(p.diveVz), p.celeb, p.human ? Math.round(p.stamina) : 0, r(p.charge), r(p.callT),
        p.human && this.canKick(p) ? 1 : 0, p.exhausted ? 1 : 0,
      ]),
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
      callT: h ? h.callT : 0,
    };
  }
}

export { PITCH_L, adv, ownZ };
