import { describe, expect, it } from "vitest";
import { proofTypeForDifficulty, targetDifficulty } from "./path-generation";

describe("personalized path difficulty", () => {
  it("increases through each block so the checkpoint is its hardest challenge", () => {
    for (const intensity of [1, 2, 3]) {
      for (let block = 0; block < 8; block += 1) {
        const difficulties = Array.from({ length: 5 }, (_, offset) =>
          targetDifficulty(block * 5 + offset + 1, intensity),
        );
        expect(difficulties[4]!).toBeGreaterThan(difficulties[0]!);
        expect(difficulties[4]!).toBe(Math.max(...difficulties));
        expect(difficulties.every((difficulty) => difficulty >= 1 && difficulty <= 10)).toBe(true);
      }
    }
  });

  it("selects stronger proof as personal difficulty increases", () => {
    expect(proofTypeForDifficulty(1)).toBe("honor");
    expect(proofTypeForDifficulty(3)).toBe("honor");
    expect(proofTypeForDifficulty(4)).toBe("reflection");
    expect(proofTypeForDifficulty(7)).toBe("reflection");
    expect(proofTypeForDifficulty(8)).toBe("photo");
    expect(proofTypeForDifficulty(10)).toBe("photo");
  });
});

import { computeShift, personalDifficulty } from "./path-generation";

describe("personal difficulty adaptation", () => {
  it("keeps every shifted block sawtooth-shaped", () => {
    for (const shift of [-3, -1, 0, 2]) {
      for (let block = 0; block < 12; block += 1) {
        const d = Array.from({ length: 5 }, (_, o) => personalDifficulty(block * 5 + o + 1, 2, shift));
        expect(d[4]!).toBe(Math.max(...d));
        expect(d[4]!).toBeGreaterThan(d[0]!);
        expect(d.every((x) => x >= 1 && x <= 10)).toBe(true);
      }
    }
  });

  it("eases up when steps feel harder than planned or fail often", () => {
    expect(computeShift([])).toBe(0);
    expect(computeShift([{ planned: 4, rating: 9, outcome: "failed" }, { planned: 5, rating: 9, outcome: "failed" }])).toBeLessThan(0);
    expect(computeShift([{ planned: 6, rating: 2, outcome: "completed" }, { planned: 6, rating: 2, outcome: "completed" }])).toBeGreaterThan(0);
  });
});
