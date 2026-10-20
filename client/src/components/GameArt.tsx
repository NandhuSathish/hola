/** Cover art for the picker. Kept here so the screen stays readable. */

const CARDS = [
  { colour: 'var(--red)', value: '7', rotate: -17, shift: -48 },
  { colour: 'var(--sun)', value: '8', rotate: -6, shift: -16 },
  { colour: 'var(--mint)', value: '4', rotate: 5, shift: 16 },
  { colour: 'var(--sky)', value: '2', rotate: 16, shift: 48 },
];

export function LastCardArt() {
  return (
    <div className="art-fan" aria-hidden="true">
      {CARDS.map((card) => (
        <span
          key={card.value}
          className="art-card"
          style={{
            background: card.colour,
            transform: `rotate(${card.rotate}deg) translateX(${card.shift}px)`,
          }}
        >
          <span className="art-face" style={{ color: card.colour }}>{card.value}</span>
        </span>
      ))}
    </div>
  );
}

export function SnakesArt() {
  return (
    <svg viewBox="0 0 120 100" className="art-svg" aria-hidden="true">
      <rect x="9" y="9" width="102" height="82" rx="9" fill="var(--paper)" stroke="var(--line)" strokeWidth="3" />
      <g stroke="var(--line)" strokeWidth="1.8" opacity=".55">
        <path d="M9 30h102M9 50h102M9 70h102M35 9v82M60 9v82M85 9v82" />
      </g>
      {/* dark underlay then colour, for the sticker outline look */}
      <g strokeLinecap="round" fill="none">
        <path d="M23 83 L31 19" stroke="var(--line)" strokeWidth="9" />
        <path d="M36 83 L44 19" stroke="var(--line)" strokeWidth="9" />
        <path d="M23 83 L31 19" stroke="var(--sun)" strokeWidth="4.5" />
        <path d="M36 83 L44 19" stroke="var(--sun)" strokeWidth="4.5" />
        <g stroke="var(--line)" strokeWidth="2.6">
          <path d="M24 72h12M26 58h12M28 44h12M30 30h12" />
        </g>
      </g>
      <path d="M94 24 C72 36, 99 51, 77 63 C62 72, 87 79, 85 88" fill="none" stroke="var(--line)" strokeWidth="12" strokeLinecap="round" />
      <path d="M94 24 C72 36, 99 51, 77 63 C62 72, 87 79, 85 88" fill="none" stroke="var(--mint)" strokeWidth="6.5" strokeLinecap="round" />
      <circle cx="95" cy="23" r="8" fill="var(--mint)" stroke="var(--line)" strokeWidth="3" />
      <circle cx="92.5" cy="21" r="1.7" fill="var(--line)" />
    </svg>
  );
}

export function HandCricketArt() {
  return (
    <svg viewBox="0 0 120 100" className="art-svg" aria-hidden="true">
      {/* the pitch, going away from you */}
      <path d="M30 92 L44 46 L76 46 L90 92 Z" fill="#E9C784" stroke="var(--line)" strokeWidth="3" />

      {/* stumps at the far end */}
      <g stroke="var(--line)" strokeWidth="3" strokeLinecap="round">
        <path d="M54 46v-16M60 46v-17M66 46v-16" />
      </g>
      <rect x="51" y="27" width="18" height="4" rx="2" fill="var(--sun)" stroke="var(--line)" strokeWidth="2.4" />

      {/* the two numbers thrown at once, which is the whole game */}
      <g>
        <rect x="6" y="40" width="34" height="40" rx="9" fill="var(--sky)" stroke="var(--line)" strokeWidth="3.4" transform="rotate(-8 23 60)" />
        <text x="23" y="61" transform="rotate(-8 23 60)" textAnchor="middle" dominantBaseline="middle" fill="var(--line)" style={{ font: '400 26px var(--fd)' }}>4</text>
      </g>
      <g>
        <rect x="80" y="40" width="34" height="40" rx="9" fill="var(--pink)" stroke="var(--line)" strokeWidth="3.4" transform="rotate(8 97 60)" />
        <text x="97" y="61" transform="rotate(8 97 60)" textAnchor="middle" dominantBaseline="middle" fill="var(--line)" style={{ font: '400 26px var(--fd)' }}>6</text>
      </g>

      {/* the ball on its way */}
      <circle cx="60" cy="70" r="7" fill="var(--red)" stroke="var(--line)" strokeWidth="3" />
      <path d="M55.5 70a6 6 0 0 1 5-5" fill="none" stroke="var(--paper)" strokeWidth="1.8" />
    </svg>
  );
}
