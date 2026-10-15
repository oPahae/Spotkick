const { Server } = require("socket.io");
const db = require("./db");
const { verifyToken } = require("./auth");
const { MatchManager } = require("./matchManager");

function wrap(fn) {
  return async (payload, ack) => {
    if (typeof payload === "function") {
      ack = payload;
      payload = {};
    }
    const reply = typeof ack === "function" ? ack : () => {};
    try {
      const data = await fn(payload || {});
      reply({ ok: true, ...(data || {}) });
    } catch (err) {
      if (err && err.code && !err.sqlMessage) {
        reply({ ok: false, error: err.code, message: err.message });
      } else {
        console.error("Socket handler error:", err && err.message);
        reply({ ok: false, error: "SERVER_ERROR", message: "Something went wrong on the server. Try again." });
      }
    }
  };
}

function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    serveClient: false,
    pingInterval: 10000,
    pingTimeout: 8000,
    maxHttpBufferSize: 1e5,
  });
  const manager = new MatchManager(io);
  const sockets = new Map();

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      const uid = typeof token === "string" ? verifyToken(token) : null;
      if (!uid) return next(new Error("AUTH"));
      const user = await db.findUserById(uid);
      if (!user) return next(new Error("AUTH"));
      socket.data.user = user;
      return next();
    } catch (err) {
      return next(new Error("SERVER"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    const previous = sockets.get(user.id);
    if (previous && previous.id !== socket.id) {
      previous.emit("session:replaced");
      previous.disconnect(true);
    }
    sockets.set(user.id, socket);
    socket.join(`user:${user.id}`);

    const fresh = async () => (await db.findUserById(user.id)) || user;

    socket.on("lobby:subscribe", wrap(async () => {
      socket.join("lobby");
      return { list: manager.lobbyList() };
    }));
    socket.on("lobby:unsubscribe", wrap(async () => {
      socket.leave("lobby");
      return {};
    }));
    socket.on("match:create", wrap(async () => manager.create(await fresh())));
    socket.on("match:join", wrap(async (p) => manager.join(await fresh(), p.matchId)));
    socket.on("match:leave", wrap(async () => manager.leave(user)));
    socket.on("match:resume", wrap(async () => manager.resume(user)));
    socket.on("game:shoot", wrap(async (p) => {
      manager.shoot(user, p);
      return {};
    }));
    socket.on("game:dive", wrap(async (p) => {
      manager.dive(user, p);
      return {};
    }));

    socket.on("disconnect", () => {
      if (sockets.get(user.id) === socket) {
        sockets.delete(user.id);
        manager.handleDisconnect(user.id);
      }
    });
  });

  return { io, manager };
}

module.exports = { attachSocket };
