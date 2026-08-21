import { makeRng, shuffled } from "./rng";

export interface SlitherPuzzle {
  n: number; // cells per side
  clues: (number | null)[]; // per cell: boundary-edge count, or hidden
}

/** Generate a Slitherlink board: grow a blob of cells whose boundary is a
 *  single simple loop (connected, hole-free, no corner pinches), then show
 *  a subset of the per-cell boundary-edge counts. The blob's boundary is a
 *  solution, so the puzzle is solvable by construction; any valid loop
 *  matching the clues is accepted. */
export function generateSlither(seed: string, n: number): SlitherPuzzle {
  const rng = makeRng(seed);
  const inGrid = (r: number, c: number) => r >= 0 && r < n && c >= 0 && c < n;

  const validAfterAdd = (blob: Set<number>): boolean => {
    // No 2×2 block whose diagonal cells are in the blob while the other
    // two are not — that pinches the boundary into a figure-eight.
    for (let r = 0; r < n - 1; r++)
      for (let c = 0; c < n - 1; c++) {
        const a = blob.has(r * n + c), b = blob.has(r * n + c + 1);
        const d = blob.has((r + 1) * n + c), e = blob.has((r + 1) * n + c + 1);
        if ((a && e && !b && !d) || (b && d && !a && !e)) return false;
      }
    // Complement (plus the outside) stays connected — no holes.
    const out = new Set<number>();
    const stack: number[] = [];
    for (let r = 0; r < n; r++)
      for (const c of [0, n - 1]) {
        for (const i of [r * n + c, c * n + r])
          if (!blob.has(i) && !out.has(i)) { out.add(i); stack.push(i); }
      }
    while (stack.length) {
      const i = stack.pop()!;
      const r = Math.floor(i / n), c = i % n;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc;
        const j = rr * n + cc;
        if (inGrid(rr, cc) && !blob.has(j) && !out.has(j)) { out.add(j); stack.push(j); }
      }
    }
    return out.size === n * n - blob.size;
  };

  const target = Math.floor(n * n * (0.35 + rng() * 0.2));
  const blob = new Set<number>([Math.floor(rng() * n * n)]);
  for (let tries = 0; tries < 400 && blob.size < target; tries++) {
    const frontier = shuffled(
      [...blob].flatMap((i) => {
        const r = Math.floor(i / n), c = i % n;
        return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
          .filter(([rr, cc]) => inGrid(rr, cc) && !blob.has(rr * n + cc))
          .map(([rr, cc]) => rr * n + cc);
      }),
      rng
    );
    let grown = false;
    for (const cand of frontier) {
      blob.add(cand);
      if (validAfterAdd(blob)) { grown = true; break; }
      blob.delete(cand);
    }
    if (!grown) break;
  }

  const inBlob = (r: number, c: number) => inGrid(r, c) && blob.has(r * n + c);
  const clues: (number | null)[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const me = inBlob(r, c);
      let count = 0;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (me !== inBlob(r + dr, c + dc)) count++;
      clues.push(rng() < 0.62 ? count : null);
    }
  return { n, clues };
}

/** Edge marks: h[r][c] = edge above cell row r (r in 0..n, c in 0..n-1),
 *  v[r][c] = edge left of cell col c (r in 0..n-1, c in 0..n). Flattened. */
export interface EdgeState {
  h: number[]; // (n+1) * n
  v: number[]; // n * (n+1)
}

/** Do the marked lines form one closed loop that satisfies every clue? */
export function slitherSolved(p: SlitherPuzzle, edges: EdgeState): boolean {
  const { n, clues } = p;
  const hOn = (r: number, c: number) => edges.h[r * n + c] === 1;
  const vOn = (r: number, c: number) => edges.v[r * (n + 1) + c] === 1;

  // Every clue matches.
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const want = clues[r * n + c];
      if (want === null) continue;
      const got =
        (hOn(r, c) ? 1 : 0) + (hOn(r + 1, c) ? 1 : 0) +
        (vOn(r, c) ? 1 : 0) + (vOn(r, c + 1) ? 1 : 0);
      if (got !== want) return false;
    }

  // Collect line edges as vertex pairs. Vertices are (n+1)² lattice points.
  const V = n + 1;
  type Edge = [number, number];
  const lines: Edge[] = [];
  for (let r = 0; r <= n; r++)
    for (let c = 0; c < n; c++)
      if (hOn(r, c)) lines.push([r * V + c, r * V + c + 1]);
  for (let r = 0; r < n; r++)
    for (let c = 0; c <= n; c++)
      if (vOn(r, c)) lines.push([r * V + c, (r + 1) * V + c]);
  if (!lines.length) return false;

  const degree = new Map<number, number>();
  const adj = new Map<number, number[]>();
  for (const [a, b] of lines) {
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }
  for (const d of degree.values()) if (d !== 2) return false;

  // One connected loop: walking from any vertex must reach all of them.
  const start = lines[0][0];
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of adj.get(i) ?? [])
      if (!seen.has(j)) { seen.add(j); stack.push(j); }
  }
  return seen.size === degree.size;
}
