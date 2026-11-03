// Pure meta-game logic: every function takes a Save and returns a new one. No React, no storage.
import { pickWeighted, type Rng } from '../core/rng';
import type { Level } from '../core/levels';
import {
  HABITATS,
  HABITAT_LEVELS,
  HABITAT_UPGRADE_COST,
  HEARTS_FOR_DUPLICATE,
  PETS,
  PRODUCTION_CAP_MIN,
  RARITIES,
  habitatById,
  habitatForSpecies,
  petById,
  type Pet,
} from './data';

export type EggKind = 'common' | 'rare' | 'epic';
export type BoosterKind = 'undo' | 'hint' | 'shuffle';
export type TaskKind = 'levels' | 'rescue' | 'egg' | 'booster' | 'upgrade' | 'feed';

export interface Task {
  id: string;
  kind: TaskKind;
  target: number;
  progress: number;
  claimed: boolean;
}

export interface Save {
  v: 1;
  coins: number;
  gems: number;
  stars: number;
  materials: number;
  hearts: number;
  xp: number;
  boosters: Record<BoosterKind, number>;
  eggs: Record<EggKind, number>;
  /** Best stars per level id. */
  levels: Record<number, number>;
  pets: Record<string, { level: number; count: number }>;
  placed: Record<string, string>;
  habitats: Record<string, { unlocked: boolean; level: number; lastCollect: number }>;
  daily: { lastClaimDay: number; streak: number };
  tasks: { day: number; list: Task[]; bonusClaimed: boolean };
  fed: Record<string, number>;
  totals: { rescued: number; levelsCompleted: number; eggsOpened: number; levelsFailed: number };
  settings: { sound: boolean; music: boolean; haptics: boolean };
  tutorialDone: boolean;
  chapters: Record<number, boolean>;
}

export const LEVELS_PER_CHAPTER = 10;
export const CHAPTER_NAMES = ['Meadow Rescue', 'Pond Patrol', 'Forest Friends', 'Harbor Haven', 'Mountain Trail', 'Starlit Shore'];
export const chapterOf = (levelId: number) => Math.ceil(levelId / LEVELS_PER_CHAPTER);
export const chapterName = (ch: number) =>
  ch <= CHAPTER_NAMES.length ? CHAPTER_NAMES[ch - 1] : `${CHAPTER_NAMES[(ch - 1) % CHAPTER_NAMES.length]} ${Math.ceil(ch / CHAPTER_NAMES.length)}`;
export function chapterProgress(s: Save, ch: number): number {
  let n = 0;
  for (let i = (ch - 1) * LEVELS_PER_CHAPTER + 1; i <= ch * LEVELS_PER_CHAPTER; i++) if (s.levels[i]) n++;
  return n;
}
export function claimChapter(s: Save, ch: number): Save | null {
  if (s.chapters[ch] || chapterProgress(s, ch) < LEVELS_PER_CHAPTER) return null;
  return { ...s, gems: s.gems + 5, eggs: { ...s.eggs, rare: s.eggs.rare + 1 }, chapters: { ...s.chapters, [ch]: true } };
}

export const dayNumber = (now: number) =>
  Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000);

export function newSave(now: number): Save {
  const habitats: Save['habitats'] = {};
  for (const h of HABITATS) habitats[h.id] = { unlocked: h.unlockStars === 0, level: 0, lastCollect: now };
  return {
    v: 1,
    coins: 100,
    gems: 20,
    stars: 0,
    materials: 10,
    hearts: 0,
    xp: 0,
    boosters: { undo: 1, hint: 1, shuffle: 1 },
    eggs: { common: 0, rare: 0, epic: 0 },
    levels: {},
    pets: {},
    placed: {},
    habitats,
    daily: { lastClaimDay: -100, streak: 0 },
    tasks: { day: -1, list: [], bonusClaimed: false },
    fed: {},
    totals: { rescued: 0, levelsCompleted: 0, eggsOpened: 0, levelsFailed: 0 },
    settings: { sound: true, music: true, haptics: true },
    tutorialDone: false,
    chapters: {},
  };
}

