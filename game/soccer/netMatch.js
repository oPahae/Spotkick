// Client-side replica of a server-run party match. Exposes the same surface the renderer and
// HUD use on the local Match (players, ball, phase, input, snapshot...) and smooths the
// snapshots received at 20 Hz.
import { Match } from "./engine";
import { BALL_R, GRAVITY, EYE_HEIGHT } from "./config";

export class NetMatch {
  constructor(payload) {
    this.net = true;
    this.paused = false;
    this.events = [];
    this.total = payload.total;
    this.clock = 0;
    this.phase = "kickoff";
    this.phaseT = 0;
    this.score = [0, 0];
    this.restart = null;
    this.ended = false;
    this.stats = [0, 1].map(() => ({ shots: 0, onTarget: 0, passes: 0, passOk: 0, possession: 0, tackles: 0, saves: 0 }));
    this.input = { mx: 0, mz: 0, yaw: Math.PI, pitch: 0, sprint: false, fireDown: false, fireUp: false, pass: false, lob: false, tackle: false, call: false };
    this.snapAt = performance.now();
    this.players = payload.players.map((m) => ({
      id: m.id, team: m.team, role: m.role, isGK: m.isGK, name: m.name,
      human: m.id === payload.myPlayerId,
      x: 0, z: 0, vx: 0, vz: 0, fx: 0, fz: m.team === 0 ? 1 : -1, sx: 0, sz: 0,
      speed: 0, runPhase: 0, kickT: -1, tackleAnim: -1, diveT: 0, diveVx: 0, diveVz: 0, celeb: 0,
      stamina: 100, charge: 0, callT: 0, canKickFlag: false, exhausted: false, charge0: 0,
    }));
    this.human = this.players[payload.myPlayerId];
    this.human.input = this.input;
    this.ball = { x: 0, y: BALL_R, z: 0, vx: 0, vy: 0, vz: 0, sx: 0, sy: BALL_R, sz: 0, owner: null };
    this.first = true;
    this.apply(payload.snap);
  }

  apply(s) {
    this.snapAt = performance.now();
    const fresh = this.first;
    this.first = false;
    this.phase = s.ph;
    this.phaseT = s.pt;
    this.clock = s.ck;
    this.score = s.sc;
    this.restart = s.rs ? { kind: s.rs } : null;
    this.ended = s.ph === "ended";
    s.st.forEach((a, i) => {
      const t = this.stats[i];
      t.shots = a[0]; t.onTarget = a[1]; t.passes = a[2]; t.passOk = a[3]; t.possession = a[4]; t.tackles = a[5]; t.saves = a[6];
    });
    const b = this.ball;
    b.sx = s.b[0]; b.sy = s.b[1]; b.sz = s.b[2];
    b.svx = s.b[3]; b.svy = s.b[4]; b.svz = s.b[5];
    b.owner = s.b[6] >= 0 ? this.players[s.b[6]] : null;
    if (fresh) { b.x = b.sx; b.y = b.sy; b.z = b.sz; }
    s.p.forEach((a, i) => {
      const p = this.players[i];
      p.sx = a[0]; p.sz = a[1];
      p.tfx = a[2]; p.tfz = a[3];
      p.vx = a[4]; p.vz = a[5];
      p.speed = a[6];
      p.kickT = a[8]; p.tackleAnim = a[9];
      p.diveT = a[10]; p.diveVx = a[11]; p.diveVz = a[12];
      p.celeb = a[13];
      if (p.human) { p.stamina = a[14]; p.charge = a[15]; p.callT = a[16]; p.canKickFlag = !!a[17]; p.exhausted = !!a[18]; }
      if (fresh) { p.x = p.sx; p.z = p.sz; p.fx = p.tfx; p.fz = p.tfz; p.runPhase = a[7]; }
    });
    if (s.ev && s.ev.length) this.events.push(...s.ev);
  }

  step(dt) {
    dt = Math.min(dt, 0.1);
    const age = Math.min(0.25, (performance.now() - this.snapAt) / 1000);
    this.phaseT += dt;
    if (this.phase === "live") this.clock += dt;
    const k = Math.min(1, 12 * dt);
    this.players.forEach((p) => {
      const tx = p.sx + p.vx * age;
      const tz = p.sz + p.vz * age;
      if (Math.abs(tx - p.x) > 5 || Math.abs(tz - p.z) > 5) { p.x = tx; p.z = tz; } else {
        p.x += p.vx * dt; p.z += p.vz * dt;
        p.x += (tx - p.x) * k; p.z += (tz - p.z) * k;
      }
      if (!p.human) {
        p.fx += (p.tfx - p.fx) * Math.min(1, 14 * dt);
        p.fz += (p.tfz - p.fz) * Math.min(1, 14 * dt);
        const l = Math.hypot(p.fx, p.fz) || 1;
        p.fx /= l; p.fz /= l;
      } else {
        p.fx = -Math.sin(this.input.yaw); p.fz = -Math.cos(this.input.yaw);
      }
      p.runPhase += p.speed * dt * 1.35;
      if (p.kickT >= 0) p.kickT += dt;
      if (p.tackleAnim >= 0) p.tackleAnim += dt;
      if (p.diveT > 0) p.diveT -= dt;
    });
    const b = this.ball;
    const tx = b.sx + b.svx * age;
    const ty = Math.max(BALL_R, b.sy + b.svy * age - 0.5 * GRAVITY * age * age);
    const tz = b.sz + b.svz * age;
    if (Math.abs(tx - b.x) > 6 || Math.abs(tz - b.z) > 6) { b.x = tx; b.y = ty; b.z = tz; } else {
      b.x += (b.svx || 0) * dt; b.z += (b.svz || 0) * dt;
      b.x += (tx - b.x) * 0.4; b.y += (ty - b.y) * 0.4; b.z += (tz - b.z) * 0.4;
    }
  }

  teamPlayers(team) {
    return this.players.filter((p) => p.team === team);
  }

  eye(h) {
    return { x: h.x, y: EYE_HEIGHT, z: h.z };
  }

  canKick(h) {
    return !!h.canKickFlag;
  }

  aimRay(h) {
    return Match.prototype.aimRay.call(this, h);
  }

  crosshairTeammate(h, a, b) {
    return Match.prototype.crosshairTeammate.call(this, h, a, b);
  }

  snapshot() {
    const h = this.human;
    return {
      score: this.score.slice(),
      clock: this.clock,
      total: this.total,
      phase: this.phase,
      phaseT: this.phaseT,
      stamina: h.stamina,
      exhausted: h.exhausted,
      charge: h.charge,
      hasBall: this.ball.owner === h,
      canKick: h.canKickFlag,
      stats: this.stats,
      restart: this.restart ? this.restart.kind : null,
      callT: h.callT,
    };
  }
}
