import { describe, expect, it } from "vitest";
import { isCrisisMessage } from "./coach-safety";

describe("crisis message detection", () => {
  it("recognizes direct Hungarian and English self-harm statements", () => {
    expect(isCrisisMessage("Kárt akarok tenni magamban.")).toBe(true);
    expect(isCrisisMessage("I think I might hurt myself.")).toBe(true);
    expect(isCrisisMessage("Meg akarom ölni magam.")).toBe(true);
  });

  it("does not classify routine habit-change messages as crisis", () => {
    expect(isCrisisMessage("Ma este nehéz volt nem rágyújtani.")).toBe(false);
    expect(isCrisisMessage("Szeretnék újra belevágni.")).toBe(false);
  });
});
