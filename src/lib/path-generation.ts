export function targetDifficulty(position: number, intensity: number): number {
  const block = Math.floor((position - 1) / 5);
  const step = (position - 1) % 5;
  const base = Math.min(6, 1 + Math.floor(block / 2) + (intensity - 2));
  return Math.max(1, Math.min(10, base + step));
}

export function proofTypeForDifficulty(
  difficulty: number,
): "honor" | "reflection" | "photo" {
  if (difficulty <= 3) return "honor";
  if (difficulty <= 7) return "reflection";
  return "photo";
}

/** Same sawtooth as targetDifficulty, with the block base moved by a personal shift. */
export function personalDifficulty(position: number, intensity: number, shift: number): number {
  const block = Math.floor((position - 1) / 5);
  const step = (position - 1) % 5;
  const base = Math.max(1, Math.min(6, 1 + Math.floor(block / 2) + (intensity - 2) + shift));
  return Math.max(1, Math.min(10, base + step));
}

export type RatingSample = { planned: number; rating: number; outcome: "completed" | "failed" };

/** Negative shift = upcoming steps get gentler; positive = a bit more stretch. */
export function computeShift(samples: RatingSample[]): number {
  if (samples.length === 0) return 0;
  const recent = samples.slice(-10);
  const gap = recent.reduce((s, r) => s + (r.rating - r.planned), 0) / recent.length;
  const failRate = recent.filter((r) => r.outcome === "failed").length / recent.length;
  let shift = -Math.round(gap / 2);
  if (failRate >= 0.5) shift -= 1;
  return Math.max(-3, Math.min(2, shift));
}

export const EXTEND_THRESHOLD = 5;
export const EXTEND_COUNT = 20;
