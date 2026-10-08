import { describe, expect, it } from "vitest";
import {
  clearDemoDifficultyRatings,
  parseDifficultyRatings,
  readDemoDifficultyRatings,
  writeDemoDifficultyRatings,
} from "./difficulty-rating";

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

describe("difficulty ratings", () => {
  it("accepts only integer ratings from one to ten at positive field positions", () => {
    expect(parseDifficultyRatings({ 1: 1, 2: 10, 0: 3, 3: 11, 4: 2.5, bad: 4 })).toEqual({
      1: 1,
      2: 10,
    });
  });

  it("persists demo ratings locally and clears them", () => {
    const storage = createStorage();
    writeDemoDifficultyRatings(storage, { 2: 4, 9: 6 });
    expect(readDemoDifficultyRatings(storage)).toEqual({ 2: 4, 9: 6 });
    clearDemoDifficultyRatings(storage);
    expect(readDemoDifficultyRatings(storage)).toEqual({});
  });
});
