# InfiniShoot

A colorful twin-stick survivors-style roguelike that runs in the browser. You aim an arm cannon while automatic weapons build up around you, survive timed stages against swarms, beat the boss, and dive through the portal to a harder stage. Bolts earned in each run buy permanent upgrades in the Workshop.

Built with TypeScript, Vite and Three.js, with a Mega Man Legends-inspired low-poly look and subtle PS1-style effects.

## Run it

Requires Node.js 20+.

```
npm install
npm run dev
```

Then open http://localhost:5173.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run typecheck` | Strict TypeScript check |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run package` | Build + zip for itch.io (see [ITCH.md](ITCH.md)) |

## Controls

| Action | Keyboard / mouse | Gamepad |
|---|---|---|
| Move | WASD | Left stick |
| Aim and shoot | Mouse, hold left click | Right stick / RT |
| Dash | Space, Shift, right click | LB / LT / A |
| Bomb | Q, E, middle click | RB / Y |
| Pause | Esc / P | Start |
| Auto-fire | F | |
| Debug panel (dev) | ` | |

## Project docs

- [PROMPT.md](PROMPT.md): design brief and rules
- [PLAN.md](PLAN.md): roadmap and decision log
- [CLAUDE.md](CLAUDE.md): code conventions
