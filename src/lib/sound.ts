import { load, save } from "./storage";

/** Tiny WebAudio synth for end-of-game feedback. No audio assets, so the
 *  fully-offline precache stays as-is. The context is created lazily on
 *  the first play, which always follows a user gesture (a move), so
 *  autoplay policies never block it. */

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    ctx = null; // no WebAudio — stay silent
  }
  return ctx;
}

export function soundEnabled(): boolean {
  return load("pref:sound", true);
}

export function setSoundEnabled(on: boolean): void {
  save("pref:sound", on);
}

/** One soft sine blip. */
function blip(ac: AudioContext, at: number, freq: number, dur: number, gain: number) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** Rising three-note jingle. */
export function playWin(): void {
  if (!soundEnabled()) return;
  const ac = context();
  if (!ac) return;
  const t = ac.currentTime;
  blip(ac, t, 523.25, 0.18, 0.12); // C5
  blip(ac, t + 0.11, 659.25, 0.18, 0.12); // E5
  blip(ac, t + 0.22, 783.99, 0.32, 0.14); // G5
}

/** Two falling notes. */
export function playLose(): void {
  if (!soundEnabled()) return;
  const ac = context();
  if (!ac) return;
  const t = ac.currentTime;
  blip(ac, t, 311.13, 0.22, 0.11); // E♭4
  blip(ac, t + 0.16, 233.08, 0.34, 0.11); // B♭3
}

/** Single soft ping for a revealed hint. */
export function playHint(): void {
  if (!soundEnabled()) return;
  const ac = context();
  if (!ac) return;
  blip(ac, ac.currentTime, 880, 0.15, 0.08); // A5
}
