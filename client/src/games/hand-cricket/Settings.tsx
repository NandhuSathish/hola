import type { HandCricketSettings, Overs, PickSeconds } from '@holla/shared';
import { HAND_CRICKET_DEFAULTS } from '@holla/shared';
import type { SettingsProps } from '../types';

const OVERS: { value: Overs; label: string }[] = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 6, label: '6' },
];

const SECONDS: { value: PickSeconds; label: string }[] = [
  { value: 5, label: '5s' },
  { value: 7, label: '7s' },
  { value: 10, label: '10s' },
  { value: 15, label: '15s' },
];

/** Hand Cricket house rules. The lobby renders whichever game is chosen. */
export function HandCricketSettingsPanel({ settings, canEdit, onChange }: SettingsProps) {
  const value = { ...HAND_CRICKET_DEFAULTS, ...(settings as Partial<HandCricketSettings> | null) };

  return (
    <>
      <div className="rule">
        <div>
          <b>Overs an innings</b>
          <small>Six balls each. Both sides get the same.</small>
        </div>
        <div className="seg" role="group" aria-label="Overs an innings">
          {OVERS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={value.overs === o.value}
              disabled={!canEdit}
              onClick={() => onChange({ overs: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rule">
        <div>
          <b>Time to throw</b>
          <small>A number is thrown for you if the clock beats you to it.</small>
        </div>
        <div className="seg" role="group" aria-label="Time to throw">
          {SECONDS.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={value.pickSeconds === s.value}
              disabled={!canEdit}
              onClick={() => onChange({ pickSeconds: s.value })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rule">
        <div>
          <b>Odd runs cross</b>
          <small>One and three change the strike, as they would between the wickets.</small>
        </div>
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={value.rotateOnOdds}
          aria-label="Odd runs cross"
          disabled={!canEdit}
          onClick={() => onChange({ rotateOnOdds: !value.rotateOnOdds })}
        />
      </div>
    </>
  );
}