// ---------- player level ----------
export const xpForLevel = (lvl: number) => 40 + lvl * 20;
export function playerLevel(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = xp;
  while (rest >= xpForLevel(level)) {
    rest -= xpForLevel(level);
    level++;
  }
  return { level, into: rest, need: xpForLevel(level) };
}

// ---------- progression ----------
export const highestUnlockedLevel = (s: Save) => {
  let n = 1;
  while (s.levels[n]) n++;
  return n;
};

export interface Reward {
  coins: number;
  materials: number;
  xp: number;
  egg: EggKind | null;
  stars: number;
  firstClear: boolean;
}

export function coinBonusPct(s: Save): number {
  let pct = 0;
  for (const id of Object.keys(s.placed)) {
    const pet = petById(id);
    const owned = s.pets[id];
    if (pet && owned) pct += (RARITIES.indexOf(pet.rarity) + 1) * owned.level * 0.5;
  }
  return Math.round(pct * 10) / 10;
}

export function levelReward(s: Save, level: Level, stars: number): Reward {
  const first = !s.levels[level.id];
  const scale = first ? 1 : 0.5;
  const base = 30 + level.types * 5 + stars * 10;
  const coins = Math.round(base * scale * (1 + coinBonusPct(s) / 100));
  let egg: EggKind | null = null;
  if (first) {
    if (level.id === 1 || level.id % 3 === 0) egg = 'common';
    if (stars === 3 && level.id % 5 === 0) egg = 'rare';
    if (level.id % 25 === 0) egg = 'epic';
  }
  return {
    coins,
    materials: Math.round((1 + level.types) * scale),
    xp: 10 + stars * 5,
    egg,
    stars,
    firstClear: first,
  };
}

export function applyLevelComplete(s: Save, level: Level, reward: Reward, rescuedCount: number, doubled: boolean): Save {
  const m = doubled ? 2 : 1;
  const prev = s.levels[level.id] ?? 0;
  const gained = Math.max(0, reward.stars - prev);
  let n: Save = {
    ...s,
    coins: s.coins + reward.coins * m,
    materials: s.materials + reward.materials * m,
    xp: s.xp + reward.xp,
    stars: s.stars + gained,
    levels: { ...s.levels, [level.id]: Math.max(prev, reward.stars) },
    totals: {
      ...s.totals,
      rescued: s.totals.rescued + rescuedCount,
      levelsCompleted: s.totals.levelsCompleted + 1,
    },
  };
  if (reward.egg) n = { ...n, eggs: { ...n.eggs, [reward.egg]: n.eggs[reward.egg] + (doubled ? 2 : 1) } };
  n = addTaskProgress(n, 'levels', 1);
  n = addTaskProgress(n, 'rescue', rescuedCount);
  return n;
}

// ---------- eggs / pets ----------
const EGG_WEIGHTS: Record<EggKind, number[]> = {
  common: [82, 16, 2, 0],
  rare: [0, 80, 18, 2],
  epic: [0, 0, 90, 10],
};

export interface EggResult {
  pet: Pet;
  duplicate: boolean;
  hearts: number;
}

export function rollEgg(kind: EggKind, rng: Rng): Pet {
  const rarity = RARITIES[pickWeighted(rng, EGG_WEIGHTS[kind])];
  const pool = PETS.filter((p) => p.rarity === rarity);
  return pool[Math.floor(rng() * pool.length)];
}

/** Opens one egg of the given kind. Returns null if the player has none. */
export function openEgg(s: Save, kind: EggKind, rng: Rng): { save: Save; result: EggResult } | null {
  if (s.eggs[kind] <= 0) return null;
  // The very first egg is always a cat so a new player can place it in the unlocked Cat Cottage.
  const pet = Object.keys(s.pets).length === 0 ? petById('whiskers') : rollEgg(kind, rng);
  const owned = s.pets[pet.id];
  const hearts = owned ? HEARTS_FOR_DUPLICATE[pet.rarity] : 0;
  let n: Save = {
    ...s,
    eggs: { ...s.eggs, [kind]: s.eggs[kind] - 1 },
    hearts: s.hearts + hearts,
    pets: { ...s.pets, [pet.id]: owned ? { ...owned, count: owned.count + 1 } : { level: 1, count: 1 } },
    totals: { ...s.totals, eggsOpened: s.totals.eggsOpened + 1 },
  };
  n = addTaskProgress(n, 'egg', 1);
  return { save: n, result: { pet, duplicate: !!owned, hearts } };
}

