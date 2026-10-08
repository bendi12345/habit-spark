import { describe, expect, it } from "vitest";
import { buildWindingPath, getFieldNodeState, getWindingOffset } from "./path-map";

describe("path map presentation", () => {
  it("only unlocks the server-reported current position in sequence", () => {
    expect(getFieldNodeState(1, 1, "current")).toBe("current");
    expect(getFieldNodeState(1, 2, "completed")).toBe("completed");
    expect(getFieldNodeState(3, 2, "locked")).toBe("locked");
    expect(getFieldNodeState(2, 2, "failed")).toBe("failed");
    expect(getFieldNodeState(2, 2, "locked")).toBe("locked");
  });

  it("places nodes on a deterministic winding path within the configured width", () => {
    const offsets = Array.from({ length: 100 }, (_, index) => getWindingOffset(index + 1));
    expect(offsets).toEqual(Array.from({ length: 100 }, (_, index) => getWindingOffset(index + 1)));
    expect(Math.max(...offsets)).toBeLessThanOrEqual(74);
    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(-74);
    expect(new Set(offsets).size).toBeGreaterThan(10);
  });

  it("draws a smooth curved road between path nodes", () => {
    expect(
      buildWindingPath([
        { x: 160, y: 64 },
        { x: 220, y: 144 },
        { x: 100, y: 224 },
      ]),
    ).toBe("M 160 64 C 160 104, 220 104, 220 144 C 220 184, 100 184, 100 224");
    expect(buildWindingPath([])).toBe("");
  });
});
