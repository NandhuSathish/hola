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

`render.yaml` in the repo root is a Blueprint, so there is nothing to type in:

- New → Blueprint → connect this repo → Apply

It deploys `main`, on the free instance, with no environment variables. Change
the `branch` in `render.yaml` if you would rather ship from `dev`.

Two things about the free tier worth knowing before a game night:

- It sleeps after 15 minutes without traffic and takes about a minute to wake.
  The first friend to tap a cold link waits that minute. Open it yourself first.
- Waking is a restart, and rooms live in memory, so a sleep ends every game in
  progress. That is the trade v1 makes (CLAUDE.md rule 7) — it only bites if
  the room sits idle for a quarter of an hour, which a game night will not.

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
