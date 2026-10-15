import { describe, expect, it } from "vitest";
import { calculateStakeCap, formatSzikra, normalizedProgressScore } from "./social";

describe("social virtual rewards", () => {
  it("caps stakes at the lower of both 20% balances and 50 Szikra", () => {
    expect(calculateStakeCap(200, 90)).toBe(18);
    expect(calculateStakeCap(1000, 1000)).toBe(50);
    expect(calculateStakeCap(9, 500)).toBe(0);
  });

  it("normalizes progress against each participant's personal difficulty", () => {
    expect(normalizedProgressScore(30, 6)).toBe(5);
    expect(normalizedProgressScore(30, 3)).toBe(10);
    expect(normalizedProgressScore(30, 0)).toBe(0);
  });

  it("labels all balances as virtual Szikra", () => {
    expect(formatSzikra(7)).toBe("7 Szikra");
  });
});
