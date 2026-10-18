import type { SnakesSettings, SnakesTurnTimer } from '@holla/shared';
import { SNAKES_DEFAULTS } from '@holla/shared';
import type { SettingsProps } from '../types';

const TIMERS: { value: SnakesTurnTimer; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 20, label: '20s' },
  { value: 40, label: '40s' },
];

const RULES: { key: keyof SnakesSettings; title: string; blurb: string }[] = [
  {
    key: 'exactFinish',
    title: 'Land on 100 exactly',
    blurb: 'Overshoot and you bounce back off the last tile.',
  },
  {
    key: 'rollAgainOnSix',
    title: 'Six rolls again',
    blurb: 'Throw a six and go again, up to three times a turn.',
  },
  {
    key: 'mysteryBoxes',
    title: 'Mystery boxes',
    blurb: 'Gift tiles hide rocket boots, banana peels, freeze rays and more.',
  },
  {
    key: 'noodle',
    title: 'Noodle the wanderer',
    blurb: 'A crowned snake that slithers somewhere new every few rounds.',
  },
  {
    key: 'standoff',
    title: 'Snake standoff',
    blurb: 'One chance to charm a snake: stop the needle in the green.',
  },
  {
    key: 'crowdVote',
    title: 'Crowd choice',
    blurb: 'Land on a megaphone and everyone else votes on your fate.',
  },
];

/** Snakes & Ladders house rules. The lobby renders whichever game is chosen. */
export function SnakesSettingsPanel({ settings, canEdit, onChange }: SettingsProps) {
  const value = { ...SNAKES_DEFAULTS, ...(settings as Partial<SnakesSettings> | null) };

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
          <small>The dice roll themselves if you drift off.</small>
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
