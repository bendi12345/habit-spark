import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { proofTypeForDifficulty } from "./path-generation";
import {
  clearDemoProofs,
  parseDemoProofs,
  readDemoProofs,
  removeDemoProof,
  writeDemoProofs,
} from "./field-proof";

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

describe("personal field proof", () => {
  it("uses honor, reflection, and photo requirements at the personal difficulty thresholds", () => {
    expect([1, 2, 3].map(proofTypeForDifficulty)).toEqual(["honor", "honor", "honor"]);
    expect([4, 5, 6, 7].map(proofTypeForDifficulty)).toEqual([
      "reflection",
      "reflection",
      "reflection",
      "reflection",
    ]);
    expect([8, 9, 10].map(proofTypeForDifficulty)).toEqual(["photo", "photo", "photo"]);
  });

  it("persists proof submissions only in local demo storage and supports removing/resetting them", () => {
    const storage = createStorage();
    const proofs = [
      {
        position: 2,
        type: "honor" as const,
        value: "simulated",
        submittedAt: "2026-10-08T00:00:00Z",
      },
      {
        position: 4,
        type: "reflection" as const,
        value: "A private sample reflection",
        submittedAt: "2026-10-08T00:00:00Z",
      },
      {
        position: 6,
        type: "photo" as const,
        value: "sample.jpg",
        submittedAt: "2026-10-08T00:00:00Z",
      },
    ];
    writeDemoProofs(storage, proofs);
    expect(readDemoProofs(storage)).toEqual(proofs);
    expect(removeDemoProof(proofs, 4)).toEqual([proofs[0], proofs[2]]);
    clearDemoProofs(storage);
    expect(readDemoProofs(storage)).toEqual([]);
  });

  it("rejects malformed or out-of-range persisted proof data", () => {
    expect(
      parseDemoProofs([
        { position: 1, type: "honor", value: "ok", submittedAt: "2026-10-08T00:00:00Z" },
        { position: 101, type: "photo", value: "sample.jpg", submittedAt: "2026-10-08T00:00:00Z" },
        { position: 2, type: "accepted", value: "forged", submittedAt: "2026-10-08T00:00:00Z" },
      ]),
    ).toHaveLength(1);
  });

  it("defines owner-only proof rows and private owner-folder storage in the migration", () => {
    const migration = readFileSync("drizzle/migrations/0008_field_proofs.sql", "utf8");
    expect(migration).toMatch(/ALTER TABLE public\.field_proofs ENABLE ROW LEVEL SECURITY/i);
    expect(migration).toMatch(/auth\.uid\(\)\s*=\s*user_id/i);
    expect(migration).toMatch(/VALUES\s*\(\s*'field-proofs'\s*,\s*'field-proofs'\s*,\s*false/i);
    expect(migration).toMatch(/bucket_id\s*=\s*'field-proofs'/i);
    expect(migration).toMatch(/storage\.foldername\(name\)\)\[1\]\s*=\s*auth\.uid\(\)::text/i);
    expect(migration).toMatch(/status\s*=\s*'accepted'/i);
    expect(migration).toMatch(/BEFORE INSERT ON public\.challenge_attempts/i);
    expect(migration).not.toMatch(
      /GRANT\s+(?:ALL|UPDATE|DELETE).*field_proofs\s+TO\s+authenticated/i,
    );
  });

  it("keeps the preview local-only and stores only a selected photo filename", () => {
    const demoRoute = readFileSync("src/routes/demo.tsx", "utf8");
    expect(demoRoute).not.toMatch(/@\/integrations\/supabase|@\/lib\/.*functions/);
    expect(demoRoute).toContain("event.target.files?.[0]?.name");
    expect(demoRoute).not.toContain(".storage.from(");
  });
});
