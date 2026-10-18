# holla!

Card nights with your crew. Open the link, pick a game, start playing.

A browser party game for up to 15 friends: **Last Card** (Uno-style), **Snakes &
Ladders** and **Hand Cricket**. No sign-up, nothing to install.

Built-in voice chat lands in **v2** — keep a call open alongside for now.

## Run it locally

1. Install and start:

   ```
   npm install
   npm run dev
   ```

2. Open the URL Vite prints. Open a second tab to play against yourself — each
   tab is its own player.

To try it on your phone, use the deployed site or a tunnel.

## Deploy (Render, free)

- New → Web Service → connect this repo
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Instance type: Free
- Environment: nothing required for v1

The free service sleeps after 15 minutes without traffic. Open the link a minute
before game night.

The `LIVEKIT_*` values in `.env.example` are for v2 and are not read by anything
in v1.

## Docs

- `CLAUDE.md` — how the project is built, rules for Claude Code, build phases
- `REFERENCE.md` — full spec: game rules, socket events, module interface,
  design tokens, links
- `CHANGELOG.md` — what has been built, and the decisions behind it
- `design/holla-mock.html` — the UI mock everything is based on
- `design/hand-cricket-mock.html` — the Hand Cricket mock
- `design/snakes-ladders-mock.html` — the Snakes & Ladders mock
