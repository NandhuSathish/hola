# Sounds

Eight short effects from [Mixkit](https://mixkit.co/free-sound-effects/game/),
downloaded and committed so they ship with the build and nothing is fetched
from a third party at play time. Vite copies `client/public/` into `dist`, so
the Render deploy serves them from our own origin.

**Licence:** the [Mixkit Sound Effects Free
License](https://mixkit.co/license/#sfxFree) — free to use in a project,
commercial or not, with no attribution required. It does not permit
redistributing the files on their own, which is not what we are doing: they
are part of the game. The attribution below is a record of where they came
from, not an obligation.

| File | Mixkit sound | id |
| --- | --- | --- |
| `tap.mp3` | Video game retro click | 237 |
| `play.mp3` | Game ball tap | 2073 |
| `draw.mp3` | Thin metal card deck shuffle | 3175 |
| `roll.mp3` | Small hit in a game | 2072 |
| `good.mp3` | Quick positive video game notification interface | 265 |
| `bad.mp3` | Player losing or failing | 2042 |
| `pop.mp3` | Arcade mechanical bling | 210 |
| `win.mp3` | Game level completed | 2059 |

Each is `https://assets.mixkit.co/active_storage/sfx/<id>/<id>-preview.mp3`.

To swap one out, drop a replacement in with the same filename — `lib/sound.ts`
names them and nothing else does.
