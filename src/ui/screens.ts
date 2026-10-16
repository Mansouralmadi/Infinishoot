import type { Input } from '../core/input';
import { ACHIEVEMENTS } from '../data/meta';
import { tagChips, type Tag } from '../data/tags';
import { WEAPONS } from '../data/weapons';
import type { ModDef } from '../game/modTypes';
import type { ScoreEntry } from '../game/highscores';
import { exportFile, importFile, resetSave, save } from '../game/save';
import { settings, saveSettings } from '../game/settings';
import { sfx } from '../audio/sfx';
import { RARITY, type Rarity } from '../data/rarity';
import { decoys, fmtScore, reduceMotion, reelAt, reelSteps, type LoadoutItem } from './hud';
import { MenuNav } from './menu';
import { iconHtml } from './pixelIcons';

/** Full-screen menus. Plain DOM; every navigable element has `data-nav`. */
export type ScreenName = 'none' | 'title' | 'pause' | 'settings' | 'levelup' | 'shop' | 'gameover' | 'unlocks' | 'savedata' | 'online' | 'wait';

export interface ScreenActions {
  start(): void;
  resume(): void;
  quit(): void;
  retry(): void;
  title(): void;
  pick(index: number): void;
  reroll(): void;
  skip(): void;
  buy(index: number): void;
  sell(index: number): void;
  moveMod(index: number, dir: -1 | 1): void;
  shopReroll(): void;
  shopHeal(): void;
  shopDone(): void;
  online(): void;
  mpHost(name: string): void;
  mpJoin(name: string, code: string): void;
  mpStart(): void;
  mpLeave(): void;
}

export interface LobbyView {
  code: string;
  players: { name: string; color: string }[];
  isHost: boolean;
  status: string;
}

export type ShopFx = 'open' | 'buy' | 'sell' | 'reroll' | 'heal' | 'deny';

export interface ShopView {
  gold: number;
  interest: number;
  interestCap: number;
  interestPer: number;
  offers: ({ def: ModDef; price: number; hint: string } | null)[];
  owned: { def: ModDef; sell: number; readout: string }[];
  slots: number;
  rerollCost: number;
  healCost: number;
  healed: boolean;
  loadout: LoadoutItem[];
  stage: number;
  /** Starting shop before stage 1: free gold that isn't kept, no interest. */
  pre?: boolean;
}

export interface Offer {
  kind: 'weapon' | 'passive' | 'special' | 'gold' | 'heal';
  id: string;
  name: string;
  icon: string;
  color: string;
  tag: string; // "NEW!" / "LV 3" / "BONUS"
  text: string;
  tags?: readonly Tag[];
  rarity?: Rarity;
  /** Level owned now (0 = new) and the item's max, for the upgrade pips. */
  level?: number;
  maxLevel?: number;
  /** Owned weapon this pick removes, e.g. "Plasma Orb LV 3" (arm-slot swaps). */
  replaces?: string;
}

