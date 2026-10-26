/**
 * The mock's icon set, ported one for one from design/snakes-ladders-mock.html.
 *
 * These are not decoration: a mystery card, a crowd-vote option and a log line
 * are all identified by shape as well as colour (rule 8), so the same drawing
 * has to appear in all three places.
 */
import { INK, MINT, PAPER, PINK, RED, SKY, SUN } from '../../art/palette';
import { LeaveIcon } from '../../components/icons';

const L = INK;

type Props = { className?: string };

const svg = (inner: React.ReactNode) =>
  function Icon({ className }: Props) {
    return (
      <svg
        className={className}
        viewBox="0 0 48 48"
        aria-hidden="true"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {inner}
      </svg>
    );
  };

export const GiftIcon = svg(
  <>
    <rect x="8" y="20" width="32" height="22" rx="3" fill={PINK} stroke={L} strokeWidth="3" />
    <rect x="6" y="13" width="36" height="9" rx="2.5" fill={PINK} stroke={L} strokeWidth="3" />
    <path d="M24 14v27" stroke={SUN} strokeWidth="5" />
    <path d="M24 13c-6-9-14-5-10 0M24 13c6-9 14-5 10 0" fill="none" stroke={L} strokeWidth="3" />
  </>,
);

export const SnakeIcon = svg(
  <>
    <path
      d="M7 38c7 0 7-8 13-8s6 8 13 8c6 0 8-8 3-13"
      fill="none"
      stroke={L}
      strokeWidth="11"
    />
    <path
      d="M7 38c7 0 7-8 13-8s6 8 13 8c6 0 8-8 3-13"
      fill="none"
      stroke={MINT}
      strokeWidth="6"
    />
    <circle cx="34" cy="18" r="9" fill={MINT} stroke={L} strokeWidth="3" />
    <circle cx="37" cy="16" r="2.4" fill={L} />
    <path d="M42 21l4 2M42 21l3 4" stroke={RED} strokeWidth="2" />
  </>,
);

export const VoteIcon = svg(
  <>
    <path d="M9 20h8l17-9v26l-17-9H9z" fill={SUN} stroke={L} strokeWidth="3" />
    <path d="M13 28l3 10h5l-2-10" fill={PAPER} stroke={L} strokeWidth="3" />
    <path d="M39 17q4 7 0 14M43 13q6 11 0 22" fill="none" stroke={L} strokeWidth="3" />
  </>,
);

export const CrownIcon = svg(
  <>
    <path d="M8 33l3-18 8 8 5-12 5 12 8-8 3 18z" fill={SUN} stroke={L} strokeWidth="3" />
    <rect x="8" y="33" width="32" height="7" rx="2" fill={SUN} stroke={L} strokeWidth="3" />
    <circle cx="24" cy="36.5" r="2" fill={PINK} />
  </>,
);

export const ShieldIcon = svg(
  <>
    <path d="M24 5l15 6v11c0 10-7 16-15 21C16 38 9 32 9 22V11z" fill={SKY} stroke={L} strokeWidth="3" />
    <path d="M17 23l5 5 9-10" fill="none" stroke={PAPER} strokeWidth="4" />
  </>,
);

export const RocketIcon = svg(
  <>
    <path d="M24 4c8 6 10 16 6 26H18C14 20 16 10 24 4z" fill={PAPER} stroke={L} strokeWidth="3" />
    <circle cx="24" cy="16" r="4" fill={SKY} stroke={L} strokeWidth="2.5" />
    <path d="M18 25l-6 7 7-1M30 25l6 7-7-1" fill={RED} stroke={L} strokeWidth="2.5" />
    <path d="M20 31l4 11 4-11" fill={SUN} stroke={L} strokeWidth="2.5" />
  </>,
);

export const BananaIcon = svg(
  <>
    <path
      d="M10 13c2 17 16 25 31 19-2 5-9 9-17 8C13 39 5 28 8 13z"
      fill={SUN}
      stroke={L}
      strokeWidth="3"
    />
    <path d="M8 13l-1-6 5 2" fill="#6E4325" stroke={L} strokeWidth="2.5" />
  </>,
);

export const SwapIcon = svg(
  <>
    <path d="M10 17h24l-7-7" fill="none" stroke={L} strokeWidth="7" />
    <path d="M10 17h24l-7-7" fill="none" stroke={PAPER} strokeWidth="3" />
    <path d="M38 31H14l7 7" fill="none" stroke={L} strokeWidth="7" />
    <path d="M38 31H14l7 7" fill="none" stroke={PAPER} strokeWidth="3" />
  </>,
);

