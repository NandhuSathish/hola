import type { Card } from '@holla/shared';

/**
 * Every colour carries a shape as well, so the table still reads for
 * colour-blind players (REFERENCE.md section 8).
 */
const SHAPE: Record<string, string> = {
  red: 'diamond',
  yellow: 'circle',
  green: 'triangle',
  blue: 'square',
};

const FACE: Partial<Record<Card['value'], string>> = {
  skip: '⊘',
  reverse: '⇄',
  draw2: '+2',
  wild4: '+4',
  wild: '',
};

export function face(card: Card): string {
  return FACE[card.value] ?? card.value;
}

export function describeCard(card: Card): string {
  const words: Partial<Record<Card['value'], string>> = {
    skip: 'skip',
    reverse: 'reverse',
    draw2: 'draw two',
    wild: 'wild',
    wild4: 'wild draw four',
  };
  const word = words[card.value] ?? card.value;
  return card.color === 'wild' ? word : `${card.color} ${word}`;
}

/** Wilds get their colour from .card-wild, not from the card itself. */
function colourStyle(card: Card): React.CSSProperties {
  return card.color === 'wild' ? {} : ({ ['--c']: `var(--${card.color})` } as React.CSSProperties);
}

type Props = {
  card: Card;
  playable?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
};

export function PlayingCard({ card, playable, dimmed, onClick, style }: Props) {
  const wild = card.color === 'wild';
  const className = [
    'card',
    wild ? 'card-wild' : '',
    playable ? 'playable' : '',
    dimmed ? 'dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <span className="card-corner">{face(card)}</span>
      {!wild && <span className={`card-shape shape-${SHAPE[card.color] ?? 'circle'}`} />}
      <span className="card-face">{face(card)}</span>
      <span className="card-corner card-corner-br">{face(card)}</span>
    </>
  );

  if (!onClick) {
    return (
      <div className={className} style={{ ...style, ...colourStyle(card) }}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      style={{ ...style, ...colourStyle(card) }}
      onClick={onClick}
      aria-label={(playable ? 'Play ' : 'Cannot play ') + describeCard(card)}
    >
      {body}
    </button>
  );
}

/** Face-down card, for the draw pile. */
export function CardBack({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="card card-back" style={style} aria-hidden="true">
      <span className="card-face">h!</span>
    </div>
  );
}
