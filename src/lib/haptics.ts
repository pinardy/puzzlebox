/** A short tick on every move. Boards feel a lot more physical on a phone
 *  with it, and it costs nothing offline. Desktop has no vibrator, so this
 *  quietly does nothing there rather than being a setting that lies. */

import { load, save } from "./storage";

export function hapticsEnabled(): boolean {
  return load("pref:haptics", true);
}

export function setHapticsEnabled(on: boolean): void {
  save("pref:haptics", on);
}

export function tick(): void {
  if (!hapticsEnabled()) return;
  try {
    navigator.vibrate?.(8);
  } catch {
    /* no haptics available */
  }
}
