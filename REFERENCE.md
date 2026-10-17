# holla! — reference

The detailed spec behind `CLAUDE.md`: what to build, how the pieces talk, and where to read more.

---

## 1. Product in one paragraph

A friend opens holla!, picks a name and avatar, taps **Create a room**, and shares a 4-letter code or link.
Up to 15 friends join from phones or laptops, talk over built-in voice, and play **Last Card** (Uno-style).
After each round there's a results screen, then another deal. No sign-up, nothing to install.

---

## 2. Architecture

```
Browser (React)                       Render web service (Node)                 LiveKit Cloud
┌────────────────────┐   socket.io   ┌───────────────────────────────┐
│ screens + game UI  │◀────────────▶│ rooms.ts (in memory)          │
│ lib/socket.ts      │               │ gameRunner.ts ─▶ GameModule   │
│ lib/voice.ts ──────┼── POST /api/voice-token ──▶ voice.ts ─ signs JWT
│                    │◀──────────── WebRTC audio (SFU) ──────────────────────▶ room holla-CODE
└────────────────────┘               └───────────────────────────────┘
```

- One Node process serves the static client, the Socket.io server and the token endpoint (same origin → no CORS).
- Game state never leaves the server except as per-player views.
- Voice goes browser ⇄ LiveKit directly. Our server only signs tokens.

---

## 3. Game module interface

Every game lives in `shared/src/games/<id>/` and exports a `GameModule`.

```ts
export interface GameModule<State, Action, View, Settings> {
  id: string;                    // 'last-card'
  name: string;                  // 'Last Card'
  minPlayers: number;            // 2
  maxPlayers: number;            // 15
  defaultSettings: Settings;

  setup(players: PlayerRef[], settings: Settings, rng: () => number): State;

  // Validate + apply. Return an error string instead of throwing for illegal moves.
  onAction(state: State, playerId: string, action: Action, ctx: { now: number; rng: () => number })
    : { ok: true; state: State; events: GameEvent[] } | { ok: false; error: string };

  // Called by the runner on a timer (turn timeouts). Optional.
  onTick?(state: State, ctx: { now: number; rng: () => number })
    : { state: State; events: GameEvent[] } | null;

  getPlayerView(state: State, playerId: string): View;   // only what this player may see
  getSpectatorView(state: State): View;                   // nobody's hand
  getResult(state: State): RoundResult | null;            // null while playing
  onPlayerLeft(state: State, playerId: string): State;    // keep the game going
}

type PlayerRef  = { id: string; name: string; avatar: string };
type GameEvent  = { kind: string; text: string; playerId?: string };  // feeds the log + toasts
type RoundResult = { winnerId: string; scores: { playerId: string; cardsLeft: number; points: number }[] };
```

The client side of a game is a React component in `client/src/games/<id>/`:

```ts
type GameUIProps<View, Action> = { view: View; me: string; players: PlayerRef[]; send: (a: Action) => void };
```

Registry (`shared/src/games/index.ts` and `client/src/games/index.ts`) maps `id → module / component`. The core only uses the registry.

---

## 4. Last Card rules

### Deck
- Per colour (red, yellow, green, blue): one 0, two each of 1–9, two Skip, two Reverse, two Draw 2 → 25 cards per colour.
- Plus 4 Wild and 4 Wild Draw 4 → **108 cards**.
- **More than 8 players:** two full decks (216 cards).
- If the draw pile runs out, shuffle the discard pile (except the top card) back in. If both are empty, the player just doesn't draw.

### Setup
- Shuffle, deal 7 to each player.
- Flip the top card. If it isn't a number card, put it back in the deck and flip again.
- The player after the host goes first; play starts clockwise.

### Turn
- Play one card that matches the top card's **colour** or **value/symbol**, or play a Wild.
- Or draw 1 card. If that card is playable you may play it immediately or keep it and pass. Otherwise your turn ends.
- With **Draw until you can play** on: keep drawing until you get a playable card (then you must play it or pass).

