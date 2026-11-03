import { describe, expect, it } from 'vitest';
import { generateLevel, levelParams, starsFor } from './levels';
import { mulberry32 } from './rng';
import { addMoves, hintMove, movesLeft, playMove, restartSession, shuffleSession, startSession, undoMove } from './session';
import { solve } from './solver';
import { applyMove, canMove, createState, isWon, legalMoves } from './sort';

const st = (board: number[][], cap = 4) => createState(board, cap);

describe('sort rules', () => {
  it('allows move onto empty or matching top only, within capacity', () => {
    const s = st([[0, 1], [1], [], [0, 0, 0], [1, 1, 1]]);
    expect(canMove(s, 0, 1)).toBe(true); // 1 onto 1
    expect(canMove(s, 0, 2)).toBe(true); // onto empty
    expect(canMove(s, 0, 3)).toBe(false); // 1 onto 0
    expect(canMove(s, 2, 0)).toBe(false); // empty source
    expect(canMove(s, 0, 0)).toBe(false);
    expect(canMove(st([[0], [0, 0, 0, 0]]), 0, 1)).toBe(false); // full destination
  });

  it('rescues a full uniform container and empties it', () => {
    const n = applyMove(st([[0, 0, 0], [0], []]), 1, 0);
    expect(n.board[0]).toEqual([]);
    expect(n.rescued).toEqual([0]);
  });

  it('does not mutate its input and throws on illegal moves', () => {
    const s = st([[0, 1], [1], []]);
    const snap = JSON.stringify(s);
    applyMove(s, 0, 1);
    expect(JSON.stringify(s)).toBe(snap);
    expect(() => applyMove(s, 2, 0)).toThrow();
  });

  it('detects win', () => {
    expect(isWon(st([[], []]))).toBe(true);
    expect(isWon(st([[0], []]))).toBe(false);
    expect(legalMoves(st([[], []]))).toEqual([]);
  });
});

describe('solver', () => {
  it('solves a small board and the path really wins', () => {
    const s = st([[0, 1, 0, 1], [1, 0, 1, 0], [], []]);
    const sol = solve(s)!;
    expect(sol).not.toBeNull();
    let cur = s;
    for (const m of sol) cur = applyMove(cur, m.from, m.to);
    expect(isWon(cur)).toBe(true);
  });
});

describe('level generation', () => {
  it('is deterministic', () => {
    expect(generateLevel(13).board).toEqual(generateLevel(13).board);
  });

  it('every level 1..60 is solvable, with consistent limits', () => {
    for (let n = 1; n <= 60; n++) {
      const lv = generateLevel(n);
      const sol = solve(createState(lv.board, lv.capacity), 60000);
      expect(sol, `level ${n}`).not.toBeNull();
      expect(lv.par).toBeGreaterThan(0);
      expect(lv.moveLimit).toBeGreaterThanOrEqual(lv.star2);
      expect(lv.star2).toBeGreaterThanOrEqual(lv.par);
      expect(lv.board.flat().length).toBe(lv.types * lv.capacity);
      expect(lv.board.every((c) => c.length <= lv.capacity)).toBe(true);
    }
  });

  it('difficulty trends upward on average', () => {
    const avg = (a: number, b: number) => {
      let sum = 0;
      for (let n = a; n <= b; n++) sum += generateLevel(n).par;
      return sum / (b - a + 1);
    };
    expect(avg(15, 24)).toBeGreaterThan(avg(1, 10));
    expect(avg(35, 44)).toBeGreaterThan(avg(15, 24));
    expect(levelParams(14).types).toBeLessThanOrEqual(levelParams(13).types);
  });

  it('awards stars by par', () => {
    const lv = generateLevel(5);
    expect(starsFor(lv, lv.par)).toBe(3);
    expect(starsFor(lv, lv.star2)).toBe(2);
    expect(starsFor(lv, lv.star2 + 1)).toBe(1);
  });
});

describe('session', () => {
  it('plays a level to a win with the solver path', () => {
    const lv = generateLevel(7);
    let s = startSession(lv);
    for (const m of solve(createState(lv.board, lv.capacity), 60000)!) s = playMove(s, m.from, m.to);
    expect(s.status).toBe('won');
    expect(s.stars).toBe(3);
  });

  it('undo restores state and move count; restart resets', () => {
    const s = startSession(generateLevel(2));
    const m = legalMoves(s.state)[0];
    const moved = playMove(s, m.from, m.to);
    expect(moved.history.length).toBe(1);
    const back = undoMove(moved);
    expect(back.state.board).toEqual(s.state.board);
    expect(back.history.length).toBe(0);
    expect(restartSession(moved).history.length).toBe(0);
  });

  it('fails when moves run out and recovers with extra moves', () => {
    let s = startSession({ ...generateLevel(3), moveLimit: 1 });
    const m = legalMoves(s.state)[0];
    s = playMove(s, m.from, m.to);
    expect(s.status).toBe('failed');
    expect(s.failReason).toBe('moves');
    expect(movesLeft(s)).toBe(0);
    s = addMoves(s, 5);
    expect(s.status).toBe('playing');
    expect(movesLeft(s)).toBe(5);
  });

  it('hint is a legal move; shuffle keeps pets and stays solvable', () => {
    let s = startSession(generateLevel(20));
    const h = hintMove(s)!;
    expect(canMove(s.state, h.from, h.to)).toBe(true);
    const before = s.state.board.flat().sort().join();
    s = shuffleSession(s, mulberry32(5));
    expect(s.state.board.flat().sort().join()).toBe(before);
    expect(solve(s.state, 20000)).not.toBeNull();
  });
});

describe('headless bot playtest', () => {
  it('solver-bot completes levels 1..40 within the move limit', () => {
    const failed: number[] = [];
    for (let n = 1; n <= 40; n++) {
      let s = startSession(generateLevel(n));
      for (const m of solve(s.state, 60000)!) s = playMove(s, m.from, m.to);
      if (s.status !== 'won') failed.push(n);
    }
    expect(failed).toEqual([]);
  });
});
