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
