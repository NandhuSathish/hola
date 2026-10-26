import { useEffect, useRef, useState } from 'react';
import type { Prompt, PublicPlayer } from '@holla/shared';
import { DEFAULT_LOOK, needleAt } from '@holla/shared';
import { Head } from '../../components/Fighter';
import { VOTE_ART } from './icons';
import { usePrefersReducedMotion } from '../../lib/motion';
import './Prompt.css';

type Props = {
  prompt: Prompt;
  me: string;
  players: PublicPlayer[];
  send: (action: unknown) => void;
};

export function SnakesPrompt({ prompt, me, players, send }: Props) {
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const lookOf = (id: string) => players.find((p) => p.id === id)?.look ?? DEFAULT_LOOK;
  const seatOf = (id: string) => Math.max(0, players.findIndex((p) => p.id === id));
  const headOf = (id: string, size = 34) => (
    <Head look={lookOf(id)} seat={seatOf(id)} size={size} />
  );
  const mine = prompt.awaiting.includes(me);
  const left = useCountdown(prompt.endsAt);

  return (
    <div className="sl-prompt" role="dialog" aria-live="polite">
      <div className="sticker sl-prompt-card">
        {prompt.detail.kind === 'standoff' ? (
          <Standoff
            prompt={prompt}
            detail={prompt.detail}
            mine={mine}
            subject={prompt.awaiting[0] ?? ''}
            nameOf={nameOf}
            headOf={headOf}
            send={send}
          />
        ) : (
          <CrowdVote
            prompt={prompt}
            detail={prompt.detail}
            mine={mine}
            me={me}
            nameOf={nameOf}
            headOf={headOf}
            send={send}
          />
        )}

        <div className="sl-prompt-bar" aria-hidden="true">
          <i style={{ width: `${left}%` }} />
        </div>
      </div>
    </div>
  );
}

function Standoff({
  prompt,
  detail,
  mine,
  subject,
  nameOf,
  headOf,
  send,
}: {
  prompt: Prompt;
  detail: Extract<Prompt['detail'], { kind: 'standoff' }>;
  mine: boolean;
  subject: string;
  nameOf: (id: string) => string;
  headOf: (id: string, size?: number) => React.ReactNode;
  send: (action: unknown) => void;
}) {
  const [pressed, setPressed] = useState(false);
  // Drawn from the same function the server judges with, off the same start
  // time, so what you see is what it scores.
  const needle = useNeedle(prompt.startedAt, detail.periodMs, pressed);

  return (
    <>
      <p className="sl-prompt-who">
        {headOf(subject)}
        {nameOf(subject)} vs the snake on {detail.snakeHead}
      </p>
      <h2>Snake standoff!</h2>
      <p className="sl-prompt-sub">
        {mine ? 'Stop the needle in the green to escape.' : `${nameOf(subject)} is trying to charm it…`}
      </p>

      <div className="sl-meter">
        <i
          className="sl-zone"
          style={{ left: `${detail.zoneStart}%`, width: `${detail.zoneWidth}%` }}
        />
        <i className="sl-needle" style={{ left: `${needle}%` }} />
      </div>

      <button
        type="button"
        className="btn btn-mint sl-prompt-go"
        disabled={!mine || pressed}
        onClick={() => {
          setPressed(true);
          send({ type: 'charm', promptId: prompt.id });
        }}
      >
        {pressed ? 'Held…' : 'Charm it!'}
      </button>
    </>
  );
}

function CrowdVote({
  prompt,
  detail,
  mine,
  me,
  nameOf,
  headOf,
  send,
}: {
  prompt: Prompt;
  detail: Extract<Prompt['detail'], { kind: 'crowd' }>;
  mine: boolean;
  me: string;
  nameOf: (id: string) => string;
  headOf: (id: string, size?: number) => React.ReactNode;
  send: (action: unknown) => void;
}) {
  const myVote = detail.votes[me];
  const voters = Object.entries(detail.votes);
  const iAmSubject = detail.subjectId === me;
  const voted = myVote !== undefined;
  const canVote = mine && !voted;
  // Everyone still being waited on, plus everyone who has answered.
  const crowdSize = prompt.awaiting.length + voters.length;

  // Why a button cannot be pressed, in the words of the person reading it.
  const lockedBecause = iAmSubject
    ? 'Your own fate is not yours to vote on.'
    : voted
      ? 'You have voted.'
      : 'You are not one of the voters.';

  return (
    <>
      <p className="sl-prompt-who">
        {headOf(detail.subjectId)}
        {iAmSubject ? 'You are' : `${nameOf(detail.subjectId)} is`} at the mercy of the crowd
      </p>
      <h2>Crowd choice</h2>
      <p className="sl-prompt-sub">
        {iAmSubject
          ? 'Not your call — the others decide. Plead your case!'
          : voted
            ? 'Vote in. Waiting for the rest…'
            : mine
              ? 'Pick one. Majority wins.'
              : 'Waiting for the rest of the room…'}
      </p>

      <div className="sl-opts">
        {detail.options.map((option, i) => {
          const backers = voters.filter(([, choice]) => choice === i).map(([id]) => id);
          const art = VOTE_ART[option.icon];
          const Icon = art?.Icon;
          return (
            <button
              key={option.label}
              type="button"
              className={`sl-opt${myVote === i ? ' chosen' : ''}`}
              style={{ ['--c' as string]: art?.colour ?? 'var(--paper-2)' }}
              disabled={!canVote}
              aria-pressed={myVote === i}
              title={canVote ? option.label : lockedBecause}
              onClick={() => send({ type: 'vote', promptId: prompt.id, option: i as 0 | 1 })}
            >
              {Icon && <Icon />}
              <b>{option.label}</b>
              <span className="sl-opt-votes">
                {backers.map((id) => <span key={id}>{headOf(id, 24)}</span>)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="sl-tally" aria-live="polite">
        {voters.length} of {crowdSize} voted
        {!canVote && <span className="sl-locked"> · {lockedBecause}</span>}
      </p>
    </>
  );
}

/** Percentage of the window still left, for the draining bar. */
function useCountdown(endsAt: number): number {
  const startedRef = useRef(Date.now());
  const [left, setLeft] = useState(100);

  useEffect(() => {
    startedRef.current = Date.now();
    const total = Math.max(1, endsAt - startedRef.current);
    const tick = () => setLeft(Math.max(0, Math.min(100, ((endsAt - Date.now()) / total) * 100)));
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [endsAt]);

  return left;
}

/** The sweeping needle, frozen once pressed or under reduced motion. */
function useNeedle(startedAt: number, periodMs: number, frozen: boolean): number {
  const reduced = usePrefersReducedMotion();
  const [pos, setPos] = useState(() => needleAt(startedAt, Date.now(), periodMs));
  const frame = useRef(0);

  useEffect(() => {
    if (frozen) return;
    // Reduced motion still needs a moving needle — the game is unplayable
    // otherwise — but it steps rather than animating every frame.
    if (reduced) {
      const timer = setInterval(() => setPos(needleAt(startedAt, Date.now(), periodMs)), 120);
      return () => clearInterval(timer);
    }
    const loop = () => {
      setPos(needleAt(startedAt, Date.now(), periodMs));
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame.current);
  }, [startedAt, periodMs, frozen, reduced]);

  return pos;
}