### Card effects
| Card | Effect |
|---|---|
| Skip | Next player loses their turn |
| Reverse | Direction flips. **With 2 players it acts as Skip** |
| Draw 2 | Next player draws 2 and loses their turn |
| Wild | Player picks the colour |
| Wild Draw 4 | Player picks the colour; next player draws 4 and loses their turn |

Wild Draw 4 can be played any time (no challenge rule in v1).

### House rules (lobby settings)
| Setting | Default | Behaviour |
|---|---|---|
| Stack draw cards | on | A Draw 2 can be answered with a Draw 2, a Wild Draw 4 with a Wild Draw 4. The total passes on. The first player who can't (or won't) stack draws the total and loses their turn. No mixing +2 and +4 |
| 7 swaps, 0 rotates | off | Playing a 7: choose any player and swap hands. Playing a 0: every hand passes one seat in the current direction |
| Draw until you can play | off | See Turn |
| Shout penalty | on | See below |
| Turn timer | 20s | Off / 20s / 40s. On timeout: auto-draw 1 and pass (stacking total applies if a stack is pending) |

### Last card shout
- A player may press **Last card!** when they hold 2 cards and it's their turn (before playing), or any time they hold 1 card and haven't shouted yet.
- When a player is on 1 card and hasn't shouted, everyone else sees a **Catch!** button on that player's seat.
- First valid catch: the caught player draws 2. The window closes when the next player takes an action, or once they shout.
- Shouting with 3+ cards does nothing (no penalty).

