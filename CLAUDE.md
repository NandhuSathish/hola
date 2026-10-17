# holla! — Claude Code guide

holla! is a browser party game with built-in voice chat for one friend group.
The first (and for now only) game is **Last Card**, an Uno-style card game for 2–15 players.
More small games will be added later as plug-in modules.

This is a personal project. Optimise for: fun, simple code, free hosting, works great on phones.
Do not add accounts, databases, analytics, payments or anything "for scale".

Read `REFERENCE.md` for the full spec (rules, socket events, module interface, voice flow, design tokens).
The visual source of truth is `design/holla-mock.html` — open it before building any screen.

## Stack

- **Monorepo with npm workspaces:** `client/`, `server/`, `shared/`
- **Language:** TypeScript everywhere (strict mode)
- **client:** Vite + React. Plain CSS with CSS variables (copy tokens from the mock). No UI kit, no Tailwind.
- **server:** Node + Express + Socket.io. Serves the built client in production.
- **shared:** game engine modules, shared types, socket event types
- **Voice:** LiveKit (`livekit-client` in the browser, `livekit-server-sdk` on the server for tokens)
- **Tests:** Vitest (game engine must be well tested)
- **Hosting:** one Render free web service (build client, start server)
- Use the latest stable versions of packages. Check docs when unsure about an API — don't guess.

## Folder layout

```
holla/
  CLAUDE.md  REFERENCE.md  README.md  .env.example  .gitignore
  design/holla-mock.html        # UI reference, do not ship
  package.json                  # workspaces + root scripts
  shared/src/
    types.ts                    # Player, Room, events
    events.ts                   # typed socket event names + payloads
    games/
      index.ts                  # game registry
      types.ts                  # GameModule interface
      last-card/                # engine: deck.ts, rules.ts, index.ts, *.test.ts
  server/src/
    index.ts                    # express + socket.io + static client
    rooms.ts                    # in-memory room store, join/leave/reconnect
    voice.ts                    # /api/voice-token
    gameRunner.ts               # calls the active GameModule, broadcasts views
  client/src/
    main.tsx  App.tsx
    styles/tokens.css           # colours, fonts, shadows from the mock
    screens/                    # Home, Lobby, GameHost, Results
    games/last-card/            # Table UI for Last Card
    components/                 # Card, Avatar, Seat, VoiceBar, Toast, Stamp...
    lib/socket.ts  lib/voice.ts  lib/session.ts
```

## Non-negotiable rules

1. **Server is the only source of truth.** Clients send intents (`playCard`, `draw`...). The server validates and applies them, then sends each player their own view.
2. **Never leak hidden info.** Players only ever receive `getPlayerView(state, playerId)`. Other hands are counts, never cards. Check this in tests.
3. **Game engines are pure.** No sockets, timers, `Date.now()` or `Math.random()` inside `shared/src/games/*`. Randomness comes from an injected `rng`. Time comes in as an argument.
4. **The core never imports a specific game.** It only talks to the `GameModule` interface through the registry. Adding a game = one folder in `shared/src/games/` + one folder in `client/src/games/` + one registry line each.
5. **Secrets stay on the server.** `LIVEKIT_API_SECRET` is only read in `server/`. Never put it in Vite env vars or client code.
6. **Mobile first.** Design for 360–430px wide first, then scale up. Tap targets ≥ 44px. Test every screen at 390×844 and 1440×900. No hover-only interactions.
7. **Rooms live in memory.** No database. A server restart ends games; reconnecting must be smooth for drops, not restarts.
8. **Keep the mock's look.** Sticker style: 3px `--line` borders, hard offset shadows, Lilita One + Nunito, sentence-case copy, colour + shape on every card.

## How to work

- Build **one phase at a time** (see below). Finish its "done when" list before moving on.
- Before coding a phase, write a short plan, then build, then run `npm test` and `npm run typecheck`.
- After each phase, tell me what to test by hand and suggest a commit message. Don't commit unless I ask.
- Keep files small and readable. Prefer plain functions over classes. No premature abstraction beyond the `GameModule` interface.
- If a rule in `REFERENCE.md` is unclear, ask me instead of inventing one.

## Phases

### Phase 0 — Scaffold
- Workspaces, TS configs, Vite client, Express + Socket.io server, shared package wired to both.
- Server serves `client/dist` in production and has `GET /api/health`.
- `tokens.css` with the mock's colours, fonts, shadows. A placeholder Home screen in the mock's style.
- Root scripts: `dev` (client + server together), `build`, `start`, `test`, `typecheck`.
- **Done when:** `npm run dev` shows the styled home page and the client logs a socket connection.

### Phase 1 — Rooms and lobby (no voice yet)
- Create room → 4-letter code (no I/O/0/1 lookalikes). Join by code or `/r/CODE` link.
- Name + avatar picker; saved in `localStorage`.
- Lobby: 15-seat grid, host crown, host-only settings and Start button, copy invite link.
- Reconnect: `playerId` + `secret` in `localStorage`; seat kept for 60s after disconnect ("Reconnecting…").
- If the host leaves, the next player becomes host. Empty rooms are deleted after 10 minutes.
- **Done when:** 3 browser tabs can create/join/leave/refresh and everyone's lobby stays in sync.

### Phase 2 — Last Card engine (shared, pure, tested)
- Implement the `GameModule` interface and the full rules from `REFERENCE.md`.
- Vitest coverage for: deck building (1 or 2 decks), dealing, every card effect, reverse with 2 players, stacking, 7-0, draw-until-playable, last-card shout + catch, scoring, illegal moves rejected, player views hide other hands.
- **Done when:** `npm test` passes and a scripted full game with 15 bots finishes without errors.

### Phase 3 — Game table UI
- Wire the engine to sockets through `gameRunner.ts`.
- Table screen from the mock: seats around the table on desktop, horizontal seat strip on phones, draw + discard piles, current colour, direction arrow, fanned hand (playable lifted, others dimmed), wild colour picker, event log, turn banner.
- Card play animation from hand to pile. Respect `prefers-reduced-motion`.
- Results screen with podium and scores; host can deal another round or return to lobby.
- **Done when:** 3+ tabs can play a full round on desktop and phone sizes.

### Phase 4 — Voice (LiveKit)
- `POST /api/voice-token` checks the player belongs to the room, returns a short-lived token for room `holla-<CODE>`.
- Client joins voice after the user taps "Join voice" (needed for mobile audio autoplay), with mic permission handling and clear errors.
- Voice bar: mute, push-to-talk (hold button on phone, hold Space on desktop), mute everyone, leave.
- Speaking rings driven by LiveKit active-speaker events; mute badges from track state.
- **Done when:** two devices on different networks can hear each other and see speaking rings.

### Phase 5 — Party polish
- "Last card!" shout button + "Catch!" on players who forgot (2-card penalty).
- Emoji reactions broadcast to everyone and float above the sender's seat.
- Turn timer (Off / 20s / 40s) — on timeout: auto-draw and pass.
- Sounds: small, optional, mutable.
- **Done when:** a real game night with friends works end to end.

### Phase 6 — Deploy
- Render web service: build `npm install && npm run build`, start `npm start`, env vars from `.env.example`.
- Socket.io works behind Render's proxy; client connects to same origin.
- **Done when:** friends can join from the `onrender.com` URL on their phones.

## Commands (once scaffolded)

```
npm run dev        # client (Vite) + server (watch) together
npm test           # vitest across workspaces
npm run typecheck  # tsc --noEmit everywhere
npm run build      # build shared + client + server
npm start          # production server on $PORT
```
