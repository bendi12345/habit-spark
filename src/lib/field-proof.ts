export type ProofType = "honor" | "reflection" | "photo";

export type DemoProof = {
  position: number;
  type: ProofType;
  value: string;
  submittedAt: string;
};

const DEMO_PROOFS_KEY = "habit-shift-dev-demo-proofs";

function isProofType(value: unknown): value is ProofType {
  return value === "honor" || value === "reflection" || value === "photo";
}

export function parseDemoProofs(value: unknown): DemoProof[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isDemoProof);
}

function isDemoProof(entry: unknown): entry is DemoProof {
  if (!entry || typeof entry !== "object") return false;
  const candidate = entry as Record<string, unknown>;
  return (
    typeof candidate["position"] === "number" &&
    Number.isInteger(candidate["position"]) &&
    candidate["position"] >= 1 &&
    candidate["position"] <= 100 &&
    isProofType(candidate["type"]) &&
    typeof candidate["value"] === "string" &&
    candidate["value"].length <= 2000 &&
    typeof candidate["submittedAt"] === "string" &&
    !Number.isNaN(Date.parse(candidate["submittedAt"]))
  );
}

export function readDemoProofs(storage: Storage): DemoProof[] {
  const saved = storage.getItem(DEMO_PROOFS_KEY);
  if (!saved) return [];
  try {
    const parsed: unknown = JSON.parse(saved);
    const proofs = parseDemoProofs(parsed);
    if (Array.isArray(parsed) && proofs.length === parsed.length) return proofs;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  storage.removeItem(DEMO_PROOFS_KEY);
  return [];
}

export function writeDemoProofs(storage: Storage, proofs: DemoProof[]): void {
  storage.setItem(DEMO_PROOFS_KEY, JSON.stringify(parseDemoProofs(proofs)));
}

export function clearDemoProofs(storage: Storage): void {
  storage.removeItem(DEMO_PROOFS_KEY);
}

export function removeDemoProof(proofs: DemoProof[], position: number): DemoProof[] {
  return proofs.filter((proof) => proof.position !== position);
}
