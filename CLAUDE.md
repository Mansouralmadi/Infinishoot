# InfiniShoot

Project brief and rules: @PROMPT.md
Roadmap and decision log: @PLAN.md

## Commands
- `npm run dev`: dev server at http://localhost:5173
- `npm run typecheck`: strict TypeScript check (must pass)
- `npm run build`: typecheck + production build to `dist/`
- `npm run package`: build + zip `dist/` into `infinishoot-itch.zip` for itch.io (see ITCH.md)

## Conventions
- Gameplay simulates in 2D on the XZ plane; meshes are presentation only and interpolate between `prev` and `pos`.
- All scene materials use `createRetroMaterial` (src/render/retroMaterial.ts). Global look values live in `retroGlobals` and are shared by reference, so don't `.clone()` retro materials (cloning breaks the sharing); create new ones with the factory.
- Colour management is off: author colours as the hex values you want on screen.
- Tunable values live in exported `*Tuning` objects and get wired into src/ui/debugPanel.ts.
- In dev builds `window.game`, `window.cheats` and the autoplay bot are exposed: `botRun(seconds, god)` simulates headlessly and returns a balance/perf report. Note `window.game` is the canvas element in production (named access by id).
- Instanced pools must upload only live slots: call `commit(attr, count)` (src/render/instancing.ts) instead of setting `needsUpdate`.
- Many-of-a-kind things (enemies, bullets, particles, decals) render via `InstancedMesh`. Per-instance hit flash uses `createRetroMaterial({ instanceFlash: true })` plus an `instanceFlash` vec4 attribute.
- Content is data in src/data/: weapons (full params per level), passives, enemies, Workshop items and achievements. Weapon behaviour lives in src/game/weapons/ (one class per weapon, registered in index.ts) and only touches the game through `WeaponCtx`.
- Mods (src/data/mods.ts) are data plus hook functions typed in src/game/modTypes.ts; src/game/synergy.ts runs the ordered slots (Echo resolution, flag sums, damage pipeline, triggers). New Mod behaviour goes through `ModApi`/`ModFlags`, not direct Game access. Weapons read Mod flags via `ctx.flags`.
- `game.stats` is the live stats object (static + per-step Mod effects); call `recomputeStats()` after passives or Mods change, never reassign it.
- All damage goes through `ctx.damage()` / `Game.damage`, which applies stats, crits and freeze-shatter and tracks the per-weapon damage breakdown.
- The persistent profile (Bolts, Workshop, achievements, lifetime stats) is `save` in src/game/save.ts. Bump the version and extend `normalize()` when its shape changes, so old saves keep loading.
- `Game` (src/game/game.ts) owns the session: menus, run state and every system. Its modes are title, fight, levelup, cleared, portal, transition and dead. Juice goes through `game.juice.freeze()` / `.shake()` / `.kick()`.
- UI is plain DOM: HUD in src/ui/hud.ts, menus in src/ui/screens.ts. Anything navigable gets `data-nav` so `MenuNav` handles keyboard and gamepad.
- Persistence goes through src/core/storage.ts, which never throws. Settings and high scores live in localStorage under the `infinishoot.` prefix.
