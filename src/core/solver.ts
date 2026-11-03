import { applyMove, isUniform, isWon, legalMoves, stateKey, type Move, type SortState } from './sort';

/** Estimated moves still needed: blockers sitting on wrong tokens + merges between containers. */
export function heuristic(s: SortState): number {
  let h = 0;
  const where = new Map<number, Set<number>>();
  s.board.forEach((c, ci) => {
    let p = 0;
    while (p < c.length && c[p] === c[0]) p++;
    h += c.length - p;
    for (const t of c) {
      let set = where.get(t);
      if (!set) where.set(t, (set = new Set()));
      set.add(ci);
    }
  });
  where.forEach((set) => {
    h += set.size - 1;
  });
  return h;
}

class MinHeap {
  private keys: number[] = [];
  private vals: number[] = [];
  get size() {
    return this.keys.length;
  }
  push(k: number, v: number) {
    const keys = this.keys;
    const vals = this.vals;
    let i = keys.length;
    keys.push(k);
    vals.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= k) break;
      keys[i] = keys[p];
      vals[i] = vals[p];
      i = p;
    }
    keys[i] = k;
    vals[i] = v;
  }
  pop(): number {
    const keys = this.keys;
    const vals = this.vals;
    const top = vals[0];
    const lk = keys.pop() as number;
    const lv = vals.pop() as number;
    const n = keys.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && keys[c + 1] < keys[c]) c++;
        if (keys[c] >= lk) break;
        keys[i] = keys[c];
        vals[i] = vals[c];
        i = c;
      }
      keys[i] = lk;
      vals[i] = lv;
    }
    return top;
  }
}

interface Node {
  s: SortState;
  g: number;
  parent: number;
  move: Move | null;
}

/** Weighted A*. Returns a (near-shortest) move list that wins, or null if none found within maxNodes. */
export function solve(start: SortState, maxNodes = 40000, weight = 2): Move[] | null {
  if (isWon(start)) return [];
  const nodes: Node[] = [{ s: start, g: 0, parent: -1, move: null }];
  const best = new Map<string, number>([[stateKey(start), 0]]);
  const heap = new MinHeap();
  heap.push(weight * heuristic(start), 0);
  let expanded = 0;
  while (heap.size > 0 && expanded < maxNodes) {
    const idx = heap.pop();
    const node = nodes[idx];
    expanded++;
    if (isWon(node.s)) {
      const path: Move[] = [];
      for (let i = idx; nodes[i].parent >= 0; i = nodes[i].parent) path.push(nodes[i].move as Move);
      return path.reverse();
    }
    for (const m of legalMoves(node.s)) {
      const src = node.s.board[m.from];
      const dst = node.s.board[m.to];
      // Moving a pure stack (or a lone token) into an empty container never helps.
      if (dst.length === 0 && (isUniform(src) || src.length === 1)) continue;
      const ns = applyMove(node.s, m.from, m.to);
      const k = stateKey(ns);
      const g = node.g + 1;
      const prev = best.get(k);
      if (prev !== undefined && prev <= g) continue;
      best.set(k, g);
      nodes.push({ s: ns, g, parent: idx, move: m });
      heap.push(g + weight * heuristic(ns), nodes.length - 1);
    }
  }
  return null;
}
