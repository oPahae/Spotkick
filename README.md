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
