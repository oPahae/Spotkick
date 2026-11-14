# Spot Kick

Real-time 1v1 multiplayer 3D penalty shootout for desktop browsers.

Next.js (Pages Router) and React Three Fiber on the front end, Express and Socket.IO on the back end, MySQL for persistence. The whole app runs as one Node process on one port.

## 1. Requirements

- Node.js 18.17 or newer
- MySQL 5.7+ or 8.x (MariaDB 10.5+ also works)

## 2. Installation

```
npm install
```

## 3. MySQL setup

Make sure a MySQL server is running and that you have a user that can create databases (for example `root`). Nothing needs to be created by hand: the database and all tables are created automatically.

## 4. Environment variables

```
cp .env.example .env
```

On Windows PowerShell use `copy .env.example .env`. Then edit `.env`:

| Variable | Meaning | Default |
| --- | --- | --- |
| PORT | HTTP port | 3000 |
| DB_HOST | MySQL host | 127.0.0.1 |
| DB_PORT | MySQL port | 3306 |
| DB_USER | MySQL user | root |
| DB_PASSWORD | MySQL password | empty |
| DB_NAME | Database name (created if missing) | spotkick |
| JWT_SECRET | Secret used to sign login tokens. Set a long random value. | dev-only value |

## 5. Database initialization

The server runs the schema (`server/schema.sql`, idempotent) on every start, so this step is optional. To initialize without starting the app:

```
npm run db:init
```

Tables: `users`, `matches`, `matchPlayers`, `matchRounds`. Any match left WAITING or IN_PROGRESS by a previous server run is marked CANCELLED on startup.

## 6. Development

```
npm run dev
```

Open http://localhost:3000, register two accounts (use two different browsers or one normal and one private window), host a match with one and join it with the other.

## 7. Production

```
npm run build
npm start
```

## 8. Project structure

```
server/          Express, Socket.IO, MySQL, physics and match logic
  index.js         entry point (Express + Next.js + Socket.IO on one port)
  auth.js          register, login, session routes (bcrypt + JWT)
  db.js            MySQL pool, schema bootstrap, queries and transactions
  matchManager.js  authoritative match state machine
  physics.js       server-side penalty simulation
  socket.js        Socket.IO authentication and event wiring
  schema.sql       database schema
shared/          constants used by both server and client (goal dimensions etc.)
pages/           Next.js Pages Router screens (index, login, register, home, lobby, game, leaderboard)
components/      shared UI components
game/            React Three Fiber scene: stadium, goal, players, ball, camera, HUD
lib/             API client, auth and match contexts, socket service, synthesized audio
styles/          Tailwind entry stylesheet
```

## 8b. Single player 6v6 match (new)

Open `/match` (button "Match single player" on the home page). Nothing to set up on the server: the match runs entirely in the browser.

- Pick your position (left winger, right winger, striker, left back, right back), the difficulty (easy / medium / hard), the match length (3, 5 or 8 minutes) and the mouse sensitivity.
- You play one outfield player of the blue team in first person. The mouse is captured and the crosshair stays in the centre of the screen. Your four teammates (yellow triangle above their heads), the blue keeper and the whole red team are AI.
- Controls: `W A S D` run, `Shift` sprint (stamina), mouse look/aim, hold left click then release to shoot (the ball goes where the crosshair points, hold longer for more power), right click short pass, `E` long pass (look higher for more distance), `R` or `Space` call for the ball, left click without the ball to tackle. A teammate under the crosshair is aimed at automatically and the crosshair turns green. `Esc` pauses.
- Rules: goals, throw-ins, corners and goal kicks. There are no fouls or offsides.
- AI (`game/soccer/ai.js`): carriers weigh shooting, passing and dribbling (expected goal value, passing lane safety from opponent interception times, receiver freedom, progress, pressure). Off the ball, attackers search open spaces inside their role zone, defenders press the carrier, cover, mark and cut passing lanes, and everyone predicts the ball path to intercept it. Keepers position along the ball-goal line, react with a delay, dive and catch or parry depending on shot speed.
- Engine and rendering: `game/soccer/engine.js` (physics, rules, human control), `game/soccer/ai.js`, `soccerScene.jsx`, `soccerPitch.jsx`, `soccerView.jsx` (pointer lock, HUD, radar).

### Party mode (up to 6 players on the same team)

On `/match`, open the "Party" tab: create a party, then invite friends by sharing the 6 character code or the invite link (`/match?party=CODE`), or by typing the username of a player who is online (they get an invitation popup anywhere in the app). Each player picks a free position (GK, LB, RB, LW, RW, ST). The host chooses the difficulty and the length and starts the match. Everybody plays in first person on the blue team against the red AI; positions nobody took are played by the AI. A player who disconnects is replaced by the AI and takes his place back when he reconnects.

- The match is simulated on the server (`server/partyManager.js`) with the same engine as solo mode (`game/soccer/engine.js`). `scripts/buildEngine.js` bundles that engine into `server/generated/soccerEngine.js` (run automatically by `npm run dev`, `npm run build` and `npm start`; a prebuilt copy is included).
- Socket events: `party:create`, `party:join`, `party:leave`, `party:role`, `party:settings`, `party:invite`, `party:start`, `party:rematch`, `party:resume`, `party:input` (client to server) and `party:state`, `party:invite`, `party:start`, `party:snap` (20 per second), `party:finished`, `party:lobby`, `party:closed` (server to client). The client (`game/soccer/netMatch.js`) smooths the snapshots.
- Goalkeeper controls: move with `WASD`, hold `A` or `D` and left click to dive; the ball is caught or parried by hand.

## 9. Game rules

- Two players alternate as shooter and goalkeeper. Each takes 5 penalties (10 rounds).
- Most goals after 5 each wins. If level, another 5 each are played, repeated until someone leads after a full set.
- The shooter clicks a point around the goal. The goalkeeper clicks the point to dive to. Nobody sees the other choice before the shot is resolved.
- A round has 15 seconds for the shot. If a player does not act in time the server picks a random shot or a central stand.
- Results: GOAL, SAVED, MISS, POST, CROSSBAR. A ball that hits the woodwork and still crosses the line is a goal.
- Winner earns 100 points, loser 25. Leaving or disconnecting for more than 25 seconds forfeits (winner 100, leaver 0). Leaving before two rounds are played cancels the match with no points.
- Goal is 7.32 m by 2.44 m and the penalty spot is 11 m from the goal line.

## 10. Multiplayer architecture

- The server holds all match state in memory and is the only source of truth for membership, roles, score, round progression and winner.
- Joining is guarded three times: a synchronous reservation in memory, a conditional `UPDATE ... WHERE status = 'WAITING'` in a transaction, and a unique `(matchId, slot)` key in MySQL. A match can never hold a third player.
- State machine: WAITING, COUNTDOWN, SHOOTING, GOALKEEPING, RESOLVING, ROUND_RESULT, NEXT_ROUND, FINISHED. Events outside the correct state or from the wrong role are rejected.
- When both choices are in, the server simulates the ball (gravity, curved flight, noise, bounces, post and crossbar collisions, keeper capsule, net) and sends the sampled trajectory plus the result to both clients. Clients only play it back, so both always see the same outcome.
- Players reconnect by refreshing: the socket re-authenticates and `match:resume` restores the match.
- Socket events: `lobby:subscribe`, `match:create`, `match:join`, `match:leave`, `match:resume`, `game:shoot`, `game:dive` (client to server) and `lobby:list`, `match:info`, `match:state`, `round:resolve`, `match:opponent`, `match:finished`, `match:aborted` (server to client).
