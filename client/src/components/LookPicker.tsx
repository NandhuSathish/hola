import { HAIRS, SKINS, STYLES, type Look } from '@holla/shared';
import { FighterPreview } from './Fighter';
import './LookPicker.css';

type Props = {
  look: Look;
  onChange: (look: Look) => void;
  /** Seat index, so the preview wears the jersey you will actually have. */
  seat?: number;
};

/**
 * Build your fighter: head style, skin tone, hair colour.
 *
 * Three rows rather than a grid of 240 combinations, and the preview is live,
 * so every tap shows the thing you will be on the board.
 *
 * The stage and the rows are separate exports because Home gives the fighter a
 * whole column of its own on a wide screen, while the lobby's restyle panel
 * wants them stacked in one sticker.
 */
export function LookPicker({ look, onChange, seat = 0 }: Props) {
  return (
    <div className="look-picker">
      <LookStage look={look} seat={seat} />
      <LookRows look={look} onChange={onChange} />
    </div>
  );
}

export function LookStage({
  look,
  seat = 0,
  height = 158,
}: {
  look: Look;
  seat?: number;
  height?: number;
}) {
  return (
    <div className="look-stage">
      <FighterPreview look={look} seat={seat} height={height} />
    </div>
  );
}

export function LookRows({ look, onChange }: Omit<Props, 'seat'>) {
  const set = (patch: Partial<Look>) => onChange({ ...look, ...patch });

  return (
    <div className="look-rows">
      <Row label="Head">
        {STYLES.map((style, i) => (
          <button
            key={style.id}
            type="button"
            role="radio"
            aria-checked={look.style === i}
            aria-label={style.name}
            title={style.name}
            className={`look-chip${look.style === i ? ' on' : ''}`}
            onClick={() => set({ style: i })}
          >
            {style.name}
          </button>
        ))}
      </Row>

      <Row label="Skin">
        {SKINS.map((colour, i) => (
          <button
            key={colour}
            type="button"
            role="radio"
            aria-checked={look.skin === i}
            aria-label={`Skin tone ${i + 1}`}
            className={`look-swatch${look.skin === i ? ' on' : ''}`}
            style={{ background: colour }}
            onClick={() => set({ skin: i })}
          />
        ))}
      </Row>

      <Row label="Hair">
        {HAIRS.map((colour, i) => (
          <button
            key={colour}
            type="button"
            role="radio"
            aria-checked={look.hair === i}
            aria-label={`Hair colour ${i + 1}`}
            className={`look-swatch${look.hair === i ? ' on' : ''}`}
            style={{ background: colour }}
            onClick={() => set({ hair: i })}
          />
        ))}
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="look-row">
      <span className="look-label" id={`look-${label}`}>
        {label}
      </span>
      <div className="look-opts" role="radiogroup" aria-labelledby={`look-${label}`}>
        {children}
      </div>
    </div>
  );
}
