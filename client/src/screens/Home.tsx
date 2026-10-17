import { useState } from 'react';
import { AVATARS, NAME_MAX_LENGTH, isValidRoomCode, normaliseRoomCode } from '@holla/shared';
import { loadProfile, saveProfile } from '../lib/session';
import { useRoom } from '../lib/useRoom';
import { gamesPath, navigate } from '../lib/route';
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
          Card nights with your crew. Voice is built in, so just open the link and start talking.
        </p>

        <section className="sticker panel">
          <label className="field-title" htmlFor="nick">Your name</label>
          <input
            id="nick"
            className="input"
            value={profile.name}
            maxLength={NAME_MAX_LENGTH}
            placeholder="What should we call you?"
            onChange={(e) => update({ name: e.target.value })}
          />

          <span className="field-title" id="avlbl">Pick an avatar</span>
          <div className="avatars" role="radiogroup" aria-labelledby="avlbl">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={profile.avatar === a}
                aria-label={`Avatar ${a}`}
                onClick={() => update({ avatar: a })}
              >
                {a}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-pink big"
            disabled={!nameOk || room.busy || room.connection !== 'connected'}
            onClick={() => navigate(gamesPath())}
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
        </section>
      </div>
    </main>
  );
}
