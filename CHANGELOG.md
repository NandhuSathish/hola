# Changelog

What has actually been built, and the decisions behind it. Newest first.

Nothing is released yet — v1 ships once the three games, polish and the Render
deploy are done.

---

## Unreleased — working towards v1

### Decisions · 2026-10-18

- **Voice moves to v2.** It is the highest-risk and slowest-to-test part of the
  project: it needs HTTPS and two real devices on separate networks, and
  LiveKit's free allowance is roughly one and a half game nights for a full
  room. Three working games is worth more to a friend group than one game plus
  voice. `README.md`, `CLAUDE.md` and `REFERENCE.md` §7 updated so v1 stops
  advertising something it does not have.
- **Two more games in v1:** Snakes & Ladders, then Hand Cricket. Both mocks now
  exist in `design/`.
- **No Tailwind.** `CLAUDE.md` already forbade it. The design system is built,
  the mock is plain CSS and is the source of truth, and the hard styling here is
  bespoke — conic-gradient timer rings, seats placed by trigonometry, card fans,
  hard offset shadows. Adding Tailwind would be a rewrite with no user-visible
  change and a permanent translation layer between mock and app.
- **Adopt `motion`, for DOM transitions.** Overlays, toasts, stamps and screen
  changes. The card flight cost three rewrites as hand-rolled CSS because React
  re-renders kept restarting it. Game boards do their own tweening inside
  canvas, so motion does not touch them.
- **Canvas 2D for game boards. No Pixi, no Phaser.** Both new mocks are already
  canvas-based, and the Snakes & Ladders board is genuinely animation-heavy —
  a 60fps loop, wiggling snakes, token squash-and-stretch, particles with
  gravity. But the mock implements all of it in plain Canvas 2D in 75KB, so
  adopting Pixi would mean rewriting working code into a scene graph. Pixi's
  WebGL batching buys nothing for ~4 tokens and ~50 particles, and Phaser
  brings its own game loop and state model, which conflicts with rule 1's
  server authority. The client bundle is 87KB gzipped today; either library
  would be several hundred more. The registry means each game owns its client
  component, so a future game that needs WebGL can adopt Pixi for itself alone
  — this decision costs nothing to defer.

### Phase 3b — table polish and results

- Cards fly from the hand to the pile; the new top card pops as it lands.
- Event log pills under the banner, toasts for the loud moments.
- "Last card!" stamp, and the shout button wobbles when it is worth pressing.
- Results podium, confetti, and your own row highlighted in the scores.
- Turn-timer ring drawn client-side from `turnEndsAt` — the one piece of visible
  state the server deliberately never broadcasts.
- Every flourish checks `prefers-reduced-motion`, in CSS and in JS.

**Fixed**

- Refreshing on the results screen wiped the scores. `game:result` was only sent
  at the moment a round ended, so any client arriving later fell back to a blank
  "Round over". A `catchUp` helper now sends the view and, in the results phase,
  the result — on both join and rejoin.

**Learned**

- The card flight is driven by `element.animate()`, not CSS: the table
  re-renders about four times a second while the turn ring counts down, and
  anything living in the style attribute gets rewritten on each of those, which
  restarts a CSS animation and pins the card at its start.
- That animation looked broken for three rewrites because the Browser pane was
  hidden and not compositing frames. `playState: "running"` with
  `currentTime: 0` is the tell. Check whether the pane is displayed before
  concluding an animation is broken.

### Phase 3a — playable game table

- `gameRunner.ts` drives whichever module the room chose, entirely through the
  registry and the `GameModule` interface. The core still names no game.
- `game:start`, `game:action`, `game:next` in; `game:view`, `game:events`,
  `game:result` out.
- Per-player views addressed through a `p:<playerId>` socket room, so a player
  is never *sent* someone else's hand rather than merely not shown it.
- Turn timer ticks each second but only publishes when a timeout actually fires.
- The room sweep folds a retired player out of a live round.
- Table, results screen, and `RoomScreen` routing one URL by room phase so
  guests follow the host into the round without navigating.

**Fixed**

- A `null` `game:action` crashed the server. The engine read `action.type`
  without checking the shape, and that value arrives straight off a socket, so
  any client could have stopped the process.
- Everyone ended up with the same avatar. The server only replaced an *invalid*
  avatar, never a *taken* one, so a table of people who never opened the picker
  all showed the same animal.
