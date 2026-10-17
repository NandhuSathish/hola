# holla!

Card nights with your crew. Voice is built in, so just open the link and start talking.

A browser party game for up to 15 friends. The first game is **Last Card** (Uno-style), with more small games to come.

## Run it locally

1. Copy `.env.example` to `.env` and fill in your LiveKit values (from https://cloud.livekit.io → your project → Settings → Keys).
2. Install and start:

   ```
   npm install
   npm run dev
   ```

3. Open the URL Vite prints. Open a second tab to play against yourself.

Mic access only works on `https` or `localhost`. To try it on your phone, use the deployed site or a tunnel.

## Deploy (Render, free)

- New → Web Service → connect this repo
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Instance type: Free
- Environment: add `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`

The free service sleeps after 15 minutes without traffic. Open the link a minute before game night.

## Docs

- `CLAUDE.md` — how the project is built, rules for Claude Code, build phases
- `REFERENCE.md` — full spec: game rules, socket events, voice flow, design tokens, links
- `design/holla-mock.html` — the UI mock everything is based on
