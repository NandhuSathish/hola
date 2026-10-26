# Changelog

What has actually been built, and the decisions behind it. Newest first.

Nothing is released yet — v1 ships once the three games, polish and the Render
deploy are done.

---

## Unreleased — working towards v1

### Phase 6 — fitting on a phone

Playing each game through at 375×812 rather than reading the CSS, which
found four things that made the games awkward or unplayable on the device
most of a game night happens on.

**The reaction bar moved into the nav.** The mock pins the emoji across the
bottom of the screen as part of its voicebar, and that is where our games put
the things you actually press — the bar sat squarely on the Last Card hand,
124px of it. Reserving a strip for it cost the Last Card table more height
than it had to give. So the palette is a button in the top bar now, opening
on a tap and closing on a pick, Escape or a tap anywhere else. The top bar is
the one strip of the screen no game draws in. On a phone the palette centres
on the viewport rather than hanging off the button, which is two thirds of
the way across the bar and would push it past the left edge.

`--bar-clear` stays as the bottom padding every screen uses, now the 28px of
breathing room plus the home indicator rather than clearance for a bar.

**The invite link had no door.** `/r/CODE` only ever tried to reclaim a seat
from `localStorage`, so the friend who tapped the link in a group chat — the
only person it is for — got "Looking for your seat…" and nothing else, for
ever. With no seat saved it is a join form now: name, fighter, take a seat.

**Screens kept the last one's scroll.** Nothing reset it, so picking Snakes &
Ladders from a list you had scrolled dropped you onto the board 274px down,
with the dice below the fold. The router scrolls to the top on a route
change, and because the lobby and the table share a URL, `App` does the same
on a phase change. `scrollRestoration` is manual, so a reload behaves too.

**Hand Cricket hid the picker.** Stacked on a phone, the three columns put
the scorecard between the ground and the number picker, which left the one
thing you have to hit before the clock runs out below the fold. The picker
comes first on a phone; the scorecard and the over are what you read between
balls, not during one.

Also: the Last Card table asked for a full `100dvh` below a 74px sticky nav,
so the hand hung 56px past the bottom of a phone whatever else was fixed.

### Phase 6 — reactions and sounds

**Reactions.** Six emoji from the mock's voicebar — the voice buttons beside
them there are v2, so for now it is the emoji alone. `room:react` is fire and forget: no acknowledgement, because a
reaction that failed is not worth telling anyone about and the round trip
would make it feel sticky. The server drops anything off the list and rate
limits to one every 600ms per connection, which is generous for a person and
useless for a script.

Each emoji floats up from whoever threw it, found by looking for
`[data-player="<id>"]` anywhere on the page. That is how a seat in the lobby,
a row in a scorecard and a racer in a strip can all be the anchor without any
of them knowing reactions exist — and with nothing to pin to, it rises from
the bottom of the screen instead.

**Sounds.** Eight effects from Mixkit, committed under `client/public/sounds`
so they ship with the build and nothing is fetched from a third party
mid-game; the README there records each file's source and the licence. Wired
to the moments that carry news: the roll and what the board does to you, a
card played or drawn, a number thrown and what came of it, a reaction
landing, and the end of a round.

- Mute is a toggle on the reaction palette and sticks in `localStorage`.
- A browser will not make a sound before the page has been touched, so the
  first press anywhere also warms the cache; a refusal before that is
  expected rather than a fault, and the next cue works.
- Several of the sources run two to four seconds, nearly all reverb tail —
  fine as a sample on a web page, grating twenty times a round. Each cue is
  cut to the part that carries the news. The win fanfare is left to ring.

### Phase 5 — one wicket per batter

Real cricket stops a side one short, because the last batter has nobody to
cross with. That is the wrong trade for a party game: a side of two was all
out on the first ball anyone matched, so a four-player match finished before
it had started. Everyone gets an innings now, as the mock has it.

Which made a path that had never run start running: with every batter able to
go, a wicket can fall with nobody left on the bench. The player at the other
end carries on alone — takes strike, and there is no other end any more —
until they are out too.

### Phase 5 — done when: two teams, several tabs

Played through four tabs, two a side, which is what phase 5's own done-when
asks for and what every earlier test of it skipped. Strike crossing on odd
runs, the bowler changing at the end of an over, the keeper and fielders on
the ground, the innings change, the chase and the celebration all hold up
with a real team rather than one player a side.

