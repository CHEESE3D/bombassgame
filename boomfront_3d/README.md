# 💥 BOOMFRONT 3D

A fast-paced browser FPS-style 3D arena shooter with:
- Multiplayer rooms
- Quick Match / random public lobbies
- Private/specific lobby codes
- Map voting
- Assault rifle, rocket launcher and plasma cannon
- Server-simulated projectiles and damage
- Explosions
- Vehicle toggle + faster vehicle movement
- Procedural 3D maps
- Procedural WebAudio weapon/explosion sounds
- No game assets required

## Important architecture

GitHub Pages is static hosting, so it cannot run the multiplayer server itself.

This project is split into:
- `client/` — static 3D game. Put this on GitHub Pages.
- `server/` — Node.js + Socket.IO multiplayer server. Run it on Render, Railway, Fly.io, a VPS, or your own computer.

For the easiest test, run the whole project locally with Node.

## Run locally

Install Node.js 18+.

```bash
npm install
npm start
```

Open:

`http://localhost:3000`

Open it in two browser windows/tabs to test multiplayer.

## Deploy the server

Deploy this repository to a Node-compatible host.

Start command:

```bash
npm start
```

The server serves the client too, so you can simply use the server URL while testing.

## GitHub Pages

For a pure GitHub Pages client, copy `client/index.html` into your Pages site.

Then change the Socket.IO line:

```html
<script src="/socket.io/socket.io.js"></script>
```

to your multiplayer server URL:

```html
<script src="https://YOUR-SERVER-DOMAIN/socket.io/socket.io.js"></script>
```

and change:

```js
state.socket=io();
```

to:

```js
state.socket=io("https://YOUR-SERVER-DOMAIN");
```

Also configure your server's CORS policy to your GitHub Pages origin for production.

## Controls

- WASD — move
- Mouse — aim
- Left click — fire
- 1 / 2 / 3 — weapons
- Shift — sprint
- E — enter/exit vehicle
- Esc — release mouse

## Next upgrades I'd add

The current version is intentionally asset-free and easy to deploy. Good next additions would be:
- Better vehicle physics
- More vehicles
- Grenades and bouncing projectiles
- Shotguns / sniper / SMG
- Team deathmatch and domination
- Respawn timer
- Kill streaks
- Player cosmetics
- Persistent accounts
- Server-side collision / anti-cheat
- Better map geometry
- Dedicated matchmaking service
- Mobile controls