export const petUpgradeCost = (level: number) => level * 5;
export const MAX_PET_LEVEL = 5;

export function upgradePet(s: Save, id: string): Save | null {
  const owned = s.pets[id];
  if (!owned || owned.level >= MAX_PET_LEVEL) return null;
  const cost = petUpgradeCost(owned.level);
  if (s.hearts < cost) return null;
  return { ...s, hearts: s.hearts - cost, pets: { ...s.pets, [id]: { ...owned, level: owned.level + 1 } } };
}

// ---------- habitats ----------
export const habitatCapacity = (s: Save, id: string) => HABITAT_LEVELS[s.habitats[id].level].capacity;
export const petsIn = (s: Save, habitatId: string) => Object.keys(s.placed).filter((p) => s.placed[p] === habitatId);

export function canUnlockHabitat(s: Save, id: string): boolean {
  return !s.habitats[id].unlocked && s.stars >= habitatById(id).unlockStars;
}

export function unlockHabitat(s: Save, id: string, now: number): Save | null {
  if (!canUnlockHabitat(s, id)) return null;
  return { ...s, habitats: { ...s.habitats, [id]: { unlocked: true, level: 0, lastCollect: now } } };
}

export function upgradeCost(s: Save, id: string) {
  const lvl = s.habitats[id].level;
  return lvl >= HABITAT_UPGRADE_COST.length ? null : HABITAT_UPGRADE_COST[lvl];
}

export function canUpgradeHabitat(s: Save, id: string): boolean {
  const c = upgradeCost(s, id);
  return !!c && s.habitats[id].unlocked && s.coins >= c.coins && s.materials >= c.materials;
}

export function upgradeHabitat(s: Save, id: string, now: number): Save | null {
  const c = upgradeCost(s, id);
  if (!c || !canUpgradeHabitat(s, id)) return null;
  const h = collectProduction(s, id, now);
  const n: Save = {
    ...h,
    coins: h.coins - c.coins,
    materials: h.materials - c.materials,
    habitats: { ...h.habitats, [id]: { ...h.habitats[id], level: h.habitats[id].level + 1 } },
  };
  return addTaskProgress(n, 'upgrade', 1);
}

export function placePet(s: Save, petId: string): Save | { error: string } {
  const pet = petById(petId);
  if (!s.pets[petId]) return { error: 'You do not own this pet yet.' };
  const hab = habitatForSpecies(pet.species);
  const state = s.habitats[hab.id];
  if (!state.unlocked) return { error: `${hab.name} is still locked (needs ${hab.unlockStars} stars).` };
  if (s.placed[petId] === hab.id) return s;
  if (petsIn(s, hab.id).length >= habitatCapacity(s, hab.id)) return { error: `${hab.name} is full. Upgrade it first.` };
  return { ...s, placed: { ...s.placed, [petId]: hab.id } };
}

export function unplacePet(s: Save, petId: string): Save {
  const placed = { ...s.placed };
  delete placed[petId];
  return { ...s, placed };
}

export function pendingProduction(s: Save, id: string, now: number): number {
  const h = s.habitats[id];
  if (!h.unlocked) return 0;
  const rate = HABITAT_LEVELS[h.level].coinsPerMin;
  const minutes = Math.min(PRODUCTION_CAP_MIN, Math.max(0, (now - h.lastCollect) / 60000));
  return Math.floor(rate * petsIn(s, id).length * minutes * 0.5);
}

