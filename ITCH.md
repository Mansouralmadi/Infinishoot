# Publishing InfiniShoot on itch.io

## 1. Build the upload

```
npm run package
```

This creates `infinishoot-itch.zip` (about 200 KB) in the project folder. The zip has `index.html` at the top level, which is what itch.io needs.

## 2. Create the game page (first time only)

1. Sign in at https://itch.io and choose **Upload new project**.
2. Fill in:
   - **Title:** InfiniShoot
   - **Kind of project:** HTML
   - **Classification:** Games
   - **Pricing:** No payments (or "$0 or donate")
3. Under **Uploads**, upload `infinishoot-itch.zip` and tick **This file will be played in the browser**.
4. Under **Embed options**:
   - **Viewport dimensions:** 1280 x 720
   - Tick **Mobile friendly** only after touch controls exist (they don't yet)
   - Tick **Fullscreen button**
   - Tick **Automatically start on page load** (optional)
5. Under **Visibility & access**, choose **Draft** while testing. You can open the page yourself; nobody else can.
6. Save, open the page, and play a run to confirm it loads.
7. When you're happy, change visibility to **Public**.

## 3. Updating the game

Run `npm run package` again. On the itch.io edit page, delete the old zip and upload the new one (keep **played in the browser** ticked).

Player saves are tied to the itch.io page address, so updates don't wipe them.

## 4. Online co-op

Online play works from the itch.io page as well. Players connect directly browser-to-browser; PeerJS's free public server is only used to find each other. Mention in the page text that the host should keep their game tab visible.

## 5. About saves

- Progress (Bolts, Workshop upgrades, achievements, high scores, settings) saves automatically in the player's browser.
- It is per browser and per device. Clearing browser data deletes it.
- Players can back up or move their save with **Workshop > Save Data > Export / Import**.

## 6. Page text (paste into the description)

> **InfiniShoot** is a colorful twin-stick survivors-style roguelike that runs right in your browser.
>
> Aim your arm cannon and blast swarms of goofy robots while drones, lightning, saw discs, missiles, mines, frost and fire build up around you. Grab XP gems to level up mid-fight, pick weapons and upgrades, survive the timer, beat the boss and dive through the portal to a harder stage.
>
> Every run earns Bolts. Spend them in the Workshop on permanent upgrades, and unlock new weapons through achievements.
>
> **Controls**
> - Move: WASD or left stick
> - Aim and shoot: mouse (hold left click) or right stick
> - Dash: Space, Shift, right click or LB
> - Bomb: Q, E, middle click or RB
> - Pause: Esc or Start
> - Toggle auto-fire: F
>
> Progress saves in your browser. Use Workshop > Save Data to back it up.

Suggested tags: `roguelike`, `bullet-hell`, `twin-stick-shooter`, `survivors-like`, `low-poly`, `retro`, `arcade`.
