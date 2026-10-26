/**
 * Small interface icons, in the mock's stroked sticker style: 2.4px round
 * caps on a 24-unit grid, drawn in `currentColor` so a button's own colour
 * carries them.
 *
 * Game art lives with its game; this is only the chrome.
 */
type Props = { className?: string };

const stroked = (inner: React.ReactNode) =>
  function Icon({ className }: Props) {
    return (
      <svg
        className={['ui-icon', className].filter(Boolean).join(' ')}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {inner}
      </svg>
    );
  };

/** Two stacked sheets. */
export const CopyIcon = stroked(
  <>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" />
  </>,
);

/** A chain link, for the invite URL. */
export const LinkIcon = stroked(
  <>
    <path d="M10 13.5a4 4 0 0 0 5.7.4l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.5 1.5" />
    <path d="M14 10.5a4 4 0 0 0-5.7-.4l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.5-1.5" />
  </>,
);

/** A door with an arrow heading out — the mock's own leave glyph. */
export const LeaveIcon = stroked(
  <>
    <path d="M14 4h5v16h-5" />
    <path d="M10 8l-4 4 4 4M6 12h10" />
  </>,
);

/** Confirmation, so a copy says so without moving anything. */
export const CheckIcon = stroked(<path d="M4.5 12.5l5 5 10-11" />);

/** Back to the start. */
export const HomeIcon = stroked(
  <>
    <path d="M4 10.5L12 4l8 6.5" />
    <path d="M6 9.5V20h12V9.5" />
  </>,
);
