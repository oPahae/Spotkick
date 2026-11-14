// Co-op parties: up to 6 players share the blue team of a 6v6 match against the computer.
// The server owns the simulation (same engine as the single player mode) and streams snapshots.
const crypto = require("crypto");

const ROLES = ["GK", "LB", "RB", "LW", "RW", "ST"];
const MAX_MEMBERS = 6;
const TICK_MS = 50;
const DIFFICULTIES = ["easy", "medium", "hard"];
const LENGTHS = [3, 5, 8];
const FINISHED_KEEP_MS = 10 * 60 * 1000;

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

const num = (v, lo, hi, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

function newCode(existing) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let tries = 0; tries < 50; tries += 1) {
    const bytes = crypto.randomBytes(6);
    let code = "";
    for (let i = 0; i < 6; i += 1) code += alphabet[bytes[i] % alphabet.length];
    if (!existing.has(code)) return code;
  }
  throw fail("SERVER_ERROR", "Could not create a party code.");
}

class PartyManager {
  constructor(io) {
    this.io = io;
    this.parties = new Map();
    this.userParty = new Map();
    this.invites = new Map(); // `${toUserId}:${code}` -> expiry
  }

  toUser(userId, event, payload) {
    this.io.to(`user:${userId}`).emit(event, payload);
  }

  publicMember(m) {
    return { userId: m.userId, username: m.username, sex: m.sex, image: m.image, role: m.role, connected: m.connected };
  }

  stateOf(party) {
    return {
      code: party.code,
      hostId: party.hostId,
      status: party.status,
      settings: party.settings,
      members: party.members.map((m) => this.publicMember(m)),
      max: MAX_MEMBERS,
    };
  }

  broadcast(party) {
    this.io.to(`party:${party.code}`).emit("party:state", this.stateOf(party));
  }

  partyOf(userId) {
    const code = this.userParty.get(userId);
    return code ? this.parties.get(code) || null : null;
  }

  member(party, userId) {
    return party.members.find((m) => m.userId === userId) || null;
  }

  attach(socket, party) {
    socket.join(`party:${party.code}`);
  }

  // ----- lobby -----
  create(user, socket) {
    if (this.partyOf(user.id)) this.leave(user);
    const code = newCode(this.parties);
    const party = {
      code,
      hostId: user.id,
      status: "lobby",
      settings: { difficulty: "medium", minutes: 5 },
      members: [],
      match: null,
      timer: null,
      roleToPlayer: new Map(),
      lastTick: 0,
      createdAt: Date.now(),
    };
    party.members.push({ userId: user.id, username: user.username, sex: user.sex, image: user.image || null, role: null, connected: true, playerId: null });
    this.parties.set(code, party);
    this.userParty.set(user.id, code);
    this.attach(socket, party);
    this.broadcast(party);
    return { party: this.stateOf(party) };
  }

  join(user, socket, rawCode) {
    const code = String(rawCode || "").trim().toUpperCase();
    const party = this.parties.get(code);
    if (!party) throw fail("NOT_FOUND", "This party does not exist anymore.");
    const existing = this.partyOf(user.id);
    if (existing && existing.code !== code) this.leave(user);
    let m = this.member(party, user.id);
    if (!m) {
      if (party.status !== "lobby") throw fail("IN_PROGRESS", "This party already started.");
      if (party.members.length >= MAX_MEMBERS) throw fail("FULL", "This party is full (6 players).");
      m = { userId: user.id, username: user.username, sex: user.sex, image: user.image || null, role: null, connected: true, playerId: null };
      party.members.push(m);
    }
    m.connected = true;
    this.userParty.set(user.id, code);
    this.attach(socket, party);
    this.broadcast(party);
    return { party: this.stateOf(party) };
  }

  leave(user, socket) {
    const party = this.partyOf(user.id);
    if (!party) return {};
    this.userParty.delete(user.id);
    if (socket) socket.leave(`party:${party.code}`);
    else this.io.in(`user:${user.id}`).socketsLeave(`party:${party.code}`);
    const m = this.member(party, user.id);
    if (party.status === "playing") {
      if (m && m.playerId !== null && party.match) party.match.setHuman(m.playerId, false);
      party.members = party.members.filter((x) => x.userId !== user.id);
      if (!party.members.some((x) => x.connected)) this.destroy(party);
      else this.broadcast(party);
      return {};
    }
    party.members = party.members.filter((x) => x.userId !== user.id);
    if (party.members.length === 0) {
      this.destroy(party);
      return {};
    }
    if (party.hostId === user.id) party.hostId = party.members[0].userId;
    if (party.status === "finished") this.resetToLobby(party);
    this.broadcast(party);
    return {};
  }