#### Fixed on the way

- **The results podium ranked Hand Cricket backwards.** `RoundResult` carried
  a column called `cardsLeft`, and the shared results screen sorted it
  ascending — right for cards in your hand and for tiles from home, exactly
  wrong for runs. The winner's name and the top of the podium disagreed.

  The field is `score` now, and the result says what it means and which way
  it reads: `scoreLabel` and `higherIsBetter`. Last Card is "Cards left",
  Snakes & Ladders "Tiles from home", Hand Cricket "Runs" with higher
  better. The shared screen cannot know this on its own, so the game has to
  say — which is the same reason the core never imports a game.

### Phase 5h — three buttons, not one pill

The bar's right-hand side was a single cream pill with the game, the code
and Leave as segments inside it. They are three separate stickers now, each
with its own edge and shadow: copying a code and walking out of a room are
not two halves of the same control, and a red Leave sharing an edge with the
code is an easy mis-tap. The game chip stays flatter than the two buttons,
because it is a label rather than something to press.

#### Fixed on the way

- `.claude/launch.json` is attach-only now. Starting the dev server from it
  injects `PORT=5173`, which made the API server take Vite's port and refuse
  its own websocket proxy — the client sat on "Connecting…" forever.

### Phase 5g — the picker is the first room screen

The "No game yet" card was a placeholder for a page the room should simply be
on. A room with no game now goes to the picker instead of to a lobby with a
hole in it, for everyone in it — the host to choose, the rest to watch them
choose, with the game list named after who is deciding and the buttons dead
for anyone who is not the host.

- **Leave moved to the bar.** It is on every room screen now, including the
  lobby and the picker, so the room code and the way out are always in the
  same place. The lobby's own Leave is gone; the code row is the two copies.
- **Hand Cricket has cover art** — two number tiles, stumps and a ball. The
  picker was showing it as an empty panel, which is a poor advert for a game
  someone is being asked to choose.

#### Fixed on the way

- Picking a game bounced straight back to the picker. `room:setGame` acked
  before it broadcast, so the lobby rendered against a view that had not
  heard about the new game and the redirect sent it back. The state goes
  first now; Socket.io keeps a connection's messages in order, so that is
  enough.

### Phase 5f — a room with no game yet

Last phase moved room creation ahead of the game picker but still stamped
Last Card on the way past, so a room arrived with a game nobody had chosen.
`gameId` starts empty now and means exactly that: creating a room takes you
to the picker *inside* the room, with the code already in the bar.

- The lobby shows a dashed "No game yet" card with a **Pick a game** button
  instead of pretending one was chosen, hides the house rules until there
  are some, and will not deal: "Pick a game to get going."
- `start` says "Pick a game first" rather than the misleading "that game is
  not ready to play yet", which is about a game that exists but is not built.

**The celebration was too long.** Ten seconds of jumping is a long time to
wait for a scorecard when the ball before it already took four to tell.
Halved to 4.5s, so the whole tail is about eight seconds rather than fifteen.

### Phase 5e — let the last ball finish, then celebrate

**The match ended before the ball that ended it.** The engine declared a
result the instant the final ball resolved, the runner moved the room to
results, and the scorecard replaced the table — so the winning six, or the
wicket that sealed it, was never seen by anyone.

The fix is in the engine, where "finished" and "over" are now two different
things. A finished match sets `celebrateUntil`, and `getResult` returns null
until `onTick` settles it, which is what keeps the room on the table: the
runner only moves to results when the module hands back a scorecard. The
window is the telling of the last ball plus ten seconds.

**The celebration is its own thing, not a bigger six.** A six is one batter
punching the air for a beat; this is the whole winning side spread across the
ground, jumping out of phase with each other, the stumps pulled, caps going
up and the crowd on its feet for the duration. The chips over the ground go
away — there is no next ball to name — and the picker is replaced by the
result and a line saying the scorecard is coming.

Measured end to end: last ball told at 15.4s, win card up, scorecard at
26.3s — eleven seconds of field before the room moves on. Walking off is the
one exception: there is nothing to watch, so it settles at once.

### Phase 5d — a gap between balls, and the room before the game