- A player joining mid-round received no view at all and sat on "Dealing…"
  forever.
- Every card rendered grey. The engine names colours the way a player says them
  (red, yellow, green, blue) while the tokens are named after the mock (red,
  sun, mint, sky), so `var(--green)` and `var(--blue)` resolved to nothing.
  Three alias tokens fixed it without any component needing a lookup table.
- The table was a flat rectangle instead of the mock's oval rug. Rebuilt with
  the inset ring, dashed inner ring, hard shadow, seats placed by angle, and the
  spinning direction arrows.
- The arena collapsed to 174px on phones: making the screen a flex column meant
  its `margin: auto` beat flex stretch, so it shrank to its content.
- A hand now only dims on your own turn. On someone else's turn nothing is
  playable anyway, so greying the whole hand said nothing and looked dead.

### Phase 2 — Last Card engine

- The full ruleset as a pure module: no sockets, timers, clock or `Math.random`.
  Randomness arrives as `rng`, time as `now`.
- Deck, stacking (no mixing +2 and +4), 7-swaps / 0-rotates, draw-until-playable,
  the shout and catch window, turn timer, reverse-as-skip heads-up, draw pile
  recycling, winner-takes-all scoring.
- `npm run sim` plays a readable bot game, or soaks many seeded games and exits
  non-zero on a stall.

**Changed**

- `setup` takes `ctx: { now, rng }` rather than a bare `rng`: a turn timer needs
  a start time and the engine may not read the clock itself.
- State is cloned structurally rather than with `structuredClone`, which is not
  in `shared`'s lib and would have meant pulling Node types into a package that
  also runs in the browser.

**Verified**

- 900 soak games across default rules, all rules and heads-up: no stalls, no
  illegal moves, wins spread across all 15 seats.

### Phase 1b — game picker and lobby

- Registry splits three ways: `catalogue` (display, including games with no
  engine), `settingsSpecs` (the lobby needs these before any engine exists), and
  `modules` (engines). `isPickable` gates `room:setGame`; `isPlayable` will gate
  `game:start`.
- Settings belong to the game: the server stores `room.settings` but never reads
  it, handing patches to the active game's spec, so junk and unknown keys are
  dropped rather than stored.
- Games picker and the lobby, both from the mock. The settings panel is rendered
  by the game module, not hardcoded.

**Fixed**

- Host handover fired on *disconnect*, so a host who refreshed lost their own
  room, and a guest rejoining during the grace window could take the crown.
  `REFERENCE.md` §5 says "more than 60s or leaves".
- Switches were 32px and timer buttons 33px, under the 44px minimum in rule 6.

### Phase 1a — rooms, sockets, reconnect

- Typed socket contract where every client event answers with an
  acknowledgement, so a refusal always arrives with a reason.
- In-memory room store with `now()` and `rng()` injected so tests drive time.
- Host handover picks the longest-present connected player; a 5s sweep retires
  seats past the 60s grace and deletes rooms nobody came back to.
- `room:create` is rate limited per connection — there are no accounts.
- History-API routing; no router dependency for a handful of screens.

**Changed**

- Seats moved from `localStorage` to `sessionStorage`. With localStorage every
  tab on a device silently shared one seat, which made the "three tabs stay in
  sync" check impossible and stopped friends sharing a laptop.

### Phase 0 — scaffold

- npm workspaces for `client`, `server` and `shared`, wired end to end.
- `shared` builds to `dist` and is consumed by both as a normal workspace
  package — one mechanism rather than per-tool aliases.
- Express 5 + Socket.io on one HTTP server, `GET /api/health`, and in production
  it serves `client/dist` with an SPA fallback.
- `tokens.css` holds the mock's colours, fonts and shadows verbatim.

**Notable**

Every major version in this stack shipped after the model's knowledge cutoff, so
the config was checked against docs rather than assumed:

- TypeScript 7 defaults `types` to `[]`, so each workspace declares its own;
  `baseUrl` and node10 resolution are gone. `bundler` resolution needs
  `module: esnext` (TS5095) and `nodenext` module needs `nodenext` resolution
  (TS5109).
- Vitest 5 replaced `test.workspace` with `test.projects`.
- Express 5 dropped the bare `'*'` route; the catch-all is `'/*splat'`.
