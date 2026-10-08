import { describe, expect, it } from "vitest";
import {
  clearDemoProgress,
  isDevDemoEnabled,
  readDemoProgress,
  writeDemoProgress,
} from "./dev-demo";

function createStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => entries.delete(key),
    setItem: (key, value) => entries.set(key, value),
  };
}

describe("development demo", () => {
  it("is available only when the caller explicitly identifies a dev build", () => {
    expect(isDevDemoEnabled(true)).toBe(true);
    expect(isDevDemoEnabled(false)).toBe(false);
  });

  it("keeps demo progress in local browser storage and supports reset", () => {
    const storage = createStorage();
    expect(readDemoProgress(storage)).toEqual({ completedFields: [] });
    writeDemoProgress(storage, { completedFields: [1, 2] });
    expect(readDemoProgress(storage)).toEqual({ completedFields: [1, 2] });
    clearDemoProgress(storage);
    expect(readDemoProgress(storage)).toEqual({ completedFields: [] });
  });

  it("discards corrupt or out-of-range local demo progress", () => {
    const storage = createStorage();
    storage.setItem("habit-shift-dev-demo-progress", '{"completedFields":[0,99]}');
    expect(readDemoProgress(storage)).toEqual({ completedFields: [] });
    expect(storage.getItem("habit-shift-dev-demo-progress")).toBeNull();
  });
});