export interface RunSummary {
  score: number;
  stage: number;
  kills: number;
  time: number;
  level: number;
  maxCombo: number;
  loadout: LoadoutItem[];
  mods: string[];
  damage: { name: string; color: string; dmg: number }[];
  achievements: string[];
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Title letters as separate spans so a hop can ripple across them. */
function logoWord(word: string, start: number): string {
  return `<span>${[...word].map((ch, k) => `<i style="--i:${start + k}">${ch}</i>`).join('')}</span>`;
}

/** A level-up card is a new item, an upgrade of one you own, an evolution or a bonus. */
function cardMode(o: Offer): 'new' | 'upgrade' | 'evo' | 'bonus' {
  return o.tag === 'NEW!' ? 'new' : o.tag === 'EVOLVE!' ? 'evo' : o.kind === 'gold' || o.kind === 'heal' ? 'bonus' : 'upgrade';
}

/** Upgrades show owned levels as filled pips and this pick as a flashing one. */
function levelPips(o: Offer): string {
  if (!o.maxLevel || !o.level) return '';
  const pips = Array.from({ length: o.maxLevel }, (_, k) => `<i class="${k < o.level! ? 'on' : k === o.level ? 'next' : ''}"></i>`).join('');
  const next = o.level + 1 === o.maxLevel && o.tag === 'EVOLVE!' ? 'EVOLVE' : `LV ${o.level + 1}`;
  return `<div class="lvl">LV ${o.level} ▸ ${next}</div><div class="pips">${pips}</div>`;
}

/** Warning strip on cards that swap out an owned weapon. "Plasma Orb LV 3" reads "REPLACES PLASMA ORB (LV 3)". */
function replaceStrip(what: string): string {
  const name = what.replace(/\s+(LV\s*\d+)$/i, ' ($1)').toUpperCase();
  return `<div class="replaces"><i>!</i><span>REPLACES ${name}<b>OLD WEAPON AND ITS UPGRADES ARE REMOVED</b></span></div>`;
}

/** Hover card: name, rarity and what it does. */
function tip(name: string, rarity: Rarity, desc: string, extra = ''): string {
  return `<span class="tip"><b>${name}</b><em class="r-text-${rarity}">${RARITY[rarity].label}${extra}</em><span>${desc}</span></span>`;
}

function badge(i: LoadoutItem): string {
  const level = i.evo ? ' · EVOLVED' : i.max ? ' · MAX' : ` · LV ${i.level}`;
  return `<span class="badge r-${i.rarity ?? 'common'}" style="--c:${i.color}" tabindex="0">${iconHtml(i.id, i.color, i.icon)}<i>${i.evo ? 'E' : i.max ? 'M' : i.level}</i>${tip(i.name, i.rarity ?? 'common', i.desc ?? '', level)}</span>`;
}

function modChip(m: ModDef): string {
  return `<span class="mod-chip ${m.cursed ? 'cursed' : ''} r-${m.rarity}" style="--c:${m.color}" tabindex="0">${iconHtml(m.id, m.color, m.icon)}${m.name}${tip(m.name, m.rarity, m.desc, m.cursed ? ' · CURSED' : ' · MOD')}</span>`;
}

type Named = Exclude<ScreenName, 'none'>;

export class Screens {
  current: ScreenName = 'none';
  private els = {} as Record<Named, HTMLElement>;
  private navs = {} as Record<Named, MenuNav>;
  private settingsReturn: ScreenName = 'title';
  private wipeArmed = false;
  /** Gold last shown in the shop, for the +/- popups. */
  private shopGold = -1;
  /** Level-up card reels still spinning, and the time since they started. */
  private reels: { card: HTMLElement; strip: HTMLElement; steps: number[]; passed: number; rarity?: Rarity }[] = [];
  private reelT = 0;

  private root: HTMLElement;