  destroy(party) {
    if (party.timer) clearInterval(party.timer);
    party.timer = null;
    party.match = null;
    party.members.forEach((m) => this.userParty.delete(m.userId));
    this.io.in(`party:${party.code}`).emit("party:closed", { code: party.code });
    this.io.in(`party:${party.code}`).socketsLeave(`party:${party.code}`);
    this.parties.delete(party.code);
  }

  setRole(user, role) {
    const party = this.partyOf(user.id);
    if (!party) throw fail("NOT_FOUND", "You are not in a party.");
    if (party.status !== "lobby") throw fail("IN_PROGRESS", "The match already started.");
    const m = this.member(party, user.id);
    if (role === null || role === undefined || role === "") {
      m.role = null;
    } else {
      if (!ROLES.includes(role)) throw fail("BAD_INPUT", "Unknown position.");
      const taken = party.members.find((x) => x.role === role && x.userId !== user.id);
      if (taken) throw fail("TAKEN", `${taken.username} already plays this position.`);
      m.role = role;
    }
    this.broadcast(party);
    return {};
  }

  setSettings(user, s) {
    const party = this.partyOf(user.id);
    if (!party) throw fail("NOT_FOUND", "You are not in a party.");
    if (party.hostId !== user.id) throw fail("FORBIDDEN", "Only the host can change the settings.");
    if (party.status !== "lobby") throw fail("IN_PROGRESS", "The match already started.");
    if (DIFFICULTIES.includes(s.difficulty)) party.settings.difficulty = s.difficulty;
    if (LENGTHS.includes(Number(s.minutes))) party.settings.minutes = Number(s.minutes);
    this.broadcast(party);
    return {};
  }

  invite(user, username) {
    const party = this.partyOf(user.id);
    if (!party) throw fail("NOT_FOUND", "Create a party first.");
    if (party.status !== "lobby") throw fail("IN_PROGRESS", "The match already started.");
    const name = String(username || "").trim().toLowerCase();
    if (!name) throw fail("BAD_INPUT", "Type a username.");
    let target = null;
    for (const s of this.io.sockets.sockets.values()) {
      const u = s.data && s.data.user;
      if (u && u.username.toLowerCase() === name) target = u;
    }
    if (!target) throw fail("OFFLINE", "This player is not online right now. Share the party link instead.");
    if (target.id === user.id) throw fail("BAD_INPUT", "You are already in the party.");
    if (this.member(party, target.id)) throw fail("BAD_INPUT", "This player is already in the party.");
    if (party.members.length >= MAX_MEMBERS) throw fail("FULL", "The party is full.");
    this.toUser(target.id, "party:invite", {
      code: party.code,
      from: { username: user.username, sex: user.sex, image: user.image || null },
    });
    return { invited: target.username };
  }

  // ----- match -----
  start(user) {
    const party = this.partyOf(user.id);
    if (!party) throw fail("NOT_FOUND", "You are not in a party.");
    if (party.hostId !== user.id) throw fail("FORBIDDEN", "Only the host can start the match.");
    if (party.status === "playing") throw fail("IN_PROGRESS", "The match already started.");
    if (party.status === "finished") this.resetToLobby(party);
    const noRole = party.members.filter((m) => !m.role);
    if (noRole.length) throw fail("NO_ROLE", `${noRole.map((m) => m.username).join(", ")} must pick a position first.`);
    const { Match } = require("./generated/soccerEngine");
    const humanRoles = party.members.map((m) => m.role);
    const match = new Match({ humanRoles, difficulty: party.settings.difficulty, minutes: party.settings.minutes, humanControlled: true });
    party.match = match;
    party.status = "playing";
    party.members.forEach((m) => {
      const p = match.players.find((x) => x.team === 0 && x.role === m.role);
      m.playerId = p.id;
    });
    party.lastTick = Date.now();
    party.timer = setInterval(() => this.tick(party), TICK_MS);
    this.broadcast(party);
    party.members.forEach((m) => this.toUser(m.userId, "party:start", this.startPayload(party, m)));
    return {};
  }

