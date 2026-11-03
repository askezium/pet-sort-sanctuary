import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { ensureDailyTasks, newSave, type Save } from './meta/game';

const KEY = 'pet-sort-sanctuary-save-v1';
let save: Save = ensureDailyTasks(newSave(Date.now()), Date.now());
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function persist() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    AsyncStorage.setItem(KEY, JSON.stringify(save)).catch(() => {});
  }, 250);
}

export async function loadSave(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Save>;
      if (parsed.v === 1) save = { ...newSave(Date.now()), ...parsed } as Save;
    }
  } catch {
    /* corrupt or unavailable storage: start fresh */
  }
  save = ensureDailyTasks(save, Date.now());
  listeners.forEach((l) => l());
}

export const getSave = () => save;

/** Applies a pure meta function. Returns false (and changes nothing) if it returned null/undefined. */
export function update(fn: (s: Save) => Save | null | undefined): boolean {
  const next = fn(save);
  if (!next) return false;
  save = next;
  listeners.forEach((l) => l());
  persist();
  return true;
}

export async function resetSave() {
  save = ensureDailyTasks(newSave(Date.now()), Date.now());
  listeners.forEach((l) => l());
  await AsyncStorage.removeItem(KEY).catch(() => {});
}

export function useSave(): Save {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => save,
  );
}
