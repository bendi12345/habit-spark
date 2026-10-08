export const BREATHING_EXERCISE_SECONDS = 60;

export function breathingCue(elapsedSeconds: number): "inhale" | "exhale" {
  const cycleSecond = ((Math.floor(elapsedSeconds) % 10) + 10) % 10;
  return cycleSecond < 4 ? "inhale" : "exhale";
}
