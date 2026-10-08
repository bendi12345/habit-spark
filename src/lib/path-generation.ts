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
