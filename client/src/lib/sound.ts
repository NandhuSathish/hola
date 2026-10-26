/**
 * The noises.
 *
 * Eight short mp3s from Mixkit, committed under `public/sounds` so they ship
 * with the build and nothing is fetched from a third party mid-game — see
 * the README there for what each one is and the licence.
 *
 * CLAUDE.md asks for small, optional and mutable, which is the whole brief:
 * nothing here loads until the first cue, a browser that refuses to play is
 * simply quiet, and the mute sticks.
 */

const MUTE_KEY = 'holla:muted';

export type Cue =
  /** A button that commits something: a card, a number, a roll. */
  | 'tap'
  /** A card landing on the pile. */
  | 'play'
  /** Taking a card from the deck. */
  | 'draw'
  /** Dice leaving your hand. */
  | 'roll'
  /** A ladder, a boundary, anything that went your way. */
  | 'good'
  /** A snake, a wicket, anything that did not. */
  | 'bad'
  /** Somebody reacted. */
  | 'pop'
  /** The round is over and you won it. */
  | 'win';

/** Per-cue volume, because the source files are nowhere near matched. */
const LEVEL: Record<Cue, number> = {
  tap: 0.35,
  play: 0.45,
  draw: 0.3,
  roll: 0.4,
  good: 0.4,
  bad: 0.4,
  pop: 0.3,
  win: 0.5,
};

/**
 * How long to let each one run, in milliseconds.
 *
 * Several of the source files are two to four seconds, almost all of it
 * reverb tail — fine as a sample on a web page, far too long as a cue you
 * hear twenty times a round. These are cut to the part that carries the
 * news. `win` is the exception: the round is over, so it may ring out.
 */
const CAP: Partial<Record<Cue, number>> = {
  draw: 700,
  roll: 900,
  good: 1200,
  bad: 1000,
  pop: 500,
};

let muted = read();

function read(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    /* no storage, no memory of it; the toggle still works this session */
  }
}

/**
 * One `Audio` per cue, made on first use and rewound on every play.
 *
 * Reusing the element means a cue that fires twice quickly restarts rather
 * than overlapping, which is what you want for a click and tolerable for the
 * rest. It also keeps us to eight elements however long the night runs.
 */
const players = new Map<Cue, HTMLAudioElement>();
/** Pending cut-offs, one per cue, so a repeat does not strand the last one. */
const stops = new Map<Cue, number>();

function element(cue: Cue): HTMLAudioElement | null {
  const existing = players.get(cue);
  if (existing) return existing;
  try {
    const el = new Audio(`/sounds/${cue}.mp3`);
    el.preload = 'auto';
    el.volume = LEVEL[cue];
    players.set(cue, el);
    return el;
  } catch {
    return null;
  }
}

/**
 * Make a noise.
 *
 * Silent when muted. A browser that will not play before the page has been
 * touched rejects the promise, which is expected rather than a fault — the
 * next cue after a tap works.
 */
export function play(cue: Cue): void {
  if (muted) return;
  const el = element(cue);
  if (!el) return;
  try {
    el.currentTime = 0;
    void el.play().catch(() => {});

    const cap = CAP[cue];
    if (cap !== undefined) {
      window.clearTimeout(stops.get(cue));
      stops.set(
        cue,
        window.setTimeout(() => {
          el.pause();
          el.currentTime = 0;
        }, cap),
      );
    }
  } catch {
    /* nothing to be done about it, and silence is an acceptable outcome */
  }
}

/**
 * Pull them into the cache on the first gesture, so the first real cue is
 * not the one that has to wait for a download.
 */
export function warmUp(): void {
  if (muted) return;
  for (const cue of Object.keys(LEVEL) as Cue[]) element(cue);
}
