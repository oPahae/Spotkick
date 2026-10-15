const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const db = require("./db");

const SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: "RATE_LIMITED", message: "Too many attempts. Wait a minute and try again." },
});

const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_CHARS = 140000;

function fail(res, status, code, message, fields) {
  return res.status(status).json({ code, message, fields });
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    sex: row.sex,
    image: row.image || null,
    score: row.score,
    wins: row.wins,
    losses: row.losses,
    matchesPlayed: row.matchesPlayed,
  };
}

function signToken(userId) {
  return jwt.sign({ uid: userId }, SECRET, { expiresIn: "30d" });
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, SECRET);
    return payload.uid;
  } catch (err) {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const uid = token ? verifyToken(token) : null;
  if (!uid) return fail(res, 401, "UNAUTHORIZED", "Your session has expired. Sign in again.");
  try {
    const user = await db.findUserById(uid);
    if (!user) return fail(res, 401, "UNAUTHORIZED", "Your session has expired. Sign in again.");
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const body = req.body || {};
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const sex = body.sex;
    const image = body.image || null;
    const fields = {};
    if (!USERNAME_RE.test(username)) fields.username = "Use 3 to 16 letters, numbers or underscores.";
    if (password.length < 6 || password.length > 64) fields.password = "Use 6 to 64 characters.";
    if (sex !== "male" && sex !== "female") fields.sex = "Choose one option.";
    if (image !== null) {
      if (typeof image !== "string" || image.length > MAX_IMAGE_CHARS || !IMAGE_RE.test(image)) {
        fields.image = "Use a PNG, JPEG or WebP image under 100 KB.";
      }
    }
    if (Object.keys(fields).length) return fail(res, 400, "VALIDATION", "Check the highlighted fields.", fields);

    const existing = await db.findUserByUsername(username);
    if (existing) return fail(res, 409, "USERNAME_TAKEN", "That username is already taken.", { username: "That username is already taken." });

    const passwordHash = await bcrypt.hash(password, 10);
    let user;
    try {
      user = await db.createUser({ username, passwordHash, sex, image });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return fail(res, 409, "USERNAME_TAKEN", "That username is already taken.", { username: "That username is already taken." });
      }
      throw err;
    }
    return res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const body = req.body || {};
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) return fail(res, 400, "VALIDATION", "Enter your username and password.");
    const row = await db.findUserByUsername(username);
    const ok = row ? await bcrypt.compare(password, row.passwordHash) : false;
    if (!ok) return fail(res, 401, "INVALID_CREDENTIALS", "Wrong username or password.");
    return res.json({ token: signToken(row.id), user: publicUser(row) });
  } catch (err) {
    return next(err);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const rank = await db.rankOf(req.user.id);
    res.json({ user: { ...publicUser(req.user), rank } });
  } catch (err) {
    next(err);
  }
});

module.exports = { router, requireAuth, verifyToken, publicUser };
