// Bundles the shared 6v6 match engine (ES modules in game/soccer) into one CommonJS file the
// Node server can require. A prebuilt copy is committed in server/generated, so if esbuild is
// not installed the existing bundle is used.
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const out = path.join(root, "server", "generated", "soccerEngine.js");

try {
  const esbuild = require("esbuild");
  esbuild.buildSync({
    entryPoints: [path.join(root, "game", "soccer", "serverEntry.js")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: out,
    logLevel: "warning",
  });
  console.log("Match engine bundled.");
} catch (err) {
  if (fs.existsSync(out)) console.warn("esbuild unavailable, using the prebuilt match engine bundle.");
  else {
    console.error("Cannot build the match engine:", err.message);
    process.exit(1);
  }
}
