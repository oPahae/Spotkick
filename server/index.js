require("dotenv").config();
const http = require("http");
const path = require("path");
const express = require("express");
const next = require("next");
const db = require("./db");
const auth = require("./auth");
const { attachSocket } = require("./socket");

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 3000);

async function main() {
  try {
    await db.connect();
    console.log("MySQL connected.");
  } catch (err) {
    console.error("\nCould not connect to MySQL:", err.message);
    console.error("Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD and DB_NAME in your .env file.\n");
    process.exit(1);
  }

  const server = http.createServer();
  const nextApp = next({ dev, dir: path.join(__dirname, ".."), httpServer: server });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "250kb" }));

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", auth.router);

  app.get("/api/leaderboard", async (req, res, next2) => {
    try {
      const rows = await db.leaderboard(req.query.limit);
      res.json({ players: rows.map((r) => ({ ...auth.publicUser(r), rank: r.rank })) });
    } catch (err) {
      next2(err);
    }
  });

  app.use("/api", (req, res) => res.status(404).json({ code: "NOT_FOUND", message: "Not found." }));
  app.use((err, req, res, nextFn) => {
    if (res.headersSent) return nextFn(err);
    if (err && err.type === "entity.too.large") {
      return res.status(413).json({ code: "TOO_LARGE", message: "That upload is too large." });
    }
    if (err && err.type === "entity.parse.failed") {
      return res.status(400).json({ code: "BAD_JSON", message: "Invalid request." });
    }
    console.error("Request error:", err && err.message);
    const unavailable = err && (err.code === "ECONNREFUSED" || err.code === "PROTOCOL_CONNECTION_LOST");
    return res.status(unavailable ? 503 : 500).json({
      code: unavailable ? "DB_UNAVAILABLE" : "SERVER_ERROR",
      message: unavailable ? "The database is unavailable. Try again shortly." : "Something went wrong on the server.",
    });
  });
  app.all("*", (req, res) => handle(req, res));

  server.on("request", app);
  attachSocket(server);

  server.listen(port, () => {
    console.log(`Spot Kick ready on http://localhost:${port} (${dev ? "development" : "production"})`);
  });

  const shutdown = async () => {
    await db.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
