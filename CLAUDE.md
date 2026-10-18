# holla! — Claude Code guide

holla! is a browser party game for one friend group.
v1 ships three games as plug-in modules: **Last Card** (Uno-style, 2–15 players),
**Snakes & Ladders** and **Hand Cricket**. Built-in voice chat lands in v2.

This is a personal project. Optimise for: fun, simple code, free hosting, works great on phones.
Do not add accounts, databases, analytics, payments or anything "for scale".

Read `REFERENCE.md` for the full spec (rules, socket events, module interface, voice flow, design tokens).
The visual source of truth is the matching mock in `design/` — `holla-mock.html`
(shell, lobby, Last Card), `snakes-ladders-mock.html`, `hand-cricket-mock.html`.
Open it before building any screen.

## Stack

- **Monorepo with npm workspaces:** `client/`, `server/`, `shared/`
- **Language:** TypeScript everywhere (strict mode)
- **client:** Vite + React. Plain CSS with CSS variables (copy tokens from the mock). No UI kit, no Tailwind.
- **Animation:** `motion` for DOM transitions (overlays, toasts, screen changes). Game boards render to **Canvas 2D**, ported from the mocks — no Pixi, no Phaser.
- **server:** Node + Express + Socket.io. Serves the built client in production.
- **shared:** game engine modules, shared types, socket event types
- **Voice:** LiveKit — **v2, not v1.** Nothing in v1 reads `LIVEKIT_*`.
- **Tests:** Vitest (game engine must be well tested)
- **Hosting:** one Render free web service (build client, start server)
- Use the latest stable versions of packages. Check docs when unsure about an API — don't guess.

## Folder layout

```
holla/
  CLAUDE.md  REFERENCE.md  README.md  .env.example  .gitignore
  design/*.html                 # UI reference per game, do not ship
  package.json                  # workspaces + root scripts
  shared/src/
    types.ts                    # Player, Room, events
    events.ts                   # typed socket event names + payloads
    games/
      index.ts                  # game registry: catalogue (incl. coming soon) + modules
      types.ts                  # GameModule + GameInfo interfaces
      last-card/                # engine: deck.ts, rules.ts, index.ts, *.test.ts
      snakes-ladders/           # engine (phase 4)
      hand-cricket/             # engine (phase 5)
  server/src/
    index.ts                    # express + socket.io + static client
    rooms.ts                    # in-memory room store, join/leave/reconnect
    voice.ts                    # /api/voice-token (v2)
    gameRunner.ts               # calls the active GameModule, broadcasts views
  client/src/
    main.tsx  App.tsx
    styles/tokens.css           # colours, fonts, shadows from the mock
    screens/                    # Home, Games, Lobby, GameHost, Results
    games/
      index.ts                  # id -> { Table, Settings } component registry
      last-card/                # Table UI + Settings panel for Last Card
      snakes-ladders/           # canvas board (phase 4)
      hand-cricket/             # canvas scene (phase 5)
    components/                 # Card, Avatar, Seat, VoiceBar, Toast, Stamp...
    lib/socket.ts  lib/session.ts  lib/route.ts  lib/canvas.ts  lib/voice.ts (v2)
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

### Phase 4 — Snakes & Ladders
- Second game, and the first real test that adding one needs no core changes.
- Board, tokens, dice, snakes and ladders, all from `design/snakes-ladders-mock.html`.
- The board is **Canvas 2D**, ported from the mock — a 60fps loop with wiggling snakes, token squash-and-stretch and a particle system, all already written there.
- **Split game state from animation state:** the mock mixes them, but here the server owns the game state and it arrives as a view, while animation state is local and interpolates toward it.
- `motion` goes on the DOM overlays (mystery box, toasts, stamps), not the board.
- **Done when:** a full game plays out in three tabs and the core is untouched apart from two registry lines.

### Phase 5 — Hand Cricket
- Third game, from `design/hand-cricket-mock.html`.
- **Simultaneous, not turn-based:** both players commit a number and it is revealed together. Per-player views hide the opponent's choice; `onTick` closes the window.
- **Two roles:** two players bat and bowl while everyone else in the room guesses along for points. The `spectator` flag does real work here.
- **Done when:** two players and several fans can play an innings through to a result.

### Phase 6 — Party polish
- Emoji reactions that float above the sender's seat.
- Sounds: small, optional, mutable.
- Whatever the three games need to feel finished.
- **Done when:** a real game night with friends works end to end.

### Phase 7 — Deploy (v1)
- Render web service: build `npm install && npm run build`, start `npm start`.
- Socket.io works behind Render's proxy; client connects to same origin.
- No LiveKit variables are needed for v1.
- **Done when:** friends can join from the `onrender.com` URL on their phones.

## Later (v2)

### Voice (LiveKit)
Deliberately held back from v1. It is the highest-risk, slowest-to-test part of
the project — it needs HTTPS and two real devices on separate networks — and
LiveKit's free tier is about 1,800 participant-minutes a month, which is
roughly one and a half game nights for a full room. Three working games is
worth more to a friend group than one game plus voice.

The spec for it still stands in `REFERENCE.md` section 7 and the voice bar is
already drawn in both mocks. When it lands: `POST /api/voice-token`, join on a
tap, mute, push-to-talk, speaking rings from active-speaker events.

## Commands (once scaffolded)

```
npm run dev        # client (Vite) + server (watch) together
npm test           # vitest across workspaces
npm run typecheck  # tsc --noEmit everywhere
npm run build      # build shared + client + server
npm start          # production server on $PORT
```
