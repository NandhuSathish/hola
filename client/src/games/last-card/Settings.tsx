import type { LastCardSettings, TurnTimer } from '@holla/shared';
import { LAST_CARD_DEFAULTS } from '@holla/shared';
import type { SettingsProps } from '../types';

const TIMERS: { value: TurnTimer; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 20, label: '20s' },
  { value: 40, label: '40s' },
];

const RULES: { key: keyof LastCardSettings; title: string; blurb: string }[] = [
  { key: 'stackDraw', title: 'Stack draw cards', blurb: 'Answer a +2 with a +2 and pass the pain on.' },
  { key: 'sevenZero', title: '7 swaps, 0 rotates', blurb: 'Play a 7 to swap hands, a 0 to pass every hand along.' },
  { key: 'drawUntilPlayable', title: 'Draw until you can play', blurb: 'Keep drawing instead of stopping at one card.' },
  { key: 'shoutPenalty', title: 'Shout penalty', blurb: 'Forget to shout at one card and get caught: draw 2.' },
];

/** Last Card's own house rules. The lobby renders whichever game is chosen. */
export function LastCardSettingsPanel({ settings, canEdit, onChange }: SettingsProps) {
  const value = { ...LAST_CARD_DEFAULTS, ...(settings as Partial<LastCardSettings> | null) };

  return (
    <>
      {RULES.map((rule) => (
        <div className="rule" key={rule.key}>
          <div>
            <b>{rule.title}</b>
            <small>{rule.blurb}</small>
          </div>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={value[rule.key] as boolean}
            aria-label={rule.title}
            disabled={!canEdit}
            onClick={() => onChange({ [rule.key]: !value[rule.key] })}
          />
        </div>
      ))}

      <div className="rule">
        <div>
          <b>Turn timer</b>
          <small>Auto-draw when time runs out.</small>
        </div>
        <div className="seg" role="group" aria-label="Turn timer">
          {TIMERS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={value.turnTimer === t.value}
              disabled={!canEdit}
              onClick={() => onChange({ turnTimer: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