**The pick clock was already running under the animation.** The server opened
the next ball the instant it resolved the last one, so by the time you had
watched a six sail into the crowd, three of your seven seconds were gone. Last
phase I kept the picker live on purpose and called it fairness; it was the
wrong call, and the fix belongs in the engine rather than the client.

A ball now leaves a gap: `gapAfter(outcome)` is how long the telling takes —
the run-up, the shot, the ball reaching the rope — plus a beat to read the
score. `onTick` opens the next window when the gap is up, so every pick clock
starts at its full length for everyone. The innings change gets a longer one.
The table shows "Get ready…", a counting "Next ball 3", and a greyed picker,
because a pause nobody can see is just a frozen screen.

The client's animation is tuned to fit inside those numbers, which is written
down where the numbers are.

**The room now exists before a game is chosen.** Creating a room took you to
the game picker first and only made the code once you had chosen, which is
backwards: the room is the thing people join, and the game is something the
table decides together. **Create a room** goes straight to a lobby with a code
in the bar, and the game is picked from inside it with **Change**, same as it
always could be.

**A room bigger than the game no longer refuses to deal.** Ten people in a
room and a game that seats eight used to be an error telling the host to go
and ask someone to leave. The extras sit the round out instead — longest-
waiting first, so it is not the same people every time — the log says who is
standing, and the next round deals everyone back in.

#### Fixed on the way

- The bowling chip read "Someone" between balls, since there is no live ball
  to take a name from. It keeps whoever just bowled.

### Phase 5c — the score waits for the ball, and the mock's toss

Two things the first cut got wrong.

**The result was given away before the ball was bowled.** The server resolves
a ball the instant both numbers are in, and the table rendered that straight
off — so the scoreboard read 17 for 1 while the bowler was still running in,
and the stamp said "Out!" over a batter who had not played a shot yet. The
figures, over strip, card and commentary now come from a view held one
animation behind, catching up only when the ball has finished playing out,
and the stamp waits for the moment it belongs to: "Out!" as the stumps break
at 1.86s, "Four!" as the ball reaches the rope at 2.35s.

The picker and its clock deliberately do *not* lag. The next ball's window is
already open on the server, and holding it back would hand the slow half of
the room a shorter turn. The ground shows the ball being told; the buttons
below it are for the ball coming.

**The toss is the mock's now.** "Toss time", the two captains either side with
name pills in their colours, and a 190px coin that goes up 120px, turns five
times and comes down on a face — heads in sun with the wordmark, tails in
mint with a bat and ball. The result is held until it lands: until then the
page says "In the air…", because the server knew the answer the moment it was
called and the flip is only the telling of it.

### Phase 5b — the Hand Cricket table

The third game is playable. Ported from `design/hand-cricket-mock.html`.

**The ground** (`stadium.ts`). Sky, drifting clouds, floodlights, a packed
crowd that gets to its feet for a six, hoardings, a banded outfield, the
pitch, and stumps that burst with the bails flying. Drawn in a fixed
400-unit-tall world and scaled to the canvas, so the ball's flight can be
written in real numbers: the bounce, the carry, a six's bezier into the
crowd, a four skidding to the rope, and for one, two or three the throw out
to a fielder and back to the keeper.

**The cricketers** (`people.ts`). A different body from the boxer — profile,
pads, gloves, bat, helmet — but it borrows the same head, so you are
recognisably yourself whichever game you are in. `drawHead` gained `bare` for
where a helmet or an umpire's hat is about to cover the top of it. Poses for
the batter (stance, swing per shot, running, celebrating, slumping), the
bowler (run-up, delivery, follow-through, appeal, despair), the keeper, the
umpire's signals and the fielders.

**The table.** The mock's three columns: scorecard left, picker centre,
this-over and commentary right, with the scorebar above and the ground below
it. Both tiles over the scene show a `?` until a ball closes — your own
number fills in as soon as you throw it, theirs stays shut.

**The toss** gets its own screen, since most of the room is only watching it.

The ball is replayed on each client's own clock. The server decided it long
ago, so nothing waits for the animation — a slow tab sees a shorter version
of the same ball, not a different one, and reduced motion skips to the stamp.

The catalogue entry flips to `ready` and the two registry lines go in. Rule 4
held again: nothing in `server/src`, `App.tsx`, `useRoom.ts` or `events.ts`
was touched to add a third game.

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
