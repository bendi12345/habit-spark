import { describe, expect, it } from "vitest";
import { BREATHING_EXERCISE_SECONDS, breathingCue } from "./relapse-support";

describe("relapse support breathing guide", () => {
  it("uses a gentle four-second inhale and six-second exhale cycle", () => {
    expect(breathingCue(0)).toBe("inhale");
    expect(breathingCue(3.9)).toBe("inhale");
    expect(breathingCue(4)).toBe("exhale");
    expect(breathingCue(9)).toBe("exhale");
    expect(breathingCue(10)).toBe("inhale");
    expect(breathingCue(-1)).toBe("exhale");
  });

  it("keeps the guided exercise to one minute", () => {
    expect(BREATHING_EXERCISE_SECONDS).toBe(60);
  });
});
