# InfiniShoot — Master Prompt

Use this as the standing brief for any AI/dev session working on the project. Paste it at the start of a session, or keep it as `CLAUDE.md` once the repo is scaffolded.

---

You are building **InfiniShoot**, a desktop (web-tech) **twin-stick survivors-style roguelike** (think Vampire Survivors with an aimed gun) with an endless run structure and a **colourful, cartoony late-90s 3D look inspired by Mega Man Legends**: chunky anime characters on PS1-era hardware limits.

## Core fantasy
A plucky, anime-styled hero survives timed stages on big open fields while swarms of goofy robots and monsters close in from every side. You aim and fire your arm cannon while a growing arsenal of automatic weapons (drones, lightning, discs, missiles, mines, frost, fire) fires on its own. Enemies drop XP gems; levelling up mid-fight lets you add a weapon or level one you have, and every level is a visible change. Survive the timer, beat the boss, take the portal to a harder stage. Runs end on death and every run starts equal: there are no permanent stat upgrades, only achievements that add new weapons to the level-up pool. It keeps its arcade heart: score, combo multiplier and high scores.

## Hard constraints
- **Ships as a Windows desktop app**: a single portable exe (Electron wrapping the web build), double-click to play, no install. The game itself stays plain web code. Keyboard + mouse and gamepad are both first-class.
- **Performance**: steady 60 fps on a mid-range laptop iGPU with 150+ enemies and 500+ projectiles on screen. Initial load under 5 MB, under 3 s on broadband.
- **Stack**: TypeScript, Vite, Three.js (WebGL2). No heavy engine. Keep dependencies minimal: Three.js, WebAudio (or Howler), and optionally `lil-gui` for debug tweaking.
- **No backend for v1**: saves in `localStorage`, with save/load to a file for backup and moving PCs. Distributed as `InfiniShoot.exe` on GitHub Releases.

## Art direction: Mega Man Legends-style
The aim is *cheerful, saturated, toy-like*, not gritty. PS1 limitations are used for charm, not horror.
1. **Characters**: chunky, simple proportions (big head, big hands and boots, around 3 heads tall), low-poly (400–1000 tris). **Faces are painted onto textures** (big anime eyes, swappable eye/mouth textures for expressions), not modelled.
2. **Colour**: bright, saturated palettes. Blue skies, warm sunlight, candy-coloured enemies. Each biome has a strong colour identity. Avoid muddy browns and greys.
3. **Textures**: small (32–128 px), hand-painted look with flat colour areas, nearest-neighbour filtering, no mipmaps. Prefer vertex colours plus a few small textures.
4. **Lighting**: simple and friendly. Vertex (Gouraud) lighting with a warm key light, a cool ambient and soft hemisphere fill. Blob shadows under characters, no shadow maps.
5. **Light PS1 flavour, tunable**: slight vertex snapping, mild affine warping, a low internal resolution (for example 480×270) upscaled with nearest filtering, and optional subtle dithering. Defaults are *subtle*, so the game should read as charming rather than broken. Everything is controlled by a "Retro strength" setting.
6. **Light distance fog** tinted to the sky colour, not dark.
7. **Arcade VFX**: big readable bullets (glowing pills, stars, rings), sprite-based explosions and sparkles, comic hit effects ("POW"-style hit sparks), coloured damage numbers, screen flash on big hits.
8. **UI**: bold, rounded, colourful HUD with a chunky pixel/rounded font, a combo meter and a big score counter. Menus feel like a late-90s console game.

## Gameplay rules
- **Twin-stick controls**: left stick / WASD moves, right stick / mouse aims, and the character always faces the aim direction. Mouse aim projects onto the ground plane from the cursor. Fire on right trigger / left mouse (hold to fire), plus an optional auto-fire toggle.
- **Camera**: elevated 3/4 top-down view (about 55–65° pitch), perspective with a narrow FOV, following the player with slight look-ahead toward the aim direction. No camera rotation, so the player is never disoriented.
- **Actions**: move, aim, shoot, charge shot (hold right click / X, release for a big piercing shot that grows with hold time), dash (short i-frames, cooldown), bomb (screen-clearing charge meter). Movement is the core skill: kiting, threading gaps, grabbing gems.
- **Loop**: a stage is a timed survival fight (about 4 minutes) on a large open field. Enemy count ramps up over the stage, new enemy types join minute by minute, an elite arrives each minute (drops a treasure chest), swarm rings encircle the player, and a boss appears when the timer ends. Killing the boss opens a portal to the next, harder stage. Endless.
- **Levelling**: enemies drop XP gems (magnet pull). Each level-up offers 3 cards: a new weapon, the next level of an owned weapon, or a passive item. Up to 6 weapons and 6 passives. **Weapons level visibly** (more drones, bigger blasts, extra chains); passives are the small number boosts.
- **Synergies (Balatro-style)**: weapons carry tags; Mods bought in the shop after each boss sit in 5 ordered slots and key off tags, triggers, statuses and gold. Damage flows through the slots left to right as (amount + add) x mult. Statuses combo: Burn + Shock = Overload, explosion on Burning = Napalm, kill a Frozen enemy = Shatter. Every pick should be a real decision: new power now, gold for interest, or a cursed Mod with a big upside.
- **Multiplayer**: online co-op (host-authoritative, invite codes) is the next major feature.
- **Meta progression**: kept light on purpose. No currency or permanent upgrades between runs; achievements unlock weapons into the level-up pool, and the run's own shop and Mods carry the build decisions.
- **Arcade scoring**: points per kill, a combo multiplier that grows with kills and breaks on hit, no-hit stage bonuses, and a local high-score table.
- **Procedural fields**: seeded, mostly open ground with sparse cover clusters (ruins, crates, groves) and paths. Same seed gives the same stage. Biomes change the look as stages go deeper.
- **Enemies**: data-driven definitions (stats, behaviour, model, drops). Swarmers chase and deal contact damage; specials have readable telegraphs (lunge flash, charge line, fuse ring, slam zone).
- **Feel first**: hit-stop, screen shake, enemy hit flash, squash and stretch, knockback, chunky SFX. Swarm kills stay light so hundreds of deaths don't stutter; big kills get the heavy feedback.

## Architecture rules
- Lightweight ECS-style or component-based architecture. Game logic is decoupled from rendering.
- Gameplay simulated on the **XZ plane in 2D** (positions, velocities, circle colliders). 3D is presentation only.
- Fixed-timestep simulation (60 Hz) with interpolated rendering.
- Object pooling for bullets, enemies, particles and damage numbers. No per-frame allocations in hot paths.
- `InstancedMesh` for bullets, enemies, particles and props.
- A single seeded RNG (for example mulberry32) used for all gameplay randomness.
- All content (heroes, weapons, enemies, bullet patterns, upgrades, rooms) in plain TS/JSON data files.
- Spatial hash grid for collision. Circles for entities and bullets, AABBs for walls. No physics engine.

## Working style
- Build in small, playable increments. Every milestone ends with something you can play.
- Prefer simple, readable code over clever abstractions. Make it work, make it feel good, then make it fast.
- When unsure about a design decision, propose two options with tradeoffs and a recommendation.
- Keep `PLAN.md` updated: tick off tasks and note decisions.
