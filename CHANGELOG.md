# Changelog

What has actually been built, and the decisions behind it. Newest first.

Nothing is released yet — v1 ships once the three games, polish and the Render
deploy are done.

---

## Unreleased — working towards v1

### Phase 5a — the Hand Cricket engine

Two teams, a toss, two innings, the second chasing. Each ball the striker and
the bowler throw a number from 0/1/2/3/4/6 at the same moment: same number and
the batter is out, otherwise they score theirs.

- The room splits into two sides alternating down the seat order, so four
  friends who joined together do not all end up on the same team.
- The bowler changes every over. The strike crosses on odd runs and again at
  the end of an over, as the ends would. A side is all out at
  `max(1, teamSize - 1)` wickets — real cricket for any team of two or more,
  and still sane for a one-a-side game.
- `onTick` is not a courtesy here the way a turn timer is: it is what closes
  the ball. Anyone who did not throw in time gets a number from the rng, and
  a number already thrown is kept.
- No fan role. With teams everyone is already batting or bowling, so the
  guessing mechanic the mock has is gone and `CLAUDE.md` says so now.

**The simultaneous pick is the reason the view does real work.** Until a ball
closes you get your own number back and nobody else's. Who we are still
waiting on is public — that is a fact about the room, not about anyone's
number — but the number itself is not, and a test asserts the opponent's pick
appears nowhere in their payload.

47 tests: the toss and who may call it, scoring and wickets, bowler and strike
rotation, the innings change, chase, tie and all-out endings, the pick window,
leaving mid-match, and that the engine never mutates what it is handed and
replays identically from a seed.

The catalogue entry stays `soon` until its table lands in 5b — the engine
being ready is not the same as the game being playable, and flipping it early
would let a host start a match that opens on a dead screen.

#### Fixed on the way

- Three server tests used `hand-cricket` as their stand-in for a coming-soon
  game. They point at an id the catalogue has never heard of now, which takes
  the same branch and does not rot the next time a game ships.

### Phase 4g — the crowd vote you can read

Reported as "it showed two options but I could not select one". The vote was
working: the subject of a crowd vote is never allowed to vote on their own
fate, so on their screen both options are disabled — and `.sl-opt:disabled`
set nothing but `cursor: default`, so a locked option looked exactly like a
live one. Confirmed by watching both sides of a real vote: the voter's buttons
came back `disabled: [false, false]`, the subject's `[true, true]`.

- A locked option now reads as locked (desaturated and flattened, the same
  treatment `.btn:disabled` gets), and the card says why in words: "Your own
  fate is not yours to vote on", "You have voted", "You are not one of the
  voters". A running "2 of 4 voted" sits under the options.
- Your own pick stays bright after you vote rather than greying out with the
  rest. It is information, not a control you have lost.

**The options are the mock's now.** Two coloured cards side by side, each
carrying the same 46px icon its matching mystery card does — `VOTE_ART` was
built last phase and never wired up, so the options had been plain text on
paper. Shape as well as colour, per rule 8, and the chosen one is outlined
rather than merely tinted.

**The board is kept inside the window** (`min(100%, calc(100dvh - …))`), as
the mock sizes it. Prompts are centred on the board and run on a clock, and a
board taller than the viewport could put one partly off-screen — you cannot
answer what you cannot see.

---

### Phase 4f — a nav bar, and the room actions together

**The nav bar** (`components/NavBar.tsx`) now sits on every screen, built the
way the mock's own bar is (`.mockbar` in `design/holla-mock.html`): no solid
band and no edge, just the page colour fading out beneath it, so what scrolls
up into it dissolves rather than sliding behind a wall. A sun-yellow wordmark
on the left with the hard ink shadow, and on the right one cream pill — the
mock's way of grouping controls — holding a dot and name for the game you are
in, the room code, and Leave.

- The room code in the pill is itself the copy button: tap the code, get the
  code. It turns into a tick without changing size, so nothing shifts.
- Leave appears in the bar only where the screen beneath has no way out of its
  own — which, before this, mid-game meant closing the tab. The lobby keeps its
  own, so there are never two.
- Below 620px the game name and the Leave label drop, leaving the coloured dot
  and the door icon; both keep their accessible names.
- `--nav-h` is a token and the bar is pinned to it, so a screen that wants the
  rest of the viewport can ask for it. The lobby's reconnect banner is gone —
  the bar reports that on every screen now.

**The lobby's room actions** are together: the code, an icon-only copy button
beside it, Copy invite link, and Leave room — the last two now carrying icons,
and Leave the only red thing on the page since it is the only destructive one.
Leave moved up from the bottom of the seat grid to join them.

**Copying** moved into `lib/useCopy.ts`. The old call was `navigator.clipboard`
with a bare try/catch that silently looked like it had worked. It now falls
back to a hidden textarea — `navigator.clipboard` needs a secure context, and a
phone on the LAN hitting a plain-HTTP dev server is not one — and says so when
both fail instead of pretending.

