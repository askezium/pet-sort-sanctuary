import type { Level } from './levels';
import { starsFor } from './levels';
import { pickWeighted, shuffle, type Rng } from './rng';
import { solve } from './solver';
import {
  applyMove,
  canMove,
  createState,
  isRescuable,
  isWon,
  legalMoves,
  petsAwayFromRescue,
  rescuedBy,
  type Move,
  type SortState,
} from './sort';

export type Status = 'playing' | 'won' | 'failed';

export interface Session {
  level: Level;
  state: SortState;
  /** Previous states; moves used === history.length. */
  history: SortState[];
  moveLimit: number;
  status: Status;
  failReason?: 'moves' | 'stuck';
  /** Pet type rescued by the most recent move, or -1. */
  lastRescue: number;
  undosUsed: number;
  hintsUsed: number;
  boostersUsed: number;
  stars: number;
}

export function startSession(level: Level): Session {
  return {
    level,
    state: createState(level.board, level.capacity),
    history: [],
    moveLimit: level.moveLimit,
    status: 'playing',
    lastRescue: -1,
    undosUsed: 0,
    hintsUsed: 0,
    boostersUsed: 0,
    stars: 0,
  };
}

export const movesUsed = (s: Session) => s.history.length;
export const movesLeft = (s: Session) => Math.max(0, s.moveLimit - s.history.length);

function settle(s: Session): Session {
  if (isWon(s.state)) return { ...s, status: 'won', failReason: undefined, stars: starsFor(s.level, s.history.length) };
  if (s.history.length >= s.moveLimit) return { ...s, status: 'failed', failReason: 'moves', stars: 0 };
  if (legalMoves(s.state).length === 0) return { ...s, status: 'failed', failReason: 'stuck', stars: 0 };
  return { ...s, status: 'playing', failReason: undefined, stars: 0 };
}

export function playMove(s: Session, from: number, to: number): Session {
  if (s.status !== 'playing' || !canMove(s.state, from, to)) return s;
  const next = applyMove(s.state, from, to);
  return settle({
    ...s,
    state: next,
    history: [...s.history, s.state],
    lastRescue: rescuedBy(s.state, next),
  });
}

export function undoMove(s: Session): Session {
  if (s.history.length === 0 || s.status === 'won') return s;
  const prev = s.history[s.history.length - 1];
  return settle({
    ...s,
    state: prev,
    history: s.history.slice(0, -1),
    lastRescue: -1,
    undosUsed: s.undosUsed + 1,
  });
}

export function restartSession(s: Session): Session {
  return startSession(s.level);
}

export function addMoves(s: Session, n: number): Session {
  return settle({ ...s, moveLimit: s.moveLimit + n, boostersUsed: s.boostersUsed + 1 });
}

/** A productive next move from the current state, or null. */
export function hintMove(s: Session): Move | null {
  if (s.status !== 'playing') return null;
  const sol = solve(s.state, 8000);
  if (sol && sol.length > 0) return sol[0];
  const moves = legalMoves(s.state);
  return moves.length > 0 ? moves[0] : null;
}

/** Reshuffles every pet still on the board; retries until the result is solvable. History is cleared. */
export function shuffleSession(s: Session, rng: Rng): Session {
  if (s.status !== 'playing') return s;
  const sizes = s.state.board.map((c) => c.length);
  const tokens = s.state.board.flat();
  for (let attempt = 0; attempt < 30; attempt++) {
    const mixed = shuffle(tokens, rng);
    const board: number[][] = [];
    let k = 0;
    for (const size of sizes) {
      board.push(mixed.slice(k, k + size));
      k += size;
    }
    if (board.some((c) => isRescuable(c, s.state.capacity))) continue;
    const st: SortState = { board, capacity: s.state.capacity, rescued: s.state.rescued };
    const sol = solve(st, 12000);
    if (sol && sol.length > 0) {
      return settle({ ...s, state: st, history: s.history, boostersUsed: s.boostersUsed + 1, lastRescue: -1 });
    }
  }
  return s;
}

export { pickWeighted, petsAwayFromRescue };