export const DiceIcon = svg(
  <>
    <rect
      x="5" y="14" width="21" height="21" rx="5"
      fill={PAPER} stroke={L} strokeWidth="3" transform="rotate(-10 15 24)"
    />
    <rect
      x="22" y="12" width="21" height="21" rx="5"
      fill={PAPER} stroke={L} strokeWidth="3" transform="rotate(12 32 22)"
    />
    <circle cx="12" cy="21" r="2.2" fill={L} />
    <circle cx="18" cy="28" r="2.2" fill={L} />
    <circle cx="28" cy="18" r="2.2" fill={L} />
    <circle cx="32" cy="23" r="2.2" fill={L} />
    <circle cx="36" cy="28" r="2.2" fill={L} />
  </>,
);

export const FreezeIcon = svg(
  <>
    <g stroke={L} strokeWidth="6">
      <path d="M24 5v38M7.5 14.5l33 19M7.5 33.5l33-19" />
    </g>
    <g stroke={PAPER} strokeWidth="2.6">
      <path d="M24 5v38M7.5 14.5l33 19M7.5 33.5l33-19M19 8l5 5 5-5M19 40l5-5 5 5" />
    </g>
  </>,
);

export const FluteIcon = svg(
  <>
    <g transform="rotate(-25 24 26)">
      <rect x="4" y="22" width="38" height="9" rx="4.5" fill="#E8A55B" stroke={L} strokeWidth="3" />
      <circle cx="16" cy="26.5" r="1.8" fill={L} />
      <circle cx="23" cy="26.5" r="1.8" fill={L} />
      <circle cx="30" cy="26.5" r="1.8" fill={L} />
    </g>
    <path d="M34 5v12M34 5l7 2v4" fill="none" stroke={L} strokeWidth="2.6" />
    <circle cx="32" cy="17" r="3" fill={L} />
  </>,
);

export const QuakeIcon = svg(
  <>
    <path d="M3 29h42v13H3z" fill="#E9C784" stroke={L} strokeWidth="3" />
    <path d="M23 29l-5 5 6 2-4 6" fill="none" stroke={L} strokeWidth="3" />
    <path d="M10 22l3-6M24 20v-8M38 22l-3-6" stroke={L} strokeWidth="3" />
  </>,
);

export const LadderIcon = svg(
  <>
    <path d="M15 4v40M33 4v40" stroke={L} strokeWidth="7" />
    <path d="M15 4v40M33 4v40" stroke="#FFB547" strokeWidth="3.5" />
    <path d="M15 12h18M15 22h18M15 32h18M15 41h18" stroke={L} strokeWidth="3.5" />
  </>,
);

/** The icon and jacket colour for each mystery card, matching the mock. */
export const CARD_ART: Record<string, { Icon: (p: Props) => React.ReactElement; colour: string }> = {
  rocket: { Icon: RocketIcon, colour: SKY },
  banana: { Icon: BananaIcon, colour: SUN },
  swap: { Icon: SwapIcon, colour: '#B48CFF' },
  shield: { Icon: ShieldIcon, colour: SKY },
  double: { Icon: DiceIcon, colour: MINT },
  freeze: { Icon: FreezeIcon, colour: '#5FD3E8' },
  charm: { Icon: FluteIcon, colour: '#FF9F45' },
  quake: { Icon: QuakeIcon, colour: RED },
};

/** The icon for a crowd-vote option, keyed by the engine's `icon` name. */
export const VOTE_ART: Record<string, { Icon: (p: Props) => React.ReactElement; colour: string }> =
  CARD_ART;

/** What a log line of each kind gets as its bullet, when no player owns it. */
export const LOG_ART: Record<string, (p: Props) => React.ReactElement> = {
  ladder: LadderIcon,
  snake: SnakeIcon,
  bonk: ShieldIcon,
  box: GiftIcon,
  crowd: VoteIcon,
  crowdResult: VoteIcon,
  noodle: CrownIcon,
  standoff: SnakeIcon,
  charmed: FluteIcon,
  freeze: FreezeIcon,
  quake: QuakeIcon,
  swap: SwapIcon,
  win: CrownIcon,
  left: LeaveIcon,
};
