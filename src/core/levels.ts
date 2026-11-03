import { mulberry32, randInt, shuffle, type Rng } from './rng';
import { solve } from './solver';
import { createState, isRescuable } from './sort';

export const CAPACITY = 4;
export const MAX_TYPES = 8;

export interface Level {
  id: number;
  capacity: number;
  types: number;
  board: number[][];
  /** Solver move count: finishing within this earns 3 stars. */
  par: number;
  /** Moves for 2 stars (par + 25%). */
  star2: number;
  moveLimit: number;
}

export interface LevelParams {
  types: number;
  empties: number;
  /** Extra containers the tokens are scattered over (partially filled), 0 = classic full stacks. */
  scatter: number;
}

/** Difficulty curve: types grow with level, a relief level every 7th, tighter spaces later. */
export function levelParams(n: number): LevelParams {
  let types = Math.min(MAX_TYPES, 2 + Math.floor(n / 6));
  if (n > 8 && n % 7 === 0) types = Math.max(2, types - 1); // relief level
  const empties = n >= 30 && n % 5 === 4 ? 1 : 2;
  const scatter = n >= 18 ? 1 : 0;
  return { types, empties, scatter };
}

export function moveSlack(n: number): number {
  return Math.max(1.35, 2.2 - n * 0.02);
}

function deal(types: number, p: LevelParams, rng: Rng): number[][] {
  const total = types + p.empties;
  const board: number[][] = Array.from({ length: total }, () => []);
  const tokens: number[] = [];
  for (let t = 0; t < types; t++) for (let i = 0; i < CAPACITY; i++) tokens.push(t);
  const used = types + p.scatter;
  for (const t of shuffle(tokens, rng)) {
    let c = randInt(rng, used);
    while (board[c].length >= CAPACITY) c = (c + 1) % used;
    board[c].push(t);
  }
  return board;
}

const cache = new Map<number, Level>();

/** Deterministic: the same level number always yields the same, solver-proven solvable board. */
export function generateLevel(n: number): Level {
  const hit = cache.get(n);
  if (hit) return hit;
  let params = levelParams(n);
  for (let attempt = 0; attempt < 200; attempt++) {
    if (attempt === 40) params = { ...params, empties: 2 };
    const rng = mulberry32(n * 7919 + attempt * 104729 + 17);
    const board = deal(params.types, params, rng);
    if (board.some((c) => isRescuable(c, CAPACITY))) continue;
    const sol = solve(createState(board, CAPACITY), 30000);
    if (!sol || sol.length === 0) continue;
    const par = sol.length;
    const level: Level = {
      id: n,
      capacity: CAPACITY,
      types: params.types,
      board,
      par,
      star2: Math.ceil(par * 1.25),
      moveLimit: Math.max(par + 4, Math.ceil(par * moveSlack(n))),
    };
    cache.set(n, level);
    return level;
  }
  throw new Error(`could not generate level ${n}`);
}

export function starsFor(level: Level, movesUsed: number): number {
  if (movesUsed <= level.par) return 3;
  if (movesUsed <= level.star2) return 2;
  return 1;
}