  constructor(root: HTMLElement, actions: ScreenActions) {
    this.root = root;
    root.insertAdjacentHTML(
      'beforeend',
      `
<div id="scr-title" class="screen" hidden>
  <div class="logo">${logoWord('INFINI', 0)}${logoWord('SHOOT', 6)}</div>
  <div class="tagline">TWIN-STICK ARCADE ROGUELIKE</div>
  <div class="menu">
    <button data-nav data-act="start">PLAY SOLO</button>
    <button data-nav data-act="online">PLAY ONLINE</button>
    <button data-nav data-act="unlocks">UNLOCKS</button>
    <button data-nav data-act="settings">SETTINGS</button>
  </div>
  <div class="wallet"></div>
  <div class="hiscores"></div>
  <div class="controls">WASD / L-stick move &middot; Mouse / R-stick aim &amp; shoot &middot; Hold right click / X charge shot &middot; Space / LB dash &middot; Q / RB bomb &middot; Esc / Start pause</div>
  <div class="credits">Icons: game-icons.net by Lorc, Delapouite &amp; contributors (CC BY 3.0) &middot; Fonts: Jersey, Pixelify Sans, Silkscreen (OFL) &middot; Palette: Sweetie 16 by GrafxKid</div>
  <div class="version">v${__APP_VERSION__}</div>
</div>
<div id="scr-pause" class="screen dim" hidden>
  <h1>PAUSED</h1>
  <div class="menu">
    <button data-nav data-act="resume">RESUME</button>
    <button data-nav data-act="settings">SETTINGS</button>
    <button data-nav data-act="quit">QUIT RUN</button>
  </div>
  <div class="build"></div>
</div>
<div id="scr-settings" class="screen dim" hidden>
  <h1>SETTINGS</h1>
  <div class="menu settings">
    <label>VOLUME <input data-nav type="range" min="0" max="1" step="0.1" data-set="volume"></label>
    <label>RETRO LOOK <input data-nav type="range" min="0" max="1" step="0.1" data-set="retro"></label>
    <label>SCREEN SHAKE <input data-nav type="range" min="0" max="1.5" step="0.25" data-set="shake"></label>
    <button data-nav data-toggle="autoFire">AUTO-FIRE <b></b></button>
    <button data-nav data-toggle="showFps">SHOW FPS <b></b></button>
    <button data-nav data-act="back">BACK</button>
  </div>
</div>
<div id="scr-levelup" class="screen dim" hidden>
  <h1></h1>
  <div class="cards"></div>
  <div class="reroll-row"></div>
  <div class="build"></div>
</div>
<div id="scr-online" class="screen dim" hidden>
  <h1>PLAY ONLINE</h1>
  <p class="note">Co-op for up to 4 players. One player hosts and shares a code; friends join with it.</p>
  <label class="field">YOUR NAME <input id="mp-name" type="text" maxlength="12" spellcheck="false" autocomplete="off"></label>
  <div class="menu row mp-choice">
    <button data-nav data-act="mp-host">HOST GAME</button>
  </div>
  <div class="join-row">
    <input id="mp-code" type="text" maxlength="5" placeholder="CODE" spellcheck="false" autocomplete="off">
    <button data-nav data-act="mp-join">JOIN</button>
  </div>
  <div class="lobby" hidden>
    <div class="code-label">GAME CODE</div>
    <div class="code-big"></div>
    <div class="players"></div>
  </div>
  <div class="msg mp-status"></div>
  <div class="menu row">
    <button data-nav data-act="mp-start" hidden>START GAME</button>
    <button data-nav data-act="mp-leave">BACK</button>
  </div>
</div>
<div id="scr-wait" class="screen dim" hidden>
  <h1>WAITING</h1>
  <p class="note">Your teammates are still choosing:</p>
  <div class="who"></div>
</div>
<div id="scr-shop" class="screen dim" hidden>
  <h1>SHOP</h1>
  <div class="shop-top"></div>
  <div class="shop-offers"></div>
  <div class="menu row shop-extras"></div>
  <div class="section owned-title"></div>
  <div class="owned-mods"></div>
</div>
<div id="scr-unlocks" class="screen dim" hidden>
  <h1>UNLOCKS</h1>
  <p class="note">Achievements carry over between runs. Some add new weapons to your level-up cards.</p>
  <div class="scroll">
    <div class="ach-list"></div>
  </div>
  <div class="menu row">
    <button data-nav data-act="savedata">SAVE DATA</button>
    <button data-nav data-act="ul-back">BACK</button>
  </div>
</div>
<div id="scr-savedata" class="screen dim" hidden>
  <h1>SAVE DATA</h1>
  <p class="note">Your progress saves by itself. To back it up or move it to another PC, save it to a file, then load that file on the other PC.</p>
  <input id="save-file" type="file" accept=".json,.txt,application/json" hidden />
  <div class="msg"></div>
  <div class="menu row wrap">
    <button data-nav data-act="export">SAVE TO FILE</button>
    <button data-nav data-act="import">LOAD FROM FILE</button>
    <button data-nav data-act="wipe">RESET SAVE</button>
    <button data-nav data-act="sd-back">BACK</button>
  </div>
</div>
<div id="scr-gameover" class="screen dim" hidden>
  <h1 class="ko">K.O.!</h1>
  <div class="newbest" hidden>NEW HIGH SCORE!</div>
  <div class="go-cols">
    <div class="summary"></div>
    <div class="dmg-table"></div>
  </div>
  <div class="build"></div>
  <div class="unlocked"></div>
  <div class="menu row">
    <button data-nav data-act="retry">RETRY</button>
    <button data-nav data-act="title">TITLE</button>
  </div>
  <div class="hiscores"></div>
</div>`,
    );
    const names: Named[] = ['title', 'pause', 'settings', 'levelup', 'shop', 'unlocks', 'savedata', 'gameover', 'online', 'wait'];
    for (const n of names) this.els[n] = root.querySelector<HTMLElement>(`#scr-${n}`)!;
    this.navs = {
      title: new MenuNav(this.els.title),
      pause: new MenuNav(this.els.pause, { onBack: () => actions.resume() }),
      settings: new MenuNav(this.els.settings, { onBack: () => this.show(this.settingsReturn) }),
      levelup: new MenuNav(this.els.levelup, { horizontal: true }),
      shop: new MenuNav(this.els.shop, { columns: 4 }),
      unlocks: new MenuNav(this.els.unlocks, { horizontal: true, onBack: () => actions.title() }),
      savedata: new MenuNav(this.els.savedata, { horizontal: true, onBack: () => this.show('unlocks') }),
      gameover: new MenuNav(this.els.gameover, { horizontal: true }),
      online: new MenuNav(this.els.online, { onBack: () => actions.mpLeave() }),
      wait: new MenuNav(this.els.wait),
    };

    // Keep buttons from taking DOM focus on click, so Enter/Space don't fire twice.
    root.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('button')) e.preventDefault();
    });

    root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!btn) return;
      switch (btn.dataset.act) {
        case 'start':
          return actions.start();
        case 'online':
          return actions.online();
        case 'mp-host':
          return actions.mpHost(this.nameField.value);
        case 'mp-join':
          return actions.mpJoin(this.nameField.value, this.els.online.querySelector<HTMLInputElement>('#mp-code')!.value);
        case 'mp-start':
          return actions.mpStart();
        case 'mp-leave':
          return actions.mpLeave();
        case 'resume':
          return actions.resume();
        case 'quit':
          return actions.quit();
        case 'retry':
          return actions.retry();
        case 'title':
        case 'ul-back':
          return actions.title();
        case 'pick':
          return actions.pick(Number(btn.dataset.index));
        case 'reroll':
          return actions.reroll();
        case 'skip':
          return actions.skip();
        case 'buy':
          return actions.buy(Number(btn.dataset.index));
        case 'sell':
          return actions.sell(Number(btn.dataset.index));
        case 'mod-left':
          return actions.moveMod(Number(btn.dataset.index), -1);
        case 'mod-right':
          return actions.moveMod(Number(btn.dataset.index), 1);
        case 'shop-reroll':
          return actions.shopReroll();
        case 'shop-heal':
          return actions.shopHeal();
        case 'shop-done':
          return actions.shopDone();
        case 'settings':
          this.settingsReturn = this.current;
          return this.show('settings');
        case 'back':
          return this.show(this.settingsReturn);
        case 'unlocks':
          return this.show('unlocks');
        case 'savedata':
          return this.show('savedata');
        case 'sd-back':
          return this.show('unlocks');
        case 'export':
          return this.doExport();
        case 'import':
          return this.doImport();
        case 'wipe':
          return this.doWipe(btn);
      }
    });

    // Settings controls
    const setEl = this.els.settings;
    setEl.querySelectorAll<HTMLInputElement>('input[data-set]').forEach((inp) => {
      inp.addEventListener('input', () => {
        (settings as unknown as Record<string, number>)[inp.dataset.set!] = Number(inp.value);
        saveSettings();
      });
    });
    setEl.querySelectorAll<HTMLElement>('[data-toggle]').forEach((b) => {
      b.addEventListener('click', () => {
        const key = b.dataset.toggle as 'autoFire' | 'showFps';
        settings[key] = !settings[key];
        saveSettings();
        this.syncSettings();
      });
    });
  }

  show(name: ScreenName, focus?: number): void {
    this.current = name;
    for (const [k, el] of Object.entries(this.els)) el.hidden = k !== name;
    // Hide in-game banners and toasts behind menus.
    this.root.classList.toggle('menu-open', name !== 'none');
    if (name === 'settings') this.syncSettings();
    if (name === 'title') this.renderProgress();
    if (name === 'unlocks') this.renderUnlocks();
    if (name === 'savedata') {
      this.wipeArmed = false;
      this.msg('');
      this.els.savedata.querySelector<HTMLElement>('[data-act=wipe]')!.textContent = 'RESET SAVE';
    }
    if (name !== 'none') this.navs[name].refresh(focus ?? (name === 'levelup' ? 1 : 0));
  }

  update(input: Input, dt: number): void {
    if (this.current !== 'none') this.navs[this.current].update(input, dt);
    this.tickReels(dt);
  }

  // ---------------------------------------------------------------- online

  private get nameField(): HTMLInputElement {
    return this.els.online.querySelector<HTMLInputElement>('#mp-name')!;
  }

  showOnline(name: string): void {
    this.nameField.value = name;
    this.setLobby({ code: '', players: [], isHost: false, status: '' });
    this.show('online');
  }

  /** Lobby state: before connecting (code empty) or waiting for the host to start. */
  setLobby(v: LobbyView): void {
    const el = this.els.online;
    const inLobby = v.code !== '' || v.players.length > 0;
    el.querySelector<HTMLElement>('.lobby')!.hidden = !inLobby;
    el.querySelector<HTMLElement>('.mp-choice')!.hidden = inLobby;
    el.querySelector<HTMLElement>('.join-row')!.hidden = inLobby;
    el.querySelector<HTMLElement>('.field')!.hidden = inLobby;
    el.querySelector('.code-big')!.textContent = v.code;
    el.querySelector('.players')!.innerHTML = v.players
      .map((p, i) => `<div class="lobby-player" style="--c:${p.color}"><span class="dot"></span>${p.name}${i === 0 ? ' <small>HOST</small>' : ''}</div>`)
      .join('');
    el.querySelector<HTMLElement>('[data-act=mp-start]')!.hidden = !(v.isHost && v.code);
    el.querySelector('.mp-status')!.textContent = v.status;
    if (this.current !== 'online') this.show('online');
    else this.navs.online.refresh(this.navs.online.focus);
  }

  showWait(who: string[]): void {
    this.els.wait.querySelector('.who')!.innerHTML = who.map((n) => `<div class="lobby-player"><span class="dot"></span>${n}</div>`).join('');
    this.show('wait');
  }

  // ---------------------------------------------------------------- settings

  private syncSettings(): void {
    const el = this.els.settings;
    el.querySelectorAll<HTMLInputElement>('input[data-set]').forEach((inp) => {
      inp.value = String((settings as unknown as Record<string, number>)[inp.dataset.set!]);
    });
    el.querySelectorAll<HTMLElement>('[data-toggle]').forEach((b) => {
      const on = settings[b.dataset.toggle as 'autoFire' | 'showFps'];
      b.querySelector('b')!.textContent = on ? 'ON' : 'OFF';
    });
  }

  // ---------------------------------------------------------------- title / scores

  /** Title screen: how many achievements are done. */
  private renderProgress(): void {
    const done = ACHIEVEMENTS.filter((a) => save.achievements.includes(a.id)).length;
    this.els.title.querySelector('.wallet')!.textContent = `★ ${done} / ${ACHIEVEMENTS.length} UNLOCKED`;
  }

  setHighScores(list: ScoreEntry[], highlight = -1): void {
    const rows = list.length
      ? list
          .slice(0, 5)
          .map((e, i) => `<tr class="${i === highlight ? 'me' : ''}"><td>${i + 1}</td><td>${fmtScore(e.score)}</td><td>STAGE ${e.stage}</td></tr>`)
          .join('')
      : '<tr><td colspan="3">No scores yet. Go set one!</td></tr>';
    const html = `<div class="hs-title">HIGH SCORES</div><table>${rows}</table>`;
    for (const el of [this.els.title, this.els.gameover]) el.querySelector('.hiscores')!.innerHTML = html;
  }

  // ---------------------------------------------------------------- level-up

  showLevelUp(offers: Offer[], title: string, rerolls: number, loadout: LoadoutItem[], skipGold = 0): void {
    const el = this.els.levelup;
    el.querySelector('h1')!.textContent = title;
    // Each icon rolls like a slot reel; cards land left to right, a legendary spins longer and slows right down.
    const still = reduceMotion();
    const steps = offers.map((o, i) => {
      if (still) return [];
      const legend = o.rarity === 'legendary';
      return reelSteps(0.45 + 0.25 * i + (legend ? 1.5 : 0), legend ? [0.06, 0.08, 0.1, 0.13, 0.17, 0.22, 0.3, 0.4] : [0.07, 0.1]);
    });
    el.querySelector('.cards')!.innerHTML = offers
      .map(
        (o, i) => `<button class="card rolling ${o.kind} ${o.rarity ? 'r-' + o.rarity : ''} ${cardMode(o)}" data-nav data-act="pick" data-index="${i}">
          <i class="fx"></i>
          <div class="tag ${cardMode(o)}">${cardMode(o) === 'upgrade' ? '▲ UPGRADE' : o.tag}</div>
          ${cardMode(o) === 'new' ? '<div class="ribbon">NEW</div>' : ''}
          <div class="icon" style="--c:${o.color}"><div class="reel"><div class="strip">${iconHtml(o.id, o.color, o.icon)}${decoys(steps[i].length, o.id)
            .map((d) => iconHtml(d.id, d.color, d.icon))
            .join('')}</div></div></div>
          <div class="name">${o.name}</div>
          ${levelPips(o)}
          <div class="desc">${o.text}</div>
          ${o.tags ? `<div class="chips">${tagChips(o.tags)}</div>` : ''}
          ${o.replaces ? replaceStrip(o.replaces) : ''}
          <div class="kind"><span class="r-text-${o.rarity ?? 'common'}">${o.rarity ? RARITY[o.rarity].label : ''}</span> ${o.kind === 'weapon' ? 'WEAPON' : o.kind === 'passive' ? 'ITEM' : o.kind === 'special' ? 'SPECIAL (Q/E)' : 'BONUS'}</div>
          <div class="key">${i + 1}</div>
        </button>`,
      )
      .join('');
    el.querySelector('.reroll-row')!.innerHTML =
      (rerolls > 0 ? `<button data-nav data-act="reroll">REROLL ⚙ ${rerolls} [R]</button>` : '') +
      (skipGold > 0 ? `<button data-nav data-act="skip" class="skip">SKIP +${skipGold}<span class="gold-dot"></span></button>` : '');
    el.querySelector('.build')!.innerHTML = loadout.map(badge).join('');
    this.show('levelup');
    const cards = el.querySelectorAll<HTMLElement>('.card');
    this.reels = offers.map((o, i) => ({ card: cards[i], strip: cards[i].querySelector<HTMLElement>('.strip')!, steps: steps[i], passed: 0, rarity: o.rarity }));
    this.reelT = 0;
    this.tickReels(0);
  }

  /** Advance the level-up reels: a click per item passing, then each card's landing. */
  private tickReels(dt: number): void {
    if (!this.reels.length) return;
    if (this.current !== 'levelup') {
      this.reels = [];
      return;
    }
    this.reelT += dt;
    let tick = false;
    this.reels = this.reels.filter((r) => {
      const { pos, passed } = reelAt(r.steps, this.reelT);
      r.strip.style.setProperty('--k', String(pos));
      if (passed > r.passed && passed < r.steps.length) tick = true;
      r.passed = passed;
      if (passed < r.steps.length) return true;
      this.landCard(r.card, r.rarity);
      return false;
    });
    if (tick) sfx.reelTick();
  }

  /** A reel stops: reveal the card and play its tier's landing (legendary gets the fanfare and gold flash). */
  private landCard(card: HTMLElement, rarity: Rarity = 'common'): void {
    card.classList.remove('rolling');
    card.classList.add('land');
    sfx.reelLand(rarity);
    const icon = card.querySelector<HTMLElement>('.icon')!;
    if (rarity === 'uncommon') burstAt(icon, ['var(--lime)', 'var(--white)'], 8);
    if (rarity === 'legendary') {
      sfx.legendary();
      replay(this.els.levelup, 'legend-flash');
      burstAt(card, ['var(--yellow)', 'var(--orange)', 'var(--white)'], 26);
    }
  }

  /** The pause screen shows the current build. */
  setPauseBuild(loadout: LoadoutItem[], mods: ModDef[] = []): void {
    this.els.pause.querySelector('.build')!.innerHTML =
      loadout.map(badge).join('') + (mods.length ? `<div class="mod-strip">${mods.map(modChip).join('')}</div>` : '');
  }

  // ---------------------------------------------------------------- shop

  showShop(v: ShopView, focus?: number): void {
    const el = this.els.shop;
    const wasOpen = this.current === 'shop';
    el.querySelector('h1')!.textContent = v.pre ? 'STARTING SHOP' : `STAGE ${v.stage} SHOP`;
    el.querySelector('.shop-top')!.innerHTML =
      `<span class="gold-big"><span class="gold-dot"></span> ${v.gold} GOLD</span>` +
      (v.pre
        ? `<span class="interest pre">FREE 15 GOLD: SPEND IT NOW, IT ISN'T KEPT</span>`
        : `<span class="interest">Interest next clear: +${v.interest} (1 per ${v.interestPer} held, max ${v.interestCap})</span>`);
    el.querySelector('.shop-offers')!.innerHTML = v.offers
      .map((o, i) => {
        if (!o) return `<div class="mod-card sold">SOLD</div>`;
        const m = o.def;
        const cant = o.price > v.gold || v.owned.length >= v.slots;
        return `<button class="mod-card ${m.rarity} r-${m.rarity} ${m.cursed ? 'cursed' : ''} ${cant ? 'cant' : ''}" data-nav data-act="buy" data-index="${i}">
          <div class="rarity">${m.cursed ? 'CURSED' : m.rarity.toUpperCase()}</div>
          <div class="icon" style="--c:${m.color}">${iconHtml(m.id, m.color, m.icon)}</div>
          <div class="name">${m.name}</div>
          <div class="desc">${m.desc}</div>
          ${m.synergy ? `<div class="chips">${tagChips(m.synergy)}</div>` : ''}
          ${o.hint ? `<div class="hint">${o.hint}</div>` : ''}
          <div class="price"><span class="gold-dot"></span> ${o.price}</div>
        </button>`;
      })
      .join('');
    el.querySelector('.shop-extras')!.innerHTML =
      `<button data-nav data-act="shop-reroll" class="${v.rerollCost > v.gold ? 'cant' : ''}">REROLL ${v.rerollCost ? `<span class="gold-dot"></span> ${v.rerollCost}` : 'FREE'}</button>` +
      `<button data-nav data-act="shop-heal" class="${v.healed || v.healCost > v.gold ? 'cant' : ''}">HEAL 40% <span class="gold-dot"></span> ${v.healCost}</button>` +
      `<button data-nav data-act="shop-done" class="continue">CONTINUE &#9654;</button>`;
    el.querySelector('.owned-title')!.textContent = `YOUR MODS ${v.owned.length}/${v.slots} — damage flows left to right`;
    const empty = Math.max(0, v.slots - v.owned.length);
    el.querySelector('.owned-mods')!.innerHTML =
      v.owned
        .map(
          (o, i) => `<div class="owned-mod ${o.def.cursed ? 'cursed' : ''}" title="${o.def.desc}">
          <div class="slot-no">${i + 1}</div>
          <div class="icon" style="--c:${o.def.color}">${iconHtml(o.def.id, o.def.color, o.def.icon)}</div>
          <div class="name">${o.def.name}</div>
          <div class="desc">${o.def.desc}</div>
          ${o.readout ? `<div class="readout">${o.readout}</div>` : ''}
          <div class="ctrl">
            <button data-nav data-act="mod-left" data-index="${i}" ${i === 0 ? 'disabled' : ''}>&#9664;</button>
            <button data-nav data-act="mod-right" data-index="${i}" ${i === v.owned.length - 1 ? 'disabled' : ''}>&#9654;</button>
            <button data-nav data-act="sell" data-index="${i}" class="sell">SELL +${o.sell}</button>
          </div>
        </div>`,
        )
        .join('') + '<div class="owned-mod empty"></div>'.repeat(empty);
    this.show('shop', focus);
    // Gold changes pop a +/- number over the counter.
    const delta = wasOpen && this.shopGold >= 0 ? v.gold - this.shopGold : 0;
    this.shopGold = v.gold;
    if (delta) {
      const gold = el.querySelector<HTMLElement>('.gold-big')!;
      replay(gold, 'bump');
      floatText(gold, `${delta > 0 ? '+' : ''}${delta}`, delta > 0 ? 'var(--yellow)' : 'var(--orange)');
    }
  }

  /** Shop juice: a sound plus pixel particles for each shop action. */
  shopFx(kind: ShopFx, i = 0): void {
    const el = this.els.shop;
    const gold = el.querySelector<HTMLElement>('.gold-big');
    switch (kind) {
      case 'open': {
        sfx.shopOpen();
        replay(el.querySelector('h1')!, 'slam-in');
        // Coin shower across the top of the screen.
        for (let k = 0; k < 28; k++) {
          const x = Math.random() * innerWidth;
          bit(x, -20, x + (Math.random() - 0.5) * 60, innerHeight * (0.35 + Math.random() * 0.4), true, Math.random() * 0.5, 0.9);
        }
        break;
      }
      case 'buy': {
        sfx.buy();
        const card = el.querySelector('.shop-offers')!.children[i] as HTMLElement | undefined;
        if (card && gold) coinsBetween(gold, card, 14);
        if (card) burstAt(card, ['var(--white)', 'var(--yellow)', 'var(--cyan)'], 18);
        const owned = el.querySelectorAll<HTMLElement>('.owned-mod:not(.empty)');
        const fresh = owned[owned.length - 1];
        if (fresh) replay(fresh, 'fresh');
        break;
      }
      case 'sell':
        sfx.sell();
        if (gold) burstAt(gold, ['var(--yellow)', 'var(--orange)'], 16, true);
        break;
      case 'reroll':
        sfx.reroll();
        el.querySelectorAll<HTMLElement>('.shop-offers > *').forEach((c, k) => {
          c.style.animationDelay = `${k * 0.06}s`;
          replay(c, 'reroll-in');
        });
        break;
      case 'heal': {
        sfx.heal();
        const btn = el.querySelector<HTMLElement>('[data-act="shop-heal"]');
        if (btn) burstAt(btn, ['var(--green)', 'var(--lime)', 'var(--white)'], 20);
        replay(el, 'heal-flash');
        break;
      }
      case 'deny': {
        sfx.deny();
        const f = el.querySelector<HTMLElement>('.focused');
        if (f) replay(f, 'deny');
        if (gold) replay(gold, 'deny');
        break;
      }
    }
  }

  // ---------------------------------------------------------------- unlocks

  private renderUnlocks(): void {
    this.els.unlocks.querySelector('.ach-list')!.innerHTML = ACHIEVEMENTS.map((a) => {
      const done = save.achievements.includes(a.id);
      const reward = a.unlockWeapon ? `Unlocks ${WEAPONS[a.unlockWeapon].name}` : '';
      return `<div class="ach ${done ? 'done' : ''}"><span class="check">${done ? '★' : '☆'}</span><span class="name">${a.name}</span><span class="desc">${a.desc}</span><span class="reward">${reward}</span></div>`;
    }).join('');
  }

  // ---------------------------------------------------------------- save data

  private msg(text: string, ok = true): void {
    const m = this.els.savedata.querySelector<HTMLElement>('.msg')!;
    m.textContent = text;
    m.classList.toggle('err', !ok);
  }

  private doExport(): void {
    const url = URL.createObjectURL(new Blob([exportFile()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'InfiniShoot-save.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.msg('Saved! Keep InfiniShoot-save.json somewhere safe.');
  }

  private doImport(): void {
    const input = this.els.savedata.querySelector<HTMLInputElement>('#save-file')!;
    input.value = '';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      file.text().then((text) => {
        try {
          importFile(text);
          this.msg('Save loaded!');
          sfx.powerUp();
        } catch (err) {
          this.msg((err as Error).message, false);
        }
      });
    };
    input.click();
  }

  private doWipe(btn: HTMLElement): void {
    if (!this.wipeArmed) {
      this.wipeArmed = true;
      btn.textContent = 'REALLY? PRESS AGAIN';
      this.msg('This deletes your achievements, unlocked weapons and lifetime stats on this device.', false);
      return;
    }
    resetSave();
    this.wipeArmed = false;
    btn.textContent = 'RESET SAVE';
    this.msg('Save reset.');
  }

  // ---------------------------------------------------------------- game over

  showGameOver(sum: RunSummary, rank: number, list: ScoreEntry[], waitingForHost = false): void {
    const el = this.els.gameover;
    el.querySelector<HTMLElement>('[data-act=retry]')!.textContent = waitingForHost ? 'HOST RESTARTS' : 'RETRY';
    el.querySelector<HTMLElement>('.newbest')!.hidden = rank !== 0;
    el.querySelector('.summary')!.innerHTML = `
      <div class="big">${fmtScore(sum.score)}</div>
      <div class="grid">
        <span>STAGE</span><b>${sum.stage}</b>
        <span>LEVEL</span><b>${sum.level}</b>
        <span>KILLS</span><b>${sum.kills.toLocaleString('en-US')}</b>
        <span>BEST COMBO</span><b>${sum.maxCombo}</b>
        <span>TIME</span><b>${fmtTime(sum.time)}</b>
      </div>`;
    const top = sum.damage.slice(0, 6);
    const max = top[0]?.dmg || 1;
    el.querySelector('.dmg-table')!.innerHTML =
      `<div class="hs-title">DAMAGE DEALT</div>` +
      top
        .map(
          (d) =>
            `<div class="dmg-row"><span>${d.name}</span><div class="bar"><div style="width:${(d.dmg / max) * 100}%;background:${d.color}"></div></div><b>${fmtScore(d.dmg)}</b></div>`,
        )
        .join('');
    el.querySelector('.build')!.innerHTML =
      sum.loadout.map(badge).join('') + (sum.mods.length ? `<div class="mod-strip">MODS: ${sum.mods.join(' · ')}</div>` : '');
    el.querySelector('.unlocked')!.innerHTML = sum.achievements.length ? `★ NEW: ${sum.achievements.join(' · ')}` : '';
    this.setHighScores(list, rank);
    this.show('gameover');
  }
}

// ---------------------------------------------------------------- shop particles

/** Restart a CSS animation class on an element. */
function replay(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

/** One pixel bit (or coin) flying from (x0, y0) to (x1, y1) with a little hop. */
function bit(x0: number, y0: number, x1: number, y1: number, coin: boolean, delay = 0, dur = 0.55, color = 'var(--yellow)'): void {
  if (reduceMotion()) return; // without its animation a bit would never fly off or get removed
  const b = document.createElement('i');
  b.className = coin ? 'px-bit coin' : 'px-bit';
  const s = b.style;
  s.setProperty('--x0', `${x0}px`);
  s.setProperty('--y0', `${y0}px`);
  s.setProperty('--x1', `${x1}px`);
  s.setProperty('--y1', `${y1}px`);
  s.setProperty('--xm', `${(x0 + x1) / 2}px`);
  s.setProperty('--ym', `${Math.min(y0, y1) - 30 - Math.random() * 40}px`);
  s.setProperty('--c', color);
  s.animationDelay = `${delay}s`;
  s.animationDuration = `${dur}s`;
  b.addEventListener('animationend', () => b.remove(), { once: true });
  document.body.appendChild(b);
}

function centre(el: HTMLElement): [number, number] {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

/** Pixels bursting out of an element. `fountain` arcs them up and lets them fall. */
function burstAt(el: HTMLElement, colors: string[], n: number, fountain = false): void {
  const [x, y] = centre(el);
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    const d = 40 + Math.random() * 70;
    const tx = x + Math.cos(a) * d;
    const ty = fountain ? y + 30 + Math.random() * 60 : y + Math.sin(a) * d;
    bit(x, y, tx, ty, fountain, Math.random() * 0.08, 0.45 + Math.random() * 0.25, colors[k % colors.length]);
  }
}

/** Coins streaming from one element to another (gold spent on a card). */
function coinsBetween(from: HTMLElement, to: HTMLElement, n: number): void {
  const [x0, y0] = centre(from);
  const [x1, y1] = centre(to);
  for (let k = 0; k < n; k++) bit(x0, y0, x1 + (Math.random() - 0.5) * 60, y1 + (Math.random() - 0.5) * 60, true, k * 0.025, 0.45);
}

/** A number that rises and fades over an element. */
function floatText(el: HTMLElement, text: string, color: string): void {
  const [x, y] = centre(el);
  const t = document.createElement('i');
  t.className = 'px-float';
  t.textContent = text;
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
  t.style.color = color;
  t.addEventListener('animationend', () => t.remove(), { once: true });
  document.body.appendChild(t);
}