export function collectProduction(s: Save, id: string, now: number): Save {
  const amount = pendingProduction(s, id, now);
  return {
    ...s,
    coins: s.coins + amount,
    habitats: { ...s.habitats, [id]: { ...s.habitats[id], lastCollect: now } },
  };
}

export function feedPet(s: Save, petId: string, now: number): Save | null {
  const day = dayNumber(now);
  if (s.fed[petId] === day || !s.pets[petId]) return null;
  const n: Save = { ...s, fed: { ...s.fed, [petId]: day }, coins: s.coins + 5, xp: s.xp + 2 };
  return addTaskProgress(n, 'feed', 1);
}

// ---------- boosters / purchases ----------
export function useBooster(s: Save, kind: BoosterKind): Save | null {
  if (s.boosters[kind] <= 0) return null;
  return addTaskProgress({ ...s, boosters: { ...s.boosters, [kind]: s.boosters[kind] - 1 } }, 'booster', 1);
}

export function noteBoosterUse(s: Save): Save {
  return addTaskProgress(s, 'booster', 1);
}

export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  desc: string;
  price: number;
  currency: 'coins' | 'gems';
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'undo', name: 'Undo x3', icon: '↩️', desc: 'Reverse your last move', price: 90, currency: 'coins' },
  { id: 'hint', name: 'Hint x3', icon: '💡', desc: 'Highlight a smart move', price: 90, currency: 'coins' },
  { id: 'shuffle', name: 'Shuffle x2', icon: '🔀', desc: 'Rearrange the board', price: 120, currency: 'coins' },
  { id: 'egg-common', name: 'Common Egg', icon: '🥚', desc: 'A new friend awaits', price: 150, currency: 'coins' },
  { id: 'egg-rare', name: 'Rare Egg', icon: '🥚', desc: 'Rare or better pet', price: 12, currency: 'gems' },
  { id: 'egg-epic', name: 'Epic Egg', icon: '🥚', desc: 'Epic chance, legendary possible', price: 35, currency: 'gems' },
  { id: 'materials', name: 'Materials x20', icon: '🧱', desc: 'For habitat upgrades', price: 8, currency: 'gems' },
];

export function buyItem(s: Save, itemId: string): Save | null {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return null;
  if (s[item.currency] < item.price) return null;
  let n: Save = { ...s, [item.currency]: s[item.currency] - item.price };
  if (itemId === 'undo') n = { ...n, boosters: { ...n.boosters, undo: n.boosters.undo + 3 } };
  else if (itemId === 'hint') n = { ...n, boosters: { ...n.boosters, hint: n.boosters.hint + 3 } };
  else if (itemId === 'shuffle') n = { ...n, boosters: { ...n.boosters, shuffle: n.boosters.shuffle + 2 } };
  else if (itemId === 'materials') n = { ...n, materials: n.materials + 20 };
  else if (itemId.startsWith('egg-')) {
    const kind = itemId.slice(4) as EggKind;
    n = { ...n, eggs: { ...n.eggs, [kind]: n.eggs[kind] + 1 } };
  }
  return n;
}

// ---------- daily streak ----------
export function dailyStatus(s: Save, now: number): { claimable: boolean; streak: number; dayIndex: number } {
  const today = dayNumber(now);
  const gap = today - s.daily.lastClaimDay;
  const claimable = gap >= 1;
  // One missed day is forgiven (grace); longer gaps restart the calendar.
  const streak = gap <= 2 ? s.daily.streak : 0;
  return { claimable, streak, dayIndex: streak % 7 };
}

export function claimDaily(s: Save, now: number, doubled = false): Save | null {
  const st = dailyStatus(s, now);
  if (!st.claimable) return null;
  const m = doubled ? 2 : 1;
  let n: Save = { ...s, daily: { lastClaimDay: dayNumber(now), streak: st.streak + 1 } };
  switch (st.dayIndex) {
    case 0:
      n = { ...n, coins: n.coins + 100 * m };
      break;
    case 1:
      n = { ...n, eggs: { ...n.eggs, common: n.eggs.common + m } };
      break;
    case 2:
      n = { ...n, boosters: { ...n.boosters, shuffle: n.boosters.shuffle + m } };
      break;
    case 3:
      n = { ...n, coins: n.coins + 250 * m };
      break;
    case 4:
      n = { ...n, eggs: { ...n.eggs, rare: n.eggs.rare + m } };
      break;
    case 5:
      n = { ...n, materials: n.materials + 25 * m };
      break;
    default:
      n = { ...n, eggs: { ...n.eggs, epic: n.eggs.epic + m } };
  }
  return n;
}

