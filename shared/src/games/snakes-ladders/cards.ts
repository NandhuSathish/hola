/**
 * The mystery box deck, from design/snakes-ladders-mock.html.
 *
 * Every card is a rule, so the whole deck lives in the engine. The client only
 * needs the id to show the right art and wording.
 */
export type CardId =
  | 'rocket'
  | 'banana'
  | 'swap'
  | 'shield'
  | 'double'
  | 'freeze'
  | 'charm'
  | 'quake';

export type MysteryCard = {
  id: CardId;
  name: string;
  text: string;
  /** Relative draw weight; the good cards come up more often. */
  weight: number;
};

export const MYSTERY_DECK: readonly MysteryCard[] = [
  { id: 'rocket', name: 'Rocket boots', text: 'Blast 10 tiles ahead.', weight: 2 },
  { id: 'banana', name: 'Banana peel', text: 'Whoops. Slip back 4 tiles.', weight: 2 },
  { id: 'swap', name: 'Swap spot', text: 'Trade places with a random player.', weight: 1 },
  {
    id: 'shield',
    name: 'Snake shield',
    text: 'The next snake that tries to eat you gets bonked.',
    weight: 2,
  },
  { id: 'double', name: 'Double dice', text: 'Roll two dice on your next turn.', weight: 2 },
  { id: 'freeze', name: 'Freeze ray', text: 'The next player misses a turn.', weight: 1 },
  {
    id: 'charm',
    name: 'Snake charmer',
    text: 'The next snake ahead of you naps for 3 rounds.',
    weight: 1,
  },
  { id: 'quake', name: 'Earthquake', text: 'Everyone else stumbles back 2 tiles.', weight: 1 },
];

export const ROCKET_TILES = 10;
export const BANANA_TILES = 4;
export const QUAKE_TILES = 2;
/** Rounds a charmed snake stays asleep. */
export const CHARM_ROUNDS = 3;

export function cardById(id: CardId): MysteryCard | undefined {
  return MYSTERY_DECK.find((c) => c.id === id);
}

/** Weighted draw from an injected rng, so a seed replays the same cards. */
export function drawCard(rng: () => number): MysteryCard {
  const total = MYSTERY_DECK.reduce((sum, c) => sum + c.weight, 0);
  let roll = rng() * total;
  for (const card of MYSTERY_DECK) {
    roll -= card.weight;
    if (roll <= 0) return card;
  }
  return MYSTERY_DECK[0] as MysteryCard;
}
