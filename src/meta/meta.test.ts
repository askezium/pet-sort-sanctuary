import { describe, expect, it } from 'vitest';
import { generateLevel } from '../core/levels';
import { mulberry32 } from '../core/rng';
import {
  applyLevelComplete,
  buyItem,
  claimDaily,
  claimTask,
  claimTaskBonus,
  dailyStatus,
  ensureDailyTasks,
  feedPet,
  levelReward,
  newSave,
  openEgg,
  pendingProduction,
  placePet,
  playerLevel,
  unlockHabitat,
  upgradeHabitat,
  upgradePet,
} from './game';

const T0 = new Date(2026, 9, 27, 12).getTime();
const DAY = 86400000;

describe('rewards', () => {
  it('first clear of level 1 grants a common egg; replay pays half, no egg, no double stars', () => {
    let s = newSave(T0);
    const lv = generateLevel(1);
    const r = levelReward(s, lv, 3);
    expect(r.egg).toBe('common');
    s = applyLevelComplete(s, lv, r, 2, false);
    expect(s.eggs.common).toBe(1);
    expect(s.stars).toBe(3);
    const r2 = levelReward(s, lv, 3);
    expect(r2.egg).toBeNull();
    expect(r2.coins).toBeLessThan(r.coins);
    expect(applyLevelComplete(s, lv, r2, 2, false).stars).toBe(3);
  });

  it('doubling via ad doubles coins', () => {
    const s = newSave(T0);
    const lv = generateLevel(1);
    const r = levelReward(s, lv, 2);
    expect(applyLevelComplete(s, lv, r, 0, true).coins - s.coins).toBe(r.coins * 2);
  });
});

describe('eggs and pets', () => {
  it('opens eggs, converts duplicates to hearts, refuses with no eggs', () => {
    let s = { ...newSave(T0), eggs: { common: 200, rare: 0, epic: 0 } };
    const rng = mulberry32(1);
    let dupes = 0;
    for (let i = 0; i < 100; i++) {
      const o = openEgg(s, 'common', rng)!;
      s = o.save;
      if (o.result.duplicate) {
        dupes++;
        expect(o.result.hearts).toBeGreaterThan(0);
      }
    }
    expect(dupes).toBeGreaterThan(50);
    expect(s.hearts).toBeGreaterThan(0);
    expect(openEgg(newSave(T0), 'common', rng)).toBeNull();
  });

  it('first egg is always a placeable cat', () => {
    const s = { ...newSave(T0), eggs: { common: 1, rare: 0, epic: 0 } };
    const o = openEgg(s, 'common', mulberry32(99))!;
    expect(o.result.pet.id).toBe('whiskers');
    expect('error' in (placePet(o.save, 'whiskers') as object)).toBe(false);
  });

  it('places pets only in unlocked habitats with room; upgrades with hearts', () => {
    let s = { ...newSave(T0), pets: { whiskers: { level: 1, count: 1 }, biscuit: { level: 1, count: 1 } }, hearts: 10 };
    expect('error' in (placePet(s, 'biscuit') as object)).toBe(true); // Dog Park locked
    const placed = placePet(s, 'whiskers');
    expect('error' in placed).toBe(false);
    s = placed as typeof s;
    expect(s.placed.whiskers).toBe('cottage');
    const up = upgradePet(s, 'whiskers')!;
    expect(up.pets.whiskers.level).toBe(2);
    expect(up.hearts).toBe(5);
  });
});

describe('habitats', () => {
  it('unlocks by stars, upgrades for coins+materials, produces coins over time', () => {
    let s = { ...newSave(T0), stars: 3 };
    expect(unlockHabitat(newSave(T0), 'park', T0)).toBeNull();
    s = unlockHabitat(s, 'park', T0)!;
    expect(s.habitats.park.unlocked).toBe(true);
    s = { ...s, coins: 1000, materials: 50, pets: { whiskers: { level: 1, count: 1 } }, placed: { whiskers: 'cottage' } };
    s = upgradeHabitat(s, 'cottage', T0)!;
    expect(s.habitats.cottage.level).toBe(1);
    expect(s.coins).toBe(850);
    expect(pendingProduction(s, 'cottage', T0 + 30 * 60000)).toBeGreaterThan(0);
    expect(upgradeHabitat({ ...s, coins: 0 }, 'cottage', T0)).toBeNull();
  });
});

describe('daily systems', () => {
  it('streak advances daily, forgives one missed day, resets after two', () => {
    let s = newSave(T0);
    for (let d = 0; d < 3; d++) s = claimDaily(s, T0 + d * DAY)!;
    expect(s.daily.streak).toBe(3);
    expect(claimDaily(s, T0 + 2 * DAY)).toBeNull();
    expect(dailyStatus(s, T0 + 4 * DAY).streak).toBe(3);
    expect(dailyStatus(s, T0 + 6 * DAY).streak).toBe(0);
  });

  it('day 7 gives an epic egg', () => {
    let s = newSave(T0);
    for (let d = 0; d < 7; d++) s = claimDaily(s, T0 + d * DAY)!;
    expect(s.eggs.epic).toBe(1);
  });

  it('tasks: 3 distinct per day, claimable, bonus after all claimed', () => {
    let s = ensureDailyTasks(newSave(T0), T0);
    expect(s.tasks.list.length).toBe(3);
    expect(new Set(s.tasks.list.map((t) => t.kind)).size).toBe(3);
    s = { ...s, tasks: { ...s.tasks, list: s.tasks.list.map((t) => ({ ...t, progress: t.target })) } };
    expect(claimTaskBonus(s)).toBeNull();
    for (const t of s.tasks.list) s = claimTask(s, t.id)!;
    expect(claimTaskBonus(s)!.eggs.common).toBe(1);
  });

  it('feeding is once per pet per day', () => {
    const s = { ...newSave(T0), pets: { pip: { level: 1, count: 1 } } };
    const f = feedPet(s, 'pip', T0)!;
    expect(feedPet(f, 'pip', T0)).toBeNull();
    expect(feedPet(f, 'pip', T0 + DAY)).not.toBeNull();
  });
});

describe('shop and player level', () => {
  it('buys only when affordable', () => {
    const s = newSave(T0);
    expect(buyItem({ ...s, coins: 0 }, 'undo')).toBeNull();
    expect(buyItem({ ...s, coins: 100 }, 'undo')!.boosters.undo).toBe(4);
  });
  it('levels up from xp', () => {
    expect(playerLevel(0).level).toBe(1);
    expect(playerLevel(1000).level).toBeGreaterThan(3);
  });
});