// ---------- daily tasks ----------
const TASK_POOL: Omit<Task, 'progress' | 'claimed' | 'id'>[] = [
  { kind: 'levels', target: 3 },
  { kind: 'levels', target: 5 },
  { kind: 'rescue', target: 10 },
  { kind: 'rescue', target: 20 },
  { kind: 'egg', target: 1 },
  { kind: 'booster', target: 1 },
  { kind: 'upgrade', target: 1 },
  { kind: 'feed', target: 1 },
];

export const TASK_LABEL: Record<TaskKind, (n: number) => string> = {
  levels: (n) => `Complete ${n} levels`,
  rescue: (n) => `Rescue ${n} pets`,
  egg: (n) => `Open ${n} egg`,
  booster: (n) => `Use ${n} booster`,
  upgrade: (n) => `Upgrade ${n} habitat`,
  feed: (n) => `Feed ${n} pet`,
};
export const TASK_REWARD_COINS = 50;
export const TASK_BONUS = { coins: 100, gems: 5 };

export function ensureDailyTasks(s: Save, now: number): Save {
  const day = dayNumber(now);
  if (s.tasks.day === day) return s;
  // Always one level task, then two others, chosen from the day number (deterministic).
  const pick = (i: number) => TASK_POOL[(day * 7 + i * 3) % TASK_POOL.length];
  const list: Task[] = [];
  const kinds = new Set<TaskKind>();
  let i = 0;
  while (list.length < 3 && i < 30) {
    const t = list.length === 0 ? TASK_POOL[day % 2] : pick(i);
    i++;
    if (kinds.has(t.kind)) continue;
    kinds.add(t.kind);
    list.push({ id: `${day}-${list.length}`, kind: t.kind, target: t.target, progress: 0, claimed: false });
  }
  return { ...s, tasks: { day, list, bonusClaimed: false } };
}

export function addTaskProgress(s: Save, kind: TaskKind, n: number): Save {
  if (n <= 0 || s.tasks.list.length === 0) return s;
  return {
    ...s,
    tasks: {
      ...s.tasks,
      list: s.tasks.list.map((t) => (t.kind === kind ? { ...t, progress: Math.min(t.target, t.progress + n) } : t)),
    },
  };
}

export function claimTask(s: Save, id: string): Save | null {
  const t = s.tasks.list.find((x) => x.id === id);
  if (!t || t.claimed || t.progress < t.target) return null;
  return {
    ...s,
    coins: s.coins + TASK_REWARD_COINS,
    tasks: { ...s.tasks, list: s.tasks.list.map((x) => (x.id === id ? { ...x, claimed: true } : x)) },
  };
}

export function claimTaskBonus(s: Save): Save | null {
  if (s.tasks.bonusClaimed || s.tasks.list.length === 0 || !s.tasks.list.every((t) => t.claimed)) return null;
  return {
    ...s,
    coins: s.coins + TASK_BONUS.coins,
    gems: s.gems + TASK_BONUS.gems,
    eggs: { ...s.eggs, common: s.eggs.common + 1 },
    tasks: { ...s.tasks, bonusClaimed: true },
  };
}

/** What the player should aim for next, shown at the top of the Sanctuary. */
export function mainGoal(s: Save): string {
  const next = HABITATS.find((h) => !s.habitats[h.id].unlocked);
  if (next) return `Earn ${next.unlockStars} ⭐ to open ${next.name} (${s.stars}/${next.unlockStars})`;
  return `Rescue ${Math.ceil((s.totals.rescued + 1) / 20) * 20} pets (${s.totals.rescued})`;
}
