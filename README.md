# alfon-dev-discord-music

This bot reads a file and run it 24/7 as a discord voice bot like a cheap public park speakers.

#### Requirements:
- Bun 1.4.2
- ffmpeg (with libopus)
- git
- pm2 (optional)

Note: ffmpeg is only neede for the one-time mp3 -> ogg conversion. If your music file is already .ogg, then it doesnt need ffmpeg

#### Required environment vairables (yes, required)
- BOT_TOKEN
- GUILD_ID
- WEBHOOK_URL - error log webhook, can be outside of the guild

#### Discord-side setup
- copy BOY_TOKEN from dev portal
- invite bot with the scope: bot + applications.commands

#### Minimal Install flow on fresh VPS
```
git clone <repo> && cd <repo>
bun install
mkdir -p db public 
# place public/muffled.mp3 here or optionally muffled.ogg
# create .env with BOT_TOKEN, GUILD_ID, WEBHOOK_URL
bun run typecheck
bun start #or pm2 start ecosystem.config.js
```