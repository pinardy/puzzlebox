/** Play times are shown in three places — the win banner, the optional
 *  on-board clock, and the stats page — so the format lives here rather
 *  than being spelled out three times. */
export function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
