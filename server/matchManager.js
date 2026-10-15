const crypto = require("crypto");
const C = require("../shared/constants");
const db = require("./db");
const { simulate, sanitizeTarget } = require("./physics");

const COUNTDOWN_MS = 4200;
const SHOOT_MS = 15000;
const KEEPER_MS = 10000;
const RESULT_MS = 1900;
const NEXT_MS = 2600;
const GRACE_MS = 25000;
const WAIT_GRACE_MS = 12000;
const FINISHED_KEEP_MS = 5 * 60 * 1000;
const PER_PHASE_ROUNDS = C.PENS_PER_PHASE * 2;

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function parseTarget(input) {
  if (!input || typeof input !== "object") throw fail("BAD_INPUT", "Invalid target.");
  const x = Number(input.x);
  const y = Number(input.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw fail("BAD_INPUT", "Invalid target.");
  return sanitizeTarget({ x, y });
}

class MatchManager {
  constructor(io) {
    this.io = io;
    this.matches = new Map();
    this.userMatch = new Map();
    this.finished = new Map();
    this.busy = new Set();
  }

  lobbyList() {
    return [...this.matches.values()]
      .filter((m) => m.state === "WAITING" && !m.reserved && m.players.length === 1)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((m) => {
        const host = m.players[0];
        return {
          id: m.id,
          createdAt: m.createdAt,
          host: { username: host.username, sex: host.sex, image: host.image, rating: host.rating },
        };
      });
  }

  broadcastLobby() {
    this.io.to("lobby").emit("lobby:list", this.lobbyList());
  }

  toUser(userId, event, payload) {
    this.io.to(`user:${userId}`).emit(event, payload);
  }

  toMatch(m, event, payload) {
    for (const p of m.players) this.toUser(p.userId, event, payload);
  }

  infoFor(m, userId) {
    const me = m.players.find((p) => p.userId === userId);
    return {
      id: m.id,
      you: me ? me.slot : null,
      players: m.players.map((p) => ({
        slot: p.slot,
        userId: p.userId,
        username: p.username,
        sex: p.sex,
        image: p.image,
        rating: p.rating,
      })),
    };
  }

  stateOf(m) {
    const idx = Math.max(0, m.round - 1);
    const shooterSlot = m.round === 0 ? 0 : idx % 2;
    const phase = Math.floor(idx / PER_PHASE_ROUNDS) + 1;
    const roundInPhase = Math.floor((idx % PER_PHASE_ROUNDS) / 2) + 1;
    return {
      id: m.id,
      state: m.state,
      round: m.round,
      phase,
      roundInPhase,
      perPhase: C.PENS_PER_PHASE,
      shooterSlot,
      keeperSlot: 1 - shooterSlot,
      nextShooterSlot: m.round % 2,
      tieBreak: m.tieBreak,
      scores: [m.players[0] ? m.players[0].score : 0, m.players[1] ? m.players[1].score : 0],
      stats: m.players.map((p) => ({ goals: p.goals, saves: p.saves, misses: p.misses })),
      history: m.history,
      locked: { shooter: !!m.pending.shot, keeper: !!m.pending.dive },
      connected: m.players.map((p) => p.connected),
      deadlineAt: m.deadlineAt,
      serverNow: Date.now(),
    };
  }

  emitState(m) {
    this.toMatch(m, "match:state", this.stateOf(m));
  }

  emitInfo(m) {
    for (const p of m.players) this.toUser(p.userId, "match:info", this.infoFor(m, p.userId));
  }

  clearTimers(m) {
    for (const t of m.timers) clearTimeout(t);
    m.timers = [];
  }

  later(m, ms, fn) {
    const handle = setTimeout(() => {
      m.timers = m.timers.filter((t) => t !== handle);
      fn();
    }, ms);
    m.timers.push(handle);
  }

  userBusyCheck(userId) {
    if (this.busy.has(userId)) throw fail("BUSY", "Another request is in progress.");
    if (this.userMatch.has(userId)) throw fail("ALREADY_IN_MATCH", "You already have an active match.");
  }

  async create(user) {
    this.userBusyCheck(user.id);
    this.busy.add(user.id);
    let m;
    try {
      const id = await db.createMatch(user.id);
      m = {
        id,
        state: "WAITING",
        reserved: false,
        createdAt: Date.now(),
        players: [this.makePlayer(user, 0)],
        round: 0,
        tieBreak: false,
        pending: { shot: null, dive: null },
        history: [],
        rounds: [],
        timers: [],
        waitTimer: null,
        deadlineAt: null,
        lastResolve: null,
      };
      this.matches.set(id, m);
      this.userMatch.set(user.id, id);
    } finally {
      this.busy.delete(user.id);
    }
    this.broadcastLobby();
    this.emitInfo(m);
    this.emitState(m);
    return { matchId: m.id };
  }

  makePlayer(user, slot) {
    return {
      slot,
      userId: user.id,
      username: user.username,
      sex: user.sex,
      image: user.image || null,
      rating: user.score,
      score: 0,
      goals: 0,
      saves: 0,
      misses: 0,
      connected: true,
      graceTimer: null,
    };
  }

  async join(user, matchId) {
    this.userBusyCheck(user.id);
    const m = this.matches.get(Number(matchId));
    if (!m || m.state !== "WAITING" || m.reserved || m.players.length !== 1) {
      this.broadcastLobby();
      throw fail("MATCH_UNAVAILABLE", "That match is no longer available.");
    }
    if (m.players[0].userId === user.id) throw fail("OWN_MATCH", "You cannot join your own match.");
    m.reserved = true;
    this.busy.add(user.id);
    this.broadcastLobby();
    try {
      await db.attachSecondPlayer(m.id, user.id);
    } catch (err) {
      m.reserved = false;
      this.busy.delete(user.id);
      this.broadcastLobby();
      if (err.code === "MATCH_UNAVAILABLE") throw fail("MATCH_UNAVAILABLE", "That match is no longer available.");
      throw err;
    }
    this.busy.delete(user.id);
    if (m.state !== "WAITING") {
      m.reserved = false;
      throw fail("MATCH_UNAVAILABLE", "That match is no longer available.");
    }
    if (m.waitTimer) {
      clearTimeout(m.waitTimer);
      m.waitTimer = null;
    }
    m.players.push(this.makePlayer(user, 1));
    m.reserved = false;
    m.state = "COUNTDOWN";
    m.deadlineAt = Date.now() + COUNTDOWN_MS;
    this.userMatch.set(user.id, m.id);
    this.broadcastLobby();
    this.emitInfo(m);
    this.emitState(m);
    this.later(m, COUNTDOWN_MS, () => this.beginRound(m));
    return { matchId: m.id };
  }

  beginRound(m) {
    if (m.state === "FINISHED") return;
    this.clearTimers(m);
    m.round += 1;
    m.state = "SHOOTING";
    m.pending = { shot: null, dive: null };
    m.deadlineAt = Date.now() + SHOOT_MS;
    this.emitState(m);
    this.later(m, SHOOT_MS, () => this.onShootTimeout(m));
  }

  playerOf(m, userId) {
    return m.players.find((p) => p.userId === userId) || null;
  }

  shoot(user, input) {
    const m = this.matches.get(this.userMatch.get(user.id));
    if (!m) throw fail("NO_MATCH", "You are not in a match.");
    if (m.state !== "SHOOTING") throw fail("INVALID_STATE", "You cannot shoot right now.");
    const me = this.playerOf(m, user.id);
    const st = this.stateOf(m);
    if (!me || me.slot !== st.shooterSlot) throw fail("NOT_SHOOTER", "You are not the shooter this round.");
    if (m.pending.shot) throw fail("ALREADY_ACTED", "Shot already taken.");
    m.pending.shot = { target: parseTarget(input), auto: false };
    if (m.pending.dive) return this.resolveRound(m);
    this.clearTimers(m);
    m.state = "GOALKEEPING";
    m.deadlineAt = Date.now() + KEEPER_MS;
    this.emitState(m);
    this.later(m, KEEPER_MS, () => this.onKeeperTimeout(m));
    return null;
  }

  dive(user, input) {
    const m = this.matches.get(this.userMatch.get(user.id));
    if (!m) throw fail("NO_MATCH", "You are not in a match.");
    if (m.state !== "SHOOTING" && m.state !== "GOALKEEPING") throw fail("INVALID_STATE", "You cannot dive right now.");
    const me = this.playerOf(m, user.id);
    const st = this.stateOf(m);
    if (!me || me.slot !== st.keeperSlot) throw fail("NOT_KEEPER", "You are not the goalkeeper this round.");
    if (m.pending.dive) throw fail("ALREADY_ACTED", "Dive already chosen.");
    m.pending.dive = { target: parseTarget(input), auto: false };
    if (m.pending.shot) return this.resolveRound(m);
    this.emitState(m);
    return null;
  }

  onShootTimeout(m) {
    if (m.state !== "SHOOTING") return;
    if (!m.pending.shot) {
      m.pending.shot = {
        target: sanitizeTarget({ x: (Math.random() * 2 - 1) * 3, y: 0.3 + Math.random() * 1.8 }),
        auto: true,
      };
    }
    if (!m.pending.dive) m.pending.dive = { target: { x: 0, y: 1.0 }, auto: true };
    this.resolveRound(m);
  }

  onKeeperTimeout(m) {
    if (m.state !== "GOALKEEPING") return;
    if (!m.pending.dive) m.pending.dive = { target: { x: 0, y: 1.0 }, auto: true };
    this.resolveRound(m);
  }

  resolveRound(m) {
    this.clearTimers(m);
    m.state = "RESOLVING";
    m.deadlineAt = null;
    const st = this.stateOf(m);
    const shooter = m.players[st.shooterSlot];
    const keeper = m.players[st.keeperSlot];
    const seed = crypto.randomInt(1, 2147483646);
    const sim = simulate(m.pending.shot.target, m.pending.dive.target, seed);
    const record = {
      round: m.round,
      shooterSlot: shooter.slot,
      result: sim.result,
    };
    m.lastResolve = { round: m.round, shooterSlot: shooter.slot, result: sim.result };
    const payload = {
      matchId: m.id,
      round: m.round,
      shooterSlot: shooter.slot,
      keeperSlot: keeper.slot,
      result: sim.result,
      decidedAt: sim.decidedAt,
      duration: sim.duration,
      dt: sim.dt,
      launchDelayMs: C.LAUNCH_DELAY_MS,
      playbackRate: C.PLAYBACK_RATE,
      shot: sim.aim,
      actual: sim.actual,
      dive: sim.dive,
      auto: { shot: m.pending.shot.auto, dive: m.pending.dive.auto },
      ball: sim.ball,
      keeper: sim.keeper,
      events: sim.events,
    };
    this.toMatch(m, "round:resolve", payload);
    this.emitState(m);
    db.insertRound({
      matchId: m.id,
      roundNumber: m.round,
      shooterId: shooter.userId,
      goalkeeperId: keeper.userId,
      result: sim.result,
      shotX: sim.aim.x,
      shotY: sim.aim.y,
      keeperX: sim.dive.x,
      keeperY: sim.dive.y,
    }).catch((err) => console.error("Failed to store round:", err.message));
    m.rounds.push(record);
    const wait = C.LAUNCH_DELAY_MS + (sim.duration * 1000) / C.PLAYBACK_RATE + 300;
    this.later(m, wait, () => this.roundResult(m, sim.result));
  }

  roundResult(m, result) {
    if (m.state !== "RESOLVING") return;
    const st = this.stateOf(m);
    const shooter = m.players[st.shooterSlot];
    const keeper = m.players[st.keeperSlot];
    if (result === "GOAL") {
      shooter.score += 1;
      shooter.goals += 1;
    } else if (result === "SAVED") {
      keeper.saves += 1;
      shooter.misses += 1;
    } else {
      shooter.misses += 1;
    }
    m.history.push({ round: m.round, shooterSlot: shooter.slot, result });
    m.state = "ROUND_RESULT";
    m.deadlineAt = Date.now() + RESULT_MS;
    this.emitState(m);
    this.later(m, RESULT_MS, () => this.afterResult(m));
  }

  afterResult(m) {
    if (m.state !== "ROUND_RESULT") return;
    const phaseDone = m.round % PER_PHASE_ROUNDS === 0;
    const [a, b] = [m.players[0].score, m.players[1].score];
    if (phaseDone && a !== b) {
      this.finish(m, { reason: "COMPLETED", winnerSlot: a > b ? 0 : 1 });
      return;
    }
    m.tieBreak = phaseDone;
    m.state = "NEXT_ROUND";
    m.deadlineAt = Date.now() + NEXT_MS;
    this.emitState(m);
    this.later(m, NEXT_MS, () => {
      m.tieBreak = false;
      this.beginRound(m);
    });
  }

  async finish(m, { reason, winnerSlot, leaverSlot = null }) {
    if (m.state === "FINISHED") return;
    this.clearTimers(m);
    if (m.waitTimer) clearTimeout(m.waitTimer);
    m.state = "FINISHED";
    m.deadlineAt = null;
    for (const p of m.players) {
      if (p.graceTimer) clearTimeout(p.graceTimer);
      this.userMatch.delete(p.userId);
    }
    const winner = m.players[winnerSlot];
    const loser = m.players[1 - winnerSlot];
    const points = [0, 0];
    points[winner.slot] = C.WIN_POINTS;
    points[loser.slot] = reason === "FORFEIT" ? 0 : C.LOSS_POINTS;
    const payload = {
      matchId: m.id,
      reason,
      leaverSlot,
      winnerSlot,
      scores: [m.players[0].score, m.players[1].score],
      stats: m.players.map((p) => ({ goals: p.goals, saves: p.saves, misses: p.misses })),
      points,
      history: m.history,
      players: m.players.map((p) => ({ slot: p.slot, userId: p.userId, username: p.username, sex: p.sex, image: p.image })),
    };
    let saved = false;
    for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
      try {
        await db.finishMatch({
          matchId: m.id,
          winnerId: winner.userId,
          reason,
          totalRounds: m.round,
          players: m.players.map((p) => ({
            userId: p.userId,
            score: p.score,
            goals: p.goals,
            saves: p.saves,
            misses: p.misses,
            points: points[p.slot],
          })),
        });
        saved = true;
      } catch (err) {
        console.error("Failed to store match result:", err.message);
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    for (const p of m.players) {
      this.finished.set(p.userId, payload);
      this.toUser(p.userId, "match:finished", payload);
    }
    this.emitState(m);
    setTimeout(() => {
      this.matches.delete(m.id);
      for (const p of m.players) if (this.finished.get(p.userId) === payload) this.finished.delete(p.userId);
    }, FINISHED_KEEP_MS).unref();
  }

  abort(m, reason, notifySlot) {
    if (m.state === "FINISHED") return;
    this.clearTimers(m);
    if (m.waitTimer) clearTimeout(m.waitTimer);
    m.state = "FINISHED";
    for (const p of m.players) {
      if (p.graceTimer) clearTimeout(p.graceTimer);
      this.userMatch.delete(p.userId);
    }
    db.cancelMatch(m.id).catch((err) => console.error("Failed to cancel match:", err.message));
    for (const p of m.players) {
      if (notifySlot === null || p.slot === notifySlot) this.toUser(p.userId, "match:aborted", { matchId: m.id, reason });
    }
    this.matches.delete(m.id);
    this.broadcastLobby();
  }

  leave(user) {
    const m = this.matches.get(this.userMatch.get(user.id));
    if (!m) return { left: false };
    const me = this.playerOf(m, user.id);
    this.leaveInternal(m, me, "OPPONENT_LEFT");
    return { left: true };
  }

  leaveInternal(m, me, abortReason) {
    if (m.state === "WAITING") {
      this.abort(m, "CANCELLED", null);
      return;
    }
    if (m.state === "FINISHED") return;
    if (m.rounds.length < 2) {
      this.abort(m, abortReason, 1 - me.slot);
      this.toUser(me.userId, "match:aborted", { matchId: m.id, reason: "YOU_LEFT" });
      return;
    }
    this.finish(m, { reason: "FORFEIT", winnerSlot: 1 - me.slot, leaverSlot: me.slot });
  }

  handleDisconnect(userId) {
    const m = this.matches.get(this.userMatch.get(userId));
    if (!m || m.state === "FINISHED") return;
    const me = this.playerOf(m, userId);
    if (!me) return;
    me.connected = false;
    if (m.state === "WAITING") {
      m.waitTimer = setTimeout(() => {
        if (m.state === "WAITING" && !me.connected) this.abort(m, "CANCELLED", null);
      }, WAIT_GRACE_MS);
      return;
    }
    this.toMatch(m, "match:opponent", { slot: me.slot, connected: false, graceMs: GRACE_MS });
    this.emitState(m);
    me.graceTimer = setTimeout(() => {
      if (!me.connected && m.state !== "FINISHED") this.leaveInternal(m, me, "OPPONENT_DISCONNECTED");
    }, GRACE_MS);
  }

  resume(user) {
    const m = this.matches.get(this.userMatch.get(user.id));
    if (!m) {
      const done = this.finished.get(user.id) || null;
      return { match: null, finished: done };
    }
    const me = this.playerOf(m, user.id);
    me.connected = true;
    if (me.graceTimer) {
      clearTimeout(me.graceTimer);
      me.graceTimer = null;
    }
    if (m.waitTimer) {
      clearTimeout(m.waitTimer);
      m.waitTimer = null;
    }
    if (m.state !== "WAITING") {
      this.toMatch(m, "match:opponent", { slot: me.slot, connected: true, graceMs: 0 });
      this.emitState(m);
    }
    return { match: { info: this.infoFor(m, user.id), state: this.stateOf(m) }, finished: null };
  }
}

module.exports = { MatchManager };