### Ending a round and scoring
- The round ends when a player plays their last card (the final card's effect still applies, e.g. the next player draws 2, for display only).
- Winner scores the value of everyone else's cards: number cards = face value, Skip/Reverse/Draw 2 = 20, Wild/Wild Draw 4 = 50.
- Running totals are kept on the room across rounds until the host returns to the lobby with "Reset scores".

### Players leaving mid-game
- Disconnected players keep their seat for 60s; their turns are auto-passed (draw 1) while away.
- After 60s they're removed: their cards go to the bottom of the draw pile. If only 1 player remains, the round ends.
- If they come back after removal, they join as a spectator until the next round.

---

## 5. Rooms and sessions

- **Room code:** 4 letters from `ABCDEFGHJKLMNPQRSTUVWXYZ` (no I, O). Case-insensitive input.
- **Player identity:** server issues `{ playerId, secret }` on create/join. Client stores it in `localStorage` per room code.
- **Rejoin:** on reconnect the client sends `room:rejoin` with the stored pair. Matching secret → same seat.
- **Limits:** 15 players max. Names 1–14 chars, trimmed, unique within the room (append a digit if taken).
- **Host:** creator. If host disconnects for more than 60s or leaves, the longest-present player becomes host.
- **Cleanup:** a room with no connected players is deleted after 10 minutes.

### Room shape (server)
```ts
type Room = {
  code: string;
  hostId: string;
  players: { id: string; secret: string; name: string; avatar: string; connected: boolean; joinedAt: number; lastSeen: number }[];
  phase: 'lobby' | 'playing' | 'results';
  gameId: 'last-card';
  settings: LastCardSettings;
  game: unknown | null;            // the active module's State
  totals: Record<string, number>;  // scores across rounds
};
```

---

## 6. Socket events

All payloads are typed in `shared/src/events.ts`. Client → server events use acknowledgements (`(res) => ...`) that return `{ ok: true, ... } | { ok: false, error }`.

### Client → server
| Event | Payload | Ack |
|---|---|---|
| `room:create` | `{ name, avatar }` | `{ code, playerId, secret }` |
| `room:join` | `{ code, name, avatar }` | `{ code, playerId, secret }` |
| `room:rejoin` | `{ code, playerId, secret }` | `{ ok }` |
| `room:leave` | `{}` | `{ ok }` |
| `room:settings` | `Partial<Settings>` (host only, lobby only) | `{ ok }` |
| `game:start` | `{}` (host only, ≥ 2 players) | `{ ok }` |
| `game:action` | game-specific `Action` | `{ ok } \| { error }` |
| `game:next` | `{ mode: 'again' \| 'lobby' }` (host only, results phase) | `{ ok }` |
| `fx:react` | `{ emoji }` (whitelisted, max 1 per second per player) | — |

### Server → client
| Event | Payload | When |
|---|---|---|
| `room:state` | lobby view: code, hostId, players (no secrets), phase, settings, totals | any room change |
| `game:view` | this player's `View` | after every accepted action / tick |
| `game:events` | `GameEvent[]` | after actions (log + toasts) |
| `game:result` | `RoundResult` + totals | round end |
| `fx:react` | `{ playerId, emoji }` | someone reacted |

### Last Card actions
```ts
type LastCardAction =
  | { type: 'play'; cardId: string; chosenColor?: Color; swapWith?: string }
  | { type: 'draw' }
  | { type: 'pass' }          // only after drawing
  | { type: 'shout' }
  | { type: 'catch'; targetId: string };
```

### Last Card player view
```ts
type LastCardView = {
  me: { hand: Card[]; playableIds: string[]; mustChooseColor: boolean; canPass: boolean; shouted: boolean };
  seats: { playerId: string; cardCount: number; shouted: boolean; catchable: boolean; connected: boolean }[];
  topCard: Card; currentColor: Color; direction: 1 | -1;
  turnPlayerId: string; turnEndsAt: number | null;
  pendingDraw: number;      // stacking total, 0 if none
  drawPileCount: number;
};
type Color = 'red' | 'yellow' | 'green' | 'blue';
type Card = { id: string; color: Color | 'wild'; value: '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'skip'|'reverse'|'draw2'|'wild'|'wild4' };
```

---

## 7. Voice flow (LiveKit)

1. Player is in a room. Voice is off until they tap **Join voice** (browsers block audio and mic without a tap, especially iOS Safari).
2. Client calls `POST /api/voice-token` with `{ code, playerId, secret }`.
3. Server checks the secret, then creates an `AccessToken` with `identity = playerId`, `name = player name`, grant `{ roomJoin: true, room: 'holla-' + code, canPublish: true, canSubscribe: true }`, TTL about 4 hours, and returns `{ url: LIVEKIT_URL, token }`.
4. Client: `room.connect(url, token)`, `room.startAudio()` (inside the tap), `room.localParticipant.setMicrophoneEnabled(true)`.
5. Speaking rings: listen to `RoomEvent.ActiveSpeakersChanged`; map participant identity → playerId.
6. Mute badges: track muted / unmuted events per participant.
7. Push-to-talk: keep the mic track published, mute it by default, unmute while the button / Space is held.
8. "Mute everyone": set each remote participant's audio volume to 0 (local only).
9. Leaving the room or the tab → `room.disconnect()`.

Later idea (not v1): the server can change per-participant subscribe permissions for team voice or "ghost" channels in other games.

Free plan note: LiveKit Cloud's free Build plan has a monthly allowance of participant minutes. 15 people × 2 hours ≈ 1,800 minutes, so expect 2–3 long game nights a month before needing to self-host LiveKit.

---

## 8. Design tokens (from `design/holla-mock.html`)

```css
--ink:#1B1446;    /* page background (with faint dot grid) */
--ink-2:#2A2070;  --ink-3:#3A2D93;   /* panels, table rug */
--line:#0E0A2E;   /* all outlines + hard shadows */
--paper:#FFF4DC;  --paper-2:#F1E0B8; /* sticker panels */
--red:#FF4D4D; --sun:#FFC21A; --mint:#22C97A; --sky:#2F8BFF; --pink:#FF5FA8;
--shadow:5px 5px 0 var(--line);
--fd:'Lilita One';  /* display: headings, cards, buttons */
--fb:'Nunito';      /* body, weights 700–900 */
```

- **Stickers:** `background: var(--paper); border: 3px solid var(--line); border-radius: 22px; box-shadow: var(--shadow)`.
- **Buttons:** Lilita One, 3px border, 4px offset shadow, press = translate 3px and shrink shadow.
- **Cards:** colour face with diagonal stripes, cream circle with the value, corner values, and a corner shape per colour (red ◆, yellow ●, green ▲, blue ■) for colour-blind players. Wild = 4-colour pinwheel.
- **Card back:** `--line` with a dot grid and a pink "h!" badge.
- **Speaking:** pulsing `--mint` ring around the avatar. **Turn:** `--sun` conic timer ring + yellow name pill.
- **Copy:** sentence case, plain verbs ("Create a room", "Deal another round"). No ALL CAPS labels.
- **Motion:** card fly-to-pile, pop on new top card, "Last card!" stamp, confetti on results. All off under `prefers-reduced-motion`.

### Breakpoints
- **≤ 820px:** single column; seats become a horizontal scroll strip above the table; hand scrolls sideways; voice bar shows icons only.
- **≤ 420px:** voice bar shows 2 reactions instead of 4.
- Table screen must fit 390×844 without scrolling during play; the fixed voice bar must never cover the hand.

---

## 9. Environment variables

| Name | Where | Example |
|---|---|---|
| `LIVEKIT_URL` | server | `wss://holla-xxxx.livekit.cloud` |
| `LIVEKIT_API_KEY` | server | `APIxxxxxxxx` |
| `LIVEKIT_API_SECRET` | server only, never client | `xxxxxxxx` |
| `PORT` | server | `3000` (Render sets this itself) |

In dev, Vite proxies `/api` and `/socket.io` to the server so the client always uses the same origin.

---

## 10. Testing checklist (manual, each phase)

- Three tabs: create, join, refresh mid-lobby, refresh mid-game, close one tab for 30s and come back.
- Phone (real device) on mobile data + laptop on Wi-Fi: voice both ways, speaking rings, push-to-talk.
- 390×844 and 1440×900: nothing overlaps, hand is fully visible above the voice bar.
- Keyboard: tab through cards, Enter plays, Space push-to-talk.
- Reduced motion on: game still fully playable.
- Mic access only works on HTTPS or `localhost`. To test a phone against your laptop, use the deployed URL or a tunnel (for example `cloudflared tunnel --url http://localhost:5173`).

---

## 11. Links

### Voice
- LiveKit docs: https://docs.livekit.io
- LiveKit Cloud dashboard (project, keys): https://cloud.livekit.io
- `livekit-client` (browser SDK): https://www.npmjs.com/package/livekit-client
- `livekit-server-sdk` (token signing): https://www.npmjs.com/package/livekit-server-sdk
- LiveKit pricing / free plan: https://livekit.io/pricing
- LiveKit server (self-hosting later): https://github.com/livekit/livekit

### Realtime + server
- Socket.io v4 docs: https://socket.io/docs/v4/
- Socket.io with TypeScript: https://socket.io/docs/v4/typescript/
- Socket.io connection state recovery: https://socket.io/docs/v4/connection-state-recovery
- Express: https://expressjs.com

### Client
- React: https://react.dev
- Vite guide: https://vite.dev/guide/
- Vite dev server proxy: https://vite.dev/config/server-options#server-proxy
- Vitest: https://vitest.dev
- Google Fonts, Lilita One: https://fonts.google.com/specimen/Lilita+One
- Google Fonts, Nunito: https://fonts.google.com/specimen/Nunito

### Browser APIs
- getUserMedia (mic): https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- Autoplay policy: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- Secure contexts (why HTTPS): https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
- prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- Clipboard (copy invite link): https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText

### Hosting
- Render free instances: https://render.com/docs/free
- Render web services: https://render.com/docs/web-services
- Render environment variables: https://render.com/docs/configure-environment-variables
- npm workspaces: https://docs.npmjs.com/cli/using-npm/workspaces
- Cloudflare quick tunnels (phone testing): https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/
