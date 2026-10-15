export type DifficultyRatings = Record<number, number>;

const DEMO_DIFFICULTY_RATINGS_KEY = "habit-shift-dev-demo-difficulty-ratings";

export function isDifficultyRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
}

export function parseDifficultyRatings(value: unknown): DifficultyRatings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const ratings: DifficultyRatings = {};
  for (const [rawPosition, rating] of Object.entries(value)) {
    const position = Number(rawPosition);
    if (Number.isInteger(position) && position >= 1 && isDifficultyRating(rating)) {
      ratings[position] = rating;
    }
  }
  return ratings;
}

export function readDemoDifficultyRatings(storage: Storage): DifficultyRatings {
  const saved = storage.getItem(DEMO_DIFFICULTY_RATINGS_KEY);
  if (!saved) return {};
  try {
    const parsed: unknown = JSON.parse(saved);
    const ratings = parseDifficultyRatings(parsed);
    if (Object.keys(ratings).length) return ratings;
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Object.keys(parsed).length === 0
    )
      return {};
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  storage.removeItem(DEMO_DIFFICULTY_RATINGS_KEY);
  return {};
}

export function writeDemoDifficultyRatings(storage: Storage, ratings: DifficultyRatings): void {
  storage.setItem(DEMO_DIFFICULTY_RATINGS_KEY, JSON.stringify(parseDifficultyRatings(ratings)));
}

export function clearDemoDifficultyRatings(storage: Storage): void {
  storage.removeItem(DEMO_DIFFICULTY_RATINGS_KEY);
}
