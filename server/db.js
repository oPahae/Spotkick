const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const dbName = process.env.DB_NAME || "spotkick";
const baseConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
};

let pool = null;

async function initSchema() {
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error("DB_NAME may only contain letters, numbers and underscores");
  const conn = await mysql.createConnection({ ...baseConfig, multipleStatements: true });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${dbName}\``);
    await conn.query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  } finally {
    await conn.end();
  }
}

async function connect() {
  await initSchema();
  pool = mysql.createPool({
    ...baseConfig,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
  });
  await pool.query("SELECT 1");
  await pool.query("UPDATE matches SET status = 'CANCELLED' WHERE status IN ('WAITING','IN_PROGRESS')");
  return pool;
}

function db() {
  if (!pool) throw new Error("Database is not connected");
  return pool;
}

const userColumns = "id, username, sex, image, score, wins, losses, matchesPlayed, createdAt";

async function createUser({ username, passwordHash, sex, image }) {
  const [res] = await db().execute(
    "INSERT INTO users (username, passwordHash, sex, image) VALUES (?, ?, ?, ?)",
    [username, passwordHash, sex, image || null]
  );
  return findUserById(res.insertId);
}

async function findUserByUsername(username) {
  const [rows] = await db().execute("SELECT * FROM users WHERE username = ? LIMIT 1", [username]);
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await db().execute(`SELECT ${userColumns} FROM users WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function leaderboard(limit) {
  const safe = Math.max(1, Math.min(100, Number(limit) || 10));
  const [rows] = await db().query(
    `SELECT ${userColumns} FROM users ORDER BY score DESC, wins DESC, id ASC LIMIT ${safe}`
  );
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

async function rankOf(userId) {
  const [rows] = await db().execute(
    `SELECT COUNT(*) + 1 AS rank_ FROM users u, (SELECT score, wins, id FROM users WHERE id = ?) me
     WHERE u.score > me.score OR (u.score = me.score AND u.wins > me.wins) OR (u.score = me.score AND u.wins = me.wins AND u.id < me.id)`,
    [userId]
  );
  return rows[0] ? Number(rows[0].rank_) : null;
}

async function createMatch(userId) {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.execute("INSERT INTO matches (status) VALUES ('WAITING')");
    await conn.execute("INSERT INTO matchPlayers (matchId, playerId, slot) VALUES (?, ?, 0)", [res.insertId, userId]);
    await conn.commit();
    return res.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function attachSecondPlayer(matchId, userId) {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [upd] = await conn.execute(
      "UPDATE matches SET status = 'IN_PROGRESS', startedAt = CURRENT_TIMESTAMP WHERE id = ? AND status = 'WAITING'",
      [matchId]
    );
    if (upd.affectedRows !== 1) {
      const err = new Error("Match is no longer available");
      err.code = "MATCH_UNAVAILABLE";
      throw err;
    }
    await conn.execute("INSERT INTO matchPlayers (matchId, playerId, slot) VALUES (?, ?, 1)", [matchId, userId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (err.code === "ER_DUP_ENTRY") {
      const e = new Error("Match is no longer available");
      e.code = "MATCH_UNAVAILABLE";
      throw e;
    }
    throw err;
  } finally {
    conn.release();
  }
}

async function cancelMatch(matchId) {
  await db().execute("UPDATE matches SET status = 'CANCELLED', finishedAt = CURRENT_TIMESTAMP WHERE id = ? AND status <> 'FINISHED'", [matchId]);
}

async function insertRound(round) {
  await db().execute(
    `INSERT INTO matchRounds (matchId, roundNumber, shooterId, goalkeeperId, result, shotTargetX, shotTargetY, goalkeeperTargetX, goalkeeperTargetY)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [round.matchId, round.roundNumber, round.shooterId, round.goalkeeperId, round.result, round.shotX, round.shotY, round.keeperX, round.keeperY]
  );
}

async function finishMatch({ matchId, winnerId, reason, totalRounds, players }) {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      "UPDATE matches SET status = 'FINISHED', finishedAt = CURRENT_TIMESTAMP, winnerId = ?, endReason = ?, totalRounds = ? WHERE id = ?",
      [winnerId, reason, totalRounds, matchId]
    );
    for (const p of players) {
      await conn.execute(
        "UPDATE matchPlayers SET score = ?, goals = ?, saves = ?, misses = ?, pointsAwarded = ? WHERE matchId = ? AND playerId = ?",
        [p.score, p.goals, p.saves, p.misses, p.points, matchId, p.userId]
      );
      await conn.execute(
        "UPDATE users SET score = score + ?, wins = wins + ?, losses = losses + ?, matchesPlayed = matchesPlayed + 1 WHERE id = ?",
        [p.points, p.userId === winnerId ? 1 : 0, p.userId === winnerId ? 0 : 1, p.userId]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function wake() {
  await db().execute("SELECT * FROM users LIMIT 1");
  return { status: "ok" };
}

async function close() {
  if (pool) await pool.end();
  pool = null;
}

module.exports = {
  connect,
  initSchema,
  close,
  createUser,
  findUserByUsername,
  findUserById,
  leaderboard,
  rankOf,
  createMatch,
  attachSecondPlayer,
  cancelMatch,
  insertRound,
  finishMatch,
  wake,
};
