export function calculateStakeCap(balanceA: number, balanceB: number): number {
  if (balanceA < 10 || balanceB < 10) return 0;
  return Math.min(50, Math.floor(balanceA * 0.2), Math.floor(balanceB * 0.2));
}

export function normalizedProgressScore(
  difficultyPoints: number,
  personalDifficulty: number,
): number {
  if (personalDifficulty <= 0) return 0;
  return Math.round(difficultyPoints / personalDifficulty);
}

export function formatSzikra(amount: number): string {
  return `${amount} Szikra`;
}
