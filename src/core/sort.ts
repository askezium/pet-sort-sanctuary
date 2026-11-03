// Pure rules for the container sort puzzle. No React, no platform imports.
// A board is a list of containers; each container lists pet types bottom -> top.

export type Board = readonly (readonly number[])[];

export interface SortState {
  board: Board;
  capacity: number;
  /** Pet types rescued so far, in order. */
  rescued: readonly number[];
}

export interface Move {
  from: number;
  to: number;
}

export function createState(board: readonly (readonly number[])[], capacity: number): SortState {
  return { board: board.map((c) => c.slice()), capacity, rescued: [] };
}

export function canMove(s: SortState, from: number, to: number): boolean {
  if (from === to) return false;
  const src = s.board[from];
  const dst = s.board[to];
  if (!src || !dst || src.length === 0) return false;
  if (dst.length >= s.capacity) return false;
  if (dst.length > 0 && dst[dst.length - 1] !== src[src.length - 1]) return false;
  return true;
}

export function isRescuable(c: readonly number[], capacity: number): boolean {
  if (c.length !== capacity) return false;
  for (let i = 1; i < c.length; i++) if (c[i] !== c[0]) return false;
  return true;
}

/** Applies a move and returns a new state. Throws on an illegal move. */
export function applyMove(s: SortState, from: number, to: number): SortState {
  if (!canMove(s, from, to)) throw new Error(`illegal move ${from}->${to}`);
  const board = s.board.map((c) => c.slice());
  const token = board[from].pop() as number;
  board[to].push(token);
  let rescued = s.rescued;
  if (isRescuable(board[to], s.capacity)) {
    rescued = [...s.rescued, token];
    board[to] = [];
  }
  return { board, capacity: s.capacity, rescued };
}

/** Pet type that was rescued by the move, or -1. */
export function rescuedBy(before: SortState, after: SortState): number {
  return after.rescued.length > before.rescued.length ? after.rescued[after.rescued.length - 1] : -1;
}

export function legalMoves(s: SortState): Move[] {
  const out: Move[] = [];
  for (let f = 0; f < s.board.length; f++)
    for (let t = 0; t < s.board.length; t++) if (canMove(s, f, t)) out.push({ from: f, to: t });
  return out;
}

export function isWon(s: SortState): boolean {
  return s.board.every((c) => c.length === 0);
}

export function petsLeft(s: SortState): number {
  return s.board.reduce((n, c) => n + c.length, 0);
}

/** Pets still on the board expressed as how many are missing from a rescue-ready group. */
export function petsAwayFromRescue(s: SortState): number {
  let best = Infinity;
  for (const c of s.board) {
    if (c.length === 0) continue;
    let run = 1;
    while (run < c.length && c[c.length - 1 - run] === c[c.length - 1]) run++;
    best = Math.min(best, s.capacity - run);
  }
  return best === Infinity ? 0 : best;
}

export function isUniform(c: readonly number[]): boolean {
  for (let i = 1; i < c.length; i++) if (c[i] !== c[0]) return false;
  return true;
}

export function stateKey(s: SortState): string {
  return s.board
    .map((c) => c.join(','))
    .sort()
    .join('|');
}
