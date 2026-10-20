import { useState } from 'react';
import { NAME_MAX_LENGTH, isValidRoomCode, normaliseRoomCode } from '@holla/shared';
import { LookRows, LookStage } from '../components/LookPicker';
import { loadProfile, saveProfile } from '../lib/session';
import { useRoom } from '../lib/useRoom';

import './Home.css';

type Props = { room: ReturnType<typeof useRoom> };

export function Home({ room }: Props) {
  const [profile, setProfile] = useState(loadProfile);
  const [code, setCode] = useState('');

  const nameOk = profile.name.trim().length > 0;
  const codeOk = isValidRoomCode(code);

  function update(next: Partial<typeof profile>) {
    const merged = { ...profile, ...next };
    setProfile(merged);
    saveProfile(merged);
  }

  return (
    <main className="home-screen">
      <div className="home-inner">
        <h1 className="wordmark" aria-label="holla!">
          <span>h</span><span>o</span><span>l</span><span>l</span><span>a</span><span>!</span>
        </h1>

        <p className="tagline">
          Card nights with your crew. Open the link, pick a game, start playing.
        </p>

        {/*
          Two columns from 900px up: the fighter gets a stage of its own and
          the form sits beside it. Below that they stack, stage first, which
          is the same order read down a phone.
        */}
        <section className="sticker panel home-panel">
          <div className="home-stage">
            <LookStage look={profile.look} height={260} />
            <span className="home-stage-label">Your fighter</span>
          </div>

          <div className="home-form">
          <label className="field-title" htmlFor="nick">Your name</label>
          <input
            id="nick"
            className="input"
            value={profile.name}
            maxLength={NAME_MAX_LENGTH}
            placeholder="What should we call you?"
            onChange={(e) => update({ name: e.target.value })}
          />

          <span className="field-title">Build your fighter</span>
          <LookRows look={profile.look} onChange={(look) => update({ look })} />

          <button
            type="button"
            className="btn btn-pink big"
            disabled={!nameOk || room.busy || room.connection !== 'connected'}
            onClick={() => room.createRoom(profile)}
          >
            Create a room
          </button>

          <div className="or">or join your friends</div>

          <form
            className="join-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (nameOk && codeOk) room.joinRoom(normaliseRoomCode(code), profile);
            }}
          >
            <input
              className="input code-input"
              value={code}
              maxLength={4}
              placeholder="Code"
              aria-label="Room code"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button
              type="submit"
              className="btn btn-sun"
              disabled={!nameOk || !codeOk || room.busy || room.connection !== 'connected'}
            >
              Join
            </button>
          </form>

          {room.error && <p className="form-error" role="alert">{room.error}</p>}
          {room.connection !== 'connected' && (
            <p className="form-note">
              {room.connection === 'connecting' ? 'Connecting to the server…' : 'Lost the server. Retrying…'}
            </p>
          )}
          </div>
        </section>
      </div>
    </main>
  );
}
