/**
 * Watches bots play a full round of Last Card.
 *
 * A pure engine has nothing to click, so this is how a human checks the rules
 * actually behave. It lives outside shared/ on purpose: rule 3 says no side
 * effects in the engine, and this thing prints.
 *
 *   npm run sim                      one readable 15-bot game
 *   npm run sim -- --players 4       fewer seats
 *   npm run sim -- --seed 7          a specific deal
 *   npm run sim -- --games 200       silent soak: every seed must finish cleanly
 *   npm run sim -- --rules all       turn on stacking, 7-0 and draw-until
 */
import {
  LAST_CARD_DEFAULTS,
  lastCard,
  type Card,
  type LastCardAction,
  type LastCardSettings,
  type LastCardState,
  type PlayerRef,
} from '@holla/shared';

const NAMES = [
  'Meera', 'Arjun', 'Rahul', 'Anjali', 'Vishnu', 'Fathima', 'Sreya', 'Akhil',
  'Neha', 'Joel', 'Diya', 'Kiran', 'Ammu', 'Sanju', 'Nandhu',
];

const SWATCH: Record<string, string> = {
  red: '🟥',
  yellow: '🟨',
  green: '🟩',
  blue: '🟦',
  wild: '⬛',
};

const LABEL: Partial<Record<Card['value'], string>> = {
  skip: 'skip',
  reverse: 'reverse',
  draw2: '+2',
  wild: 'wild',
  wild4: 'wild +4',
};

function show(card: Card): string {
  return `${SWATCH[card.color] ?? '  '} ${LABEL[card.value] ?? card.value}`;
}

