export type DemoProgress = {
  completedFields: number[];
};

const DEMO_STORAGE_KEY = "habit-shift-dev-demo-progress";

export function isDevDemoEnabled(isDev: boolean): boolean {
  return isDev;
}

export function readDemoProgress(storage: Storage): DemoProgress {
  const saved = storage.getItem(DEMO_STORAGE_KEY);
  if (!saved) return { completedFields: [] };

  try {
    const parsed: unknown = JSON.parse(saved);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "completedFields" in parsed &&
      Array.isArray(parsed.completedFields) &&
      parsed.completedFields.every(
        (field): field is number => Number.isInteger(field) && field >= 1 && field <= 100,
      )
    ) {
      return { completedFields: [...new Set(parsed.completedFields)] };
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }

  storage.removeItem(DEMO_STORAGE_KEY);
  return { completedFields: [] };
}

export function writeDemoProgress(storage: Storage, progress: DemoProgress): void {
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(progress));
}

export function clearDemoProgress(storage: Storage): void {
  storage.removeItem(DEMO_STORAGE_KEY);
}
