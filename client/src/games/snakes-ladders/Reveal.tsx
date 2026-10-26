import { useEffect, useRef, useState } from 'react';
import { cardById, type Look } from '@holla/shared';
import { Head } from '../../components/Fighter';
import { CARD_ART } from './icons';
import './Reveal.css';

/** How long the card sits face-down before it turns over. */
const FLIP_DELAY_MS = 550;
/** How long the reveal stays up once flipped, if nobody dismisses it. */
const HOLD_MS = 4200;

type CardProps = {
  card: string;
  who: string;
  look: Look;
  seat: number;
  /** Your own box gets a button; someone else's just plays out. */
  mine: boolean;
  reduced: boolean;
  onClose: () => void;
};

/**
 * The mystery box reveal, from the mock: a card sits face-down with a "?" on
 * it, turns over, and shows what you got.
 *
 * It is purely a telling of something the server already decided — the engine
 * has long since applied the card's effect — so it never gates play. It closes
 * itself whether or not anyone touches it.
 */
export function CardReveal({ card, who, look, seat, mine, reduced, onClose }: CardProps) {
  const [flipped, setFlipped] = useState(reduced);
  const detail = cardById(card as never);
  const art = CARD_ART[card];

  // Held in a ref so the timers below do not depend on it. The table
  // re-renders on every turn-clock tick, and an inline onClose in the
  // dependency list would restart the flip before it ever ran.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    // Reduced motion gets the face immediately and a shorter sit: the point is
    // the information, not the turn.
    const delay = reduced ? 0 : FLIP_DELAY_MS;
    const flip = window.setTimeout(() => setFlipped(true), delay);
    const close = window.setTimeout(
      () => closeRef.current(),
      delay + (reduced ? 1800 : HOLD_MS),
    );
    return () => {
      window.clearTimeout(flip);
      window.clearTimeout(close);
    };
  }, [card, reduced]);

  if (!detail || !art) return null;
  const { Icon, colour } = art;

  return (
    <div className="sl-ov show" role="dialog" aria-live="polite">
      <div className="sticker sl-ov-card">
        <div className="sl-ov-who">
          <Head look={look} seat={seat} size={28} />
          <span>{mine ? 'You open' : `${who} opens`} a mystery box</span>
        </div>

        <div className={`sl-card3d${flipped ? ' flipped' : ''}`}>
          <div className="sl-card3d-inner">
            <div className="sl-card-front" aria-hidden="true">?</div>
            <div className="sl-card-back" style={{ ['--c' as string]: colour }}>
              <Icon />
              <b>{detail.name}</b>
              <small>{detail.text}</small>
            </div>
          </div>
        </div>

        <button type="button" className="btn btn-pink sl-ov-ok" onClick={onClose}>
          {mine ? 'Nice!' : 'Got it'}
        </button>
      </div>
    </div>
  );
}

export type StampCue = { text: string; colour: string; at: number };

/**
 * The big word that slams over the board — "Ladder!", "Gulp…", "Rocket!".
 *
 * Keyed on `at` so the same word twice in a row still replays the animation;
 * without that, React would reuse the element and nothing would move.
 */
export function Stamp({ cue }: { cue: StampCue | null }) {
  if (!cue) return null;
  return (
    <div className="sl-stamp" key={cue.at} aria-hidden="true">
      <span style={{ ['--c' as string]: cue.colour }}>{cue.text}</span>
    </div>
  );
}
