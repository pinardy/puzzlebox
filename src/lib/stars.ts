import { makeRng, shuffled } from "./rng";

export interface StarsPuzzle {
  n: number;
  stars: number; // stars per row/column/region
  regions: number[]; // cell → region id (0..n-1)
}

/** Generate a Star Battle board: first place a valid 2-star layout
 *  (2 per row/column, none touching), then carve one region around each
 *  pair of stars and flood the leftovers. The placed layout is a solution,
 *  so the puzzle is solvable by construction. */
export function generateStars(seed: string, n: number): StarsPuzzle {
  const rng = makeRng(seed);

  const placeStars = (): number[] | null => {
    const colCount = Array(n).fill(0);
    const stars: number[] = [];
    for (let r = 0; r < n; r++) {
      const prevRow = stars.filter((s) => Math.floor(s / n) === r - 1).map((s) => s % n);
      const pairs: [number, number][] = [];
      for (let c1 = 0; c1 < n; c1++)
        for (let c2 = c1 + 2; c2 < n; c2++) {
          if (colCount[c1] >= 2 || colCount[c2] >= 2) continue;
          if (prevRow.some((pc) => Math.abs(pc - c1) <= 1 || Math.abs(pc - c2) <= 1)) continue;
          pairs.push([c1, c2]);
        }
      if (!pairs.length) return null;
      const [c1, c2] = pairs[Math.floor(rng() * pairs.length)];
      stars.push(r * n + c1, r * n + c2);
      colCount[c1]++;
      colCount[c2]++;
    }
    return colCount.every((v) => v === 2) ? stars : null;
  };

  for (;;) {
    const stars = placeStars();
    if (!stars) continue;

    // Pair each star with the nearest unpaired one.
    const unpaired = new Set(stars);
    const pairs: [number, number][] = [];
    for (const s of stars) {
      if (!unpaired.has(s)) continue;
      unpaired.delete(s);
      let best = -1, bestD = Infinity;
      for (const t of unpaired) {
        const d =
          Math.abs(Math.floor(s / n) - Math.floor(t / n)) +
          Math.abs((s % n) - (t % n));
        if (d < bestD) { bestD = d; best = t; }
      }
      unpaired.delete(best);
      pairs.push([s, best]);
    }

    // Carve a connected path between each pair, avoiding other stars.
    const region = Array(n * n).fill(-1);
    const starSet = new Set(stars);
    let ok = true;
    for (let k = 0; k < pairs.length && ok; k++) {
      const [a, b] = pairs[k];
      const allowed = (i: number) =>
        region[i] === -1 && (!starSet.has(i) || i === a || i === b);
      const prev = new Map<number, number>([[a, a]]);
      const queue = [a];
      while (queue.length && !prev.has(b)) {
        const i = queue.shift()!;
        const r = Math.floor(i / n), c = i % n;
        for (const [dr, dc] of shuffled([[1, 0], [-1, 0], [0, 1], [0, -1]], rng)) {
          const rr = r + dr, cc = c + dc;
          const j = rr * n + cc;
          if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
          if (!allowed(j) || prev.has(j)) continue;
          prev.set(j, i);
          queue.push(j);
        }
      }
      if (!prev.has(b)) { ok = false; break; }
      for (let i = b; ; i = prev.get(i)!) {
        region[i] = k;
        if (i === a) break;
      }
    }
    if (!ok) continue;

    // Flood remaining cells into adjacent regions.
    let remaining = region.filter((v) => v === -1).length;
    while (remaining > 0) {
      let progress = false;
      for (const i of shuffled([...Array(n * n).keys()], rng)) {
        if (region[i] !== -1) continue;
        const r = Math.floor(i / n), c = i % n;
        const near: number[] = [];
        if (r > 0 && region[i - n] !== -1) near.push(region[i - n]);
        if (r < n - 1 && region[i + n] !== -1) near.push(region[i + n]);
        if (c > 0 && region[i - 1] !== -1) near.push(region[i - 1]);
        if (c < n - 1 && region[i + 1] !== -1) near.push(region[i + 1]);
        if (!near.length) continue;
        region[i] = near[Math.floor(rng() * near.length)];
        remaining--;
        progress = true;
      }
      if (!progress) break; // stranded (can't happen on a connected grid)
    }
    if (remaining > 0) continue;

    return { n, stars: 2, regions: region };
  }
}