**Interface icons** (`components/icons.tsx`): copy, link, leave, check, home,
in the mock's stroked style, drawn in `currentColor` so a red Leave gets a
cream glyph without a second rule saying so. Plus `.btn.with-icon` and a 44px
square `.icon-btn` in the tokens.

#### Fixed on the way

- **Leaving mid-game left your token on the board.** `room:leave` removed you
  from the room but never folded you out of the round, so a seat nobody owned
  kept taking turns and could win a game its player had walked out of. The
  sweep did this for a dropped connection; a deliberate exit never went
  through it. Found because the new Leave button is the first thing that makes
  this easy to do — before, mid-game there was no way out but the tab close.
- The leave line read "Someone left the table", because by the time anyone
  reports it the player is already out of `room.players`. The name travels
  with the departure now, on both the walk-out and the sweep paths.
- `.leave-btn` tied `.btn` on specificity and lost on source order, so the red
  never applied. Qualified as `.btn.leave-btn`. Same for `.sl-log-ico`, which
  ties `.ui-icon` now that interface icons appear in the log.
- The brand button was a 34px tap target; it is a link home, so it is 44 now.
- An empty action pill rendered as a stray cream dot in the corner on Home.

---

### Phase 4e — the rest of the mock's play screen

The board looked right but the furniture around it did not. The mock's play
screen is a board plus three stickers; we had a banner, a flat list and a
four-line log. All three stickers are now built, and the moments that make a
turn fun — the dice, the box opening, the big word over the board — are in.

**The turn card.** Whose turn it is, with their head ringed in their jersey
colour, "Your turn" / "Rolling…" / "Waiting on the room…", and a Round pill.

**The dice tray** (`Dice.tsx`). A canvas of felt green. Hold the button and the
dice rattle; let go and they tumble, blurring through faces and only settling
in the last 15% of the throw. Space does the same. The throw is a purely local
animation on its own clock — the server still just says what came up.

**The race.** Each player's progress along the board as a bar in their own
colour, with Shield and Frozen badges and the tile number.

**What happened.** The mock's scrolling log: a head for anything a player did,
and the matching icon (ladder, snake, gift, megaphone, crown) for anything the
board did. Replaces the four-line strip and the toast.

**The mystery box reveal** (`Reveal.tsx`). A card sits face-down with a "?",
turns over, and shows what you got. It never gates play: the engine applied
the effect long ago, so the reveal is a telling, and it closes itself.

**Stamps.** "Ladder!", "Gulp…", "Bonk!", "Rocket!", "Slip!", "Swap!",
"Escaped!" slam over the board as each leg of a move lands.

**Cues.** The board owns the move timeline, so it is the only thing that knows
*when* a ladder is climbed or a box is opened. It now calls `onCue` as each leg
begins, and the table lands its stamp or reveal on the beat instead of firing
everything the moment the view arrives. Under reduced motion every leg cues at
once, so the story still gets told.

**The fighter builder** got its own column from 900px up. In a 440px card the
stage was 150px tall and the eight head styles wrapped to three rows; now the
fighter stands on a proper stage beside the form, and shrinks again on a phone
so the name field stays above the fold.

**Icons** (`icons.tsx`): the mock's fourteen SVGs, ported one for one. A card,
a vote option and a log line are all identified by shape as well as colour, so
the same drawing has to appear in all three places.

#### Fixed on the way

- The roll button read `shaking` from a stale closure in `onPointerUp`, so
  releasing never rolled — pointerup lands in the same tick as pointerdown's
  state update. It reads a ref now.
- The card reveal never flipped: `onClose` was an inline arrow in the effect's
  dependency list, and the table re-renders on every turn-clock tick, so the
  flip timer was cancelled and restarted forever. Held in a ref.

---

### Phase 4d — the mock's art, and fighters

The board was functional but it was not the mock. Snakes were two quadratic
curves with a circle on the end — cable, not animals — tiles were flat rounded
rectangles, and tokens were coloured discs with two letters on them. Rule 8
says the mock is the visual source of truth, so the drawing code is now a port
of it rather than an approximation.

**The board** (`client/src/games/snakes-ladders/art.ts`)

- Tiles: five pastel row-pair bands alternating per tile, a grid, Lilita One
  numbers, animated gift boxes on the mystery tiles, a wobbling megaphone on
  the crowd tiles, Start and Finish labels and a rocking crown on 100.
- Ladders: shadow, ink underlay, then warm wood — the sticker build-up.
- Snakes: a 56-point spine carrying a sine wave under an envelope that pins
  both ends to their tiles, drawn as a run of overlapping circles so the radius
  can taper head to tail and bulge around someone being swallowed. A stroked
  path cannot do that, which is exactly why the old ones read as wire. Plus
  banded scales, highlights, a flicking tongue, upright eyes that track
  whoever is rolling, blinks, sleeping `z`s, Noodle's crown and bonk stars.

**Fighters** (`client/src/art/fighter.ts`)