  startPayload(party, m) {
    const names = new Map(party.members.map((x) => [x.playerId, x.username]));
    return {
      code: party.code,
      myPlayerId: m.playerId,
      total: party.match.total,
      players: party.match.players.map((p) => ({ id: p.id, team: p.team, role: p.role, isGK: p.isGK, name: names.get(p.id) || null })),
      snap: party.match.serialize(),
    };
  }

  tick(party) {
    const match = party.match;
    if (!match) return;
    const now = Date.now();
    const dt = Math.min(0.1, (now - party.lastTick) / 1000);
    party.lastTick = now;
    try {
      match.step(dt);
    } catch (err) {
      console.error("Party match error:", err && err.stack);
      this.finish(party, true);
      return;
    }
    const events = match.events.splice(0, match.events.length).filter((e) => e.type !== "bounce" || e.v > 2.5);
    const snap = match.serialize();
    snap.ev = events;
    this.io.to(`party:${party.code}`).emit("party:snap", snap);
    if (match.ended) this.finish(party, false);
  }

  finish(party, aborted) {
    if (party.timer) clearInterval(party.timer);
    party.timer = null;
    party.status = "finished";
    this.io.to(`party:${party.code}`).emit("party:finished", { aborted, score: party.match ? party.match.score : [0, 0] });
    party.finishedAt = Date.now();
    this.broadcast(party);
    setTimeout(() => {
      const p = this.parties.get(party.code);
      if (p && p.status === "finished" && p.finishedAt === party.finishedAt) this.destroy(p);
    }, FINISHED_KEEP_MS).unref();
  }

  resetToLobby(party) {
    party.status = "lobby";
    party.match = null;
    party.members.forEach((m) => { m.playerId = null; });
    party.members = party.members.filter((m) => m.connected);
    if (!party.members.some((m) => m.userId === party.hostId)) party.hostId = party.members[0] ? party.members[0].userId : null;
  }

  rematch(user) {
    const party = this.partyOf(user.id);
    if (!party) throw fail("NOT_FOUND", "You are not in a party.");
    if (party.hostId !== user.id) throw fail("FORBIDDEN", "Only the host can start a new match.");
    if (party.status !== "finished") return {};
    this.resetToLobby(party);
    this.broadcast(party);
    this.io.to(`party:${party.code}`).emit("party:lobby", {});
    return {};
  }

  input(user, d) {
    const party = this.partyOf(user.id);
    if (!party || party.status !== "playing" || !party.match) return;
    const m = this.member(party, user.id);
    if (!m || m.playerId === null) return;
    const p = party.match.players[m.playerId];
    if (!p || !p.human) return;
    const inp = p.input;
    inp.mx = num(d.mx, -1, 1);
    inp.mz = num(d.mz, -1, 1);
    inp.yaw = num(d.yaw, -1e4, 1e4, inp.yaw);
    inp.pitch = num(d.pitch, -1.35, 1.35, inp.pitch);
    inp.sprint = !!d.sprint;
    inp.fireDown = !!d.fireDown;
    if (d.fireUp) inp.fireUp = true;
    if (d.pass) inp.pass = true;
    if (d.lob) inp.lob = true;
    if (d.tackle) inp.tackle = true;
    if (d.call) inp.call = true;
  }

  // reconnecting during a match: take the player back from the AI
  resume(user, socket) {
    const party = this.partyOf(user.id);
    if (!party) return {};
    const m = this.member(party, user.id);
    this.attach(socket, party);
    m.connected = true;
    if (party.status === "playing" && party.match && m.playerId !== null) {
      party.match.setHuman(m.playerId, true);
      this.broadcast(party);
      return { party: this.stateOf(party), start: this.startPayload(party, m) };
    }
    this.broadcast(party);
    return { party: this.stateOf(party) };
  }

  handleDisconnect(userId) {
    const party = this.partyOf(userId);
    if (!party) return;
    const m = this.member(party, userId);
    if (!m) return;
    if (party.status === "playing") {
      m.connected = false;
      if (m.playerId !== null && party.match) party.match.setHuman(m.playerId, false);
      if (!party.members.some((x) => x.connected)) this.destroy(party);
      else this.broadcast(party);
    } else {
      this.leave({ id: userId });
    }
  }
}

module.exports = { PartyManager, ROLES };
