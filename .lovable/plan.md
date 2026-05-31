# play.withme MVP 1 — Build Plan

## Stack decisions (locked from your answers)
- **DB**: MongoDB Atlas **Data API** (HTTPS) — works on Cloudflare Workers. Native `mongodb` driver removed.
- **Realtime**: **Pusher Channels** (cluster `eu`). Public key/cluster shipped to browser via a tiny server fn; `PUSHER_SECRET` stays server-only for `trigger()`.
- **Frontend**: TanStack Start (existing). Tailwind v4 + shadcn (existing).
- **Video export**: Canvas + `MediaRecorder` + `canvas.captureStream()`, client-side only.

## Routes
```
/                       Landing — brand, slogan "Play with ME", "Create a Match"
/g/$sessionId           Game screen (host + guest enter here; role inferred)
/g/$sessionId/result    Post-game message + Export as Video (same 9:16 frame)
```
All wrapped in a centered 9:16 frame (`GameFrame` layout component) on desktop + mobile.

## Server functions (`src/lib/games/*.functions.ts`)
- `createSession({ nickname, localUserId, timingMode, turnSeconds? })` → `{ sessionId }`
- `getSession({ sessionId, localUserId })` → returns session + derived role (`host` | `player` | `spectator` | `full`)
- `joinSession({ sessionId, localUserId, nickname })` → claims player slot (idempotent for same `localUserId`)
- `playMove({ sessionId, localUserId, cellIndex })` → validates turn, updates state, computes win/draw, triggers Pusher
- `forfeitSession({ sessionId, localUserId })` → forfeit, triggers Pusher
- `tickTimeout({ sessionId, localUserId })` → host-driven timeout for timed mode (browser calls when local timer hits 0)

All write through `src/lib/mongo/data-api.server.ts` (a thin Atlas Data API fetch wrapper using `MONGODB_DATA_API_URL/KEY/SOURCE/DB`).

## Realtime
- Channel per session: `game-${sessionId}` (public channel for MVP; state is non-sensitive game moves).
- Events: `state:update`, `player:joined`, `game:finished`.
- Server fn calls `pusher.trigger()` after every state mutation.
- Client subscribes via `pusher-js` in the game screen and merges into local state.
- `GET /api/realtime-config` server route returns `{ key, cluster }` so the client can init Pusher without baking secrets at build time.

## Local identity
- `useLocalProfile()` hook → `localStorage` keys: `pwm:userId` (uuid), `pwm:nickname`.
- Nickname gate on landing + on `/g/...` join.
- Avatar = first character, uppercase.

## Mongo doc shape
Single collection `sessions`, doc shape from spec §16. TTL via `expiresAt` field (Atlas TTL index — user can add manually; we'll set the field).

## Game screen layout (9:16)
- Header: `play.withme · TicTacToe` + `[X]` exit (confirm → forfeit).
- Player row: `[H] hostName  VS  [P] playerName` (placeholder for missing player).
- Winner progress bar (heuristic from spec §15).
- Time progress bar (timed only).
- 3×3 board (large tap targets).
- Bottom: banner ad placeholder + minimal controls.

## Replay events (client-only)
Local array of `ReplayEvent` populated on each `state:update`. Used solely by video exporter.

## Post-game / Export
- Result text + message input (winner: "Victory message", loser: "Celebrate message"; defaults from spec §20–21; 80-char cap).
- "Export as Video" → show full-screen ad/loading overlay "Preparing your replay video…"
- `VideoExporter`: offscreen 1080×1920 canvas, `requestAnimationFrame` loop driving scenes:
  1. Opening with winner message over board
  2. Move-by-move replay (~8–15s total)
  3. Loser celebrate message over board
  4. End screen fade-to-black `play.withme` / `Play with ME`
- Capture stream → `MediaRecorder` (`video/mp4` if supported, else `video/webm`) → blob → trigger download.

## Guard / edge cases
- `/g/$sessionId` with no slot taken and `localUserId !== host` → calls `joinSession`.
- Third visitor → "Game already in progress" screen with ad + "Start your own match".
- Expired/finished/missing → friendly messages.
- Refresh ≠ forfeit; only `[X]` confirm + Leave does.
- Timeout strikes: 3 → loss.

## Files to create
```
src/lib/mongo/data-api.server.ts          Atlas Data API wrapper
src/lib/realtime/pusher.server.ts         server Pusher client
src/lib/realtime/usePusher.ts             client subscribe hook
src/lib/games/tictactoe/engine.ts         pure rules (winner, advantage heuristic)
src/lib/games/tictactoe/types.ts          shared types
src/lib/games/tictactoe/session.functions.ts   createSession/getSession/joinSession/playMove/forfeitSession/tickTimeout
src/lib/profile/useLocalProfile.ts        nickname + uuid
src/components/GameFrame.tsx              9:16 container
src/components/Avatar.tsx
src/components/WinnerProgressBar.tsx
src/components/TimeProgressBar.tsx
src/components/AdSlot.tsx
src/components/board/TicTacToeBoard.tsx
src/components/exit/ExitConfirm.tsx
src/components/video/VideoExporter.ts     canvas scene engine + MediaRecorder
src/routes/index.tsx                      landing (replace placeholder)
src/routes/g.$sessionId.tsx               game screen
src/routes/g.$sessionId.result.tsx        post-game/export
src/routes/api/realtime-config.ts         GET → { key, cluster }
```
Files to remove: `src/lib/mongo.server.ts` (replaced).
Packages: `pusher`, `pusher-js`. (No native `mongodb` driver needed.)

## Out of scope (per spec §2 Excluded)
Auth, persistent profiles, lobby, chat, scoreboard, server-side video, push notifications.

## Notes / caveats
- **Atlas Data API is being deprecated by MongoDB (sunset Sept 2025).** Works today but you'll want to migrate to a hosted API (or an HTTP proxy in front of the driver) eventually. Flagging now so you can plan.
- **MP4 recording** is Chromium-only via `MediaRecorder`; Firefox/Safari will get WebM. Acceptable per spec §24.
- Pusher free tier: 200k msgs/day, 100 concurrent. Plenty for MVP.

Reply **go** and I'll build it.