The emoji avatar is gone. A player is now a little boxer described by three
numbers — `{ style, skin, hair }` — which is what both mocks already stored
under `holla-fighter`. It lives in `shared/src/look.ts` beside the name rather
than inside a game, because it is identity: the same figure is your head in
every seat list, your token on the board, and what Hand Cricket will draw in
Phase 5. Jersey colour comes from seat order, so a full table stays tellable
apart however people style themselves.

- `drawFighter` / `drawHead`: 8 head styles, 5 skin tones, 6 hair colours, a
  walk cycle, facing (front, back with a numbered jersey, or side), and moods.
- `headIcon` rasterises a head to a cached data URL, so a lobby of 15 costs 15
  small canvases for the session rather than one per render.
- A build-a-fighter picker on Home and behind **Change my fighter** in the
  lobby, with a live preview. `room:look` applies it in the lobby only —
  mid-game a new outfit would be a disguise.

**Placement**, taken from the mock too: a fighter's feet sit 26 units below the
tile centre rather than through it, and players sharing a tile fan out into a
small grid instead of stacking invisibly.

#### Fixed on the way

- Three grid columns were `1fr` rather than `minmax(0, 1fr)`, so they took
  their min-content width and pushed the page sideways at 375px. The bigger
  avatars made it visible; the bug was already there.
- `overflow: hidden` on Last Card's `.av` would have clipped the turn ring,
  which is a `::before` at `inset: -9px`. The head is rounded instead.

---

### Phase 4c — the snake standoff and the crowd vote

The two twists that stop the game and wait for people. The standoff gives you
one chance to charm a snake by stopping a needle in the green; the crowd vote
puts your fate to everyone else within a deadline, majority wins.

Both are the same shape — a set of players, a deadline, a payload to render —
so they share one **prompt** concept rather than being two bespoke features.
Hand Cricket's simultaneous play is the same shape again and should reuse it.

The needle is a pure function of elapsed time, so the client draws it and the
server judges it from the same numbers. Judging happens on the server's clock,
which nudges it slightly late over a slow connection — acceptable for a party
game, and unforgeable.

**No new socket events were needed**, contrary to what I expected. The existing
contract already covered it: `game:action` takes a payload from any player and
lets the engine decide, `onTick` already resolves deadlines, and per-player
views carry anything. Rule 4 held for a third phase running.

**Fixed**

- An orphaned prompt deadlocked the game. If the subject left mid-vote, or a
  standoff timed out with its player gone, the prompt was cleared without
  handing the turn on, so nobody could roll again.

Verified over sockets: 8 games, 618 rolls and 74 standoffs, where aiming at the
green escaped and firing at zero got eaten, 37 to 37 — exactly the alternating
strategy the test drove. 230 tests pass.

### Phase 4b — Snakes & Ladders twists

The twists from the mock that are plain rules: mystery boxes with the full
8-card weighted deck, the shield that bonks a snake instead of being swallowed,
snake charming, the freeze ray, the earthquake, and Noodle the wanderer — the
crowned boss snake that relocates every three rounds onto a tile that means
nothing else.

Snakes became live state. They sleep and Noodle moves, so the board can no
longer draw from the static constant and the view carries them. A charmed snake
is drawn faded with its eyes shut, so it is obvious you can step on it.

**Fixed**

- The shared results table said "Cards left" for a game with no cards. The
  column is now "Remaining", which reads for both games.

**Known**

- `RoundResult.cardsLeft` is still Last-Card-shaped in the generic interface.
  It survives here as "tiles from home"; Hand Cricket will force a rename.

Verified over sockets: 6 games and 612 rolls, during which every move step kind
reached clients and all eight cards were drawn at least once. A 25-seed soak
with every twist on never put a token off the board. Rule 4 held again — no
diff in server/src, App.tsx, useRoom.ts or events.ts.

### Phase 4a — Snakes & Ladders

Second game, and the first proof the registry works: adding it changed no core
code at all. The only server diff was two test files swapping their example of
an unbuilt game.

- Pure engine with the board data from the mock: 7 ladders, 8 snakes, 10x10
  boustrophedon. Dice from the injected rng, exact finish with bounce-back, a
  six rolls again up to three times, and a turn timer that rolls for you.
- `lib/canvas.ts`, shared by the board games: device-pixel sizing, a render
  loop tied to the component, reduced motion, and pausing when the page is
  hidden.
- Canvas board with animated snakes, ladders and hopping tokens.

**The state split.** The server owns positions and sends them in the view; the
board owns pixels. A roll arrives as `lastTurn` carrying the journey — the
tile-by-tile walk path, then any ladder or snake leg — and the token walks it.
Anything not animating eases toward the server position, which is how a
reconnecting client catches up without replaying a move it never saw.

**Fixed**

- `useCanvas` never re-armed its loop if the page was hidden when it mounted.
  The first rAF never fired, and the visibility handler checked a flag that was
  still true, so the board stayed blank forever.
- The canvas needed `aspect-ratio: 1` in CSS. Sizing it only from JS left it at
  the browser's default 2:1 until the first frame, so the layout jumped.

The mock's six twists — mystery boxes, snake standoff, crowd vote, Noodle,
shield and shake-to-roll — are 4b.

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