/** Mulberry32 — small, fast, and the same sequence for the same seed. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseArgs(argv: string[]) {
  const get = (flag: string, fallback: number) => {
    const i = argv.indexOf(flag);
    if (i === -1) return fallback;
    const value = Number(argv[i + 1]);
    return Number.isFinite(value) ? value : fallback;
  };
  const rules = (argv.includes('--rules') ? argv[argv.indexOf('--rules') + 1] : 'default') ?? 'default';
  return {
    players: Math.max(2, Math.min(15, get('--players', 15))),
    seed: get('--seed', 1),
    games: get('--games', 1),
    rules,
  };
}

function settingsFor(mode: string): LastCardSettings {
  if (mode === 'all') {
    return {
      ...LAST_CARD_DEFAULTS,
      stackDraw: true,
      sevenZero: true,
      drawUntilPlayable: true,
      shoutPenalty: true,
      turnTimer: 0,
    };
  }
  return { ...LAST_CARD_DEFAULTS, turnTimer: 0 };
}

type Bot = PlayerRef;

/** Plays a legal move, with just enough taste to make the log interesting. */
function chooseAction(state: LastCardState, me: string, rng: () => number): LastCardAction {
  const view = lastCard.getPlayerView(state, me);
  const playable = view.me.playableIds;

  if (playable.length === 0) return { type: 'draw' };

  const id = playable[Math.floor(rng() * playable.length)] ?? playable[0]!;
  const seat = state.seats.find((s) => s.id === me);
  const card = seat?.hand.find((c) => c.id === id);
  const action: LastCardAction = { type: 'play', cardId: id };

  if (card && (card.value === 'wild' || card.value === 'wild4')) {
    // Pick whichever colour the bot holds most of.
    const counts = new Map<string, number>();
    for (const c of seat?.hand ?? []) {
      if (c.color !== 'wild') counts.set(c.color, (counts.get(c.color) ?? 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    action.chosenColor = (best ?? 'red') as 'red' | 'yellow' | 'green' | 'blue';
  }

  if (card && card.value === '7' && state.settings.sevenZero) {
    // Swap with whoever is closest to going out.
    const victim = state.seats
      .filter((s) => s.id !== me)
      .sort((a, b) => a.hand.length - b.hand.length)[0];
    if (victim) action.swapWith = victim.id;
  }

  return action;
}

type Outcome = { winner: string | null; turns: number; stalled: boolean };

function playGame(bots: Bot[], settings: LastCardSettings, seed: number, loud: boolean): Outcome {
  const rng = seeded(seed);
  const name = (id: string) => bots.find((b) => b.id === id)?.name ?? id;

  let state = lastCard.setup(bots, settings, { now: 0, rng });
  let turns = 0;
  const LIMIT = 4000;

  if (loud) {
    console.log(`\n  Top card ${show(lastCard.getSpectatorView(state).topCard)}`);
    console.log(`  ${name(state.seats[state.turnIndex]!.id)} leads\n`);
  }

  while (!state.finished && turns < LIMIT) {
    turns++;
    const seat = state.seats[state.turnIndex];
    if (!seat) break;

    // Shout before playing, most of the time, when down to two.
    if (seat.hand.length === 2 && !seat.shouted && rng() < 0.75) {
      const shout = lastCard.onAction(state, seat.id, { type: 'shout' }, { now: 0, rng });
      if (shout.ok) {
        state = shout.state;
        if (loud) console.log(`  ${pad(name(seat.id))} shouts LAST CARD!`);
      }
    }

    const action = chooseAction(state, seat.id, rng);
    const result = lastCard.onAction(state, seat.id, action, { now: 0, rng });

    if (!result.ok) {
      throw new Error(
        `illegal move from ${name(seat.id)}: ${JSON.stringify(action)} -> ${result.error}`,
      );
    }
    state = result.state;
    if (loud) {
      for (const e of result.events) console.log(`  ${pad(name(e.playerId ?? ''))} ${e.text}`);
    }

    // Whoever is still holding one card unshouted is fair game.
    if (state.catchableId) {
      const hunter = state.seats.find((s) => s.id !== state.catchableId);
      if (hunter && rng() < 0.5) {
        const caught = lastCard.onAction(
          state,
          hunter.id,
          { type: 'catch', targetId: state.catchableId },
          { now: 0, rng },
        );
        if (caught.ok) {
          state = caught.state;
          if (loud) {
            console.log(`  ${pad(name(hunter.id))} CATCHES ${name(caught.events[0]?.playerId ?? '')}!`);
          }
        }
      }
    }

    // A player who drew something playable still holds the turn.
    const stillMine = state.seats[state.turnIndex]?.id === seat.id;
    if (stillMine && !state.finished) {
      const follow = lastCard.getPlayerView(state, seat.id);
      const next: LastCardAction =
        follow.me.playableIds.length > 0 && rng() < 0.8
          ? chooseAction(state, seat.id, rng)
          : { type: 'pass' };
      const after = lastCard.onAction(state, seat.id, next, { now: 0, rng });
      if (after.ok) {
        state = after.state;
        if (loud) for (const e of after.events) console.log(`  ${pad(name(e.playerId ?? ''))} ${e.text}`);
      }
    }
  }

  if (loud) {
    const result = lastCard.getResult(state);
    console.log('\n  ── result ' + '─'.repeat(44));
    if (result) {
      console.log(`  ${name(result.winnerId)} wins with ${result.scores.find((s) => s.playerId === result.winnerId)?.points} points\n`);
      for (const row of [...result.scores].sort((a, b) => a.cardsLeft - b.cardsLeft)) {
        console.log(
          `  ${pad(name(row.playerId))} ${String(row.cardsLeft).padStart(2)} cards left   ${String(row.points).padStart(3)} pts`,
        );
      }
    } else {
      console.log('  no winner — the round stopped early');
    }
    console.log(`\n  ${turns} turns\n`);
  }

  return { winner: state.winnerId, turns, stalled: turns >= LIMIT };
}

const pad = (s: string) => s.padEnd(9);

function main() {
  const args = parseArgs(process.argv.slice(2));
  const settings = settingsFor(args.rules);
  const bots: Bot[] = NAMES.slice(0, args.players).map((name, i) => ({
    id: `p${i}`,
    name,
    look: { style: i % 8, skin: i % 5, hair: i % 6 },
  }));

  if (args.games === 1) {
    console.log(`\n  Last Card — ${args.players} bots, seed ${args.seed}, rules: ${args.rules}`);
    console.log('  ' + '─'.repeat(52));
    playGame(bots, settings, args.seed, true);
    return;
  }

  // Soak mode: every seed must finish without an illegal move or a stall.
  console.log(`\n  Soaking ${args.games} games, ${args.players} bots, rules: ${args.rules}\n`);
  let stalls = 0;
  let totalTurns = 0;
  const wins = new Map<string, number>();

  for (let i = 0; i < args.games; i++) {
    const out = playGame(bots, settings, args.seed + i, false);
    totalTurns += out.turns;
    if (out.stalled) {
      stalls++;
      console.log(`  seed ${args.seed + i} STALLED`);
    }
    if (out.winner) wins.set(out.winner, (wins.get(out.winner) ?? 0) + 1);
  }

  const named = (id: string) => bots.find((b) => b.id === id)?.name ?? id;
  console.log(`  finished:     ${args.games - stalls}/${args.games}`);
  console.log(`  stalled:      ${stalls}`);
  console.log(`  avg turns:    ${(totalTurns / args.games).toFixed(1)}`);
  console.log(`  distinct winners: ${wins.size}`);
  const top = [...wins.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) console.log(`  most wins:    ${named(top[0])} (${top[1]})`);
  console.log('');

  if (stalls > 0) process.exit(1);
}

main();
