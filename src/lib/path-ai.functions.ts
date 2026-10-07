import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AiField = { position: number; title: string; description: string; difficulty: number; is_checkpoint: boolean };

const SAFETY = `Safety rules: never generate harmful, self-punishing, shaming, pain-based, shock-based or extreme challenges (no extreme fasting, no dangerous dares, nothing involving money). Keep tone warm and encouraging. Write in English.`;

const fieldSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "difficulty"],
  properties: { title: { type: "string" }, description: { type: "string" }, difficulty: { type: "integer" } },
};

function sawtooth(pos: number, intensity: number) {
  // blocks of 5: rises within block, each block a bit higher; checkpoint = peak
  const block = Math.floor((pos - 1) / 5), step = (pos - 1) % 5;
  const base = Math.min(6, 1 + Math.floor(block / 2) + (intensity - 2));
  return Math.max(1, Math.min(10, base + step));
}

export const interpretHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ habit: z.string().min(2).max(1000), goal: z.string().max(1000), answers: z.array(z.object({ q: z.string(), a: z.string() })).max(4) }).parse(d))
  .handler(async ({ data }) => {
    const { aiJson, AiError } = await import("./ai-gateway.server");
    try {
      const r = await aiJson<{ needs_clarification: boolean; questions: string[]; name: string; emoji: string; interpretation: string; withdrawal_risk: boolean }>({
        system: `You help someone describe a habit they want to change. Interpret their free text. If it is too vague to design challenges (and fewer than 2 clarifications were already answered), set needs_clarification true and ask 1-2 short, kind questions. Otherwise false and empty questions. Give a short habit name (max 4 words), one emoji, a 1-2 sentence interpretation, and withdrawal_risk true if it involves alcohol, drugs, benzodiazepines, opioids or other substances with medical withdrawal risk. ${SAFETY}`,
        user: JSON.stringify(data),
        schemaName: "interpretation",
        schema: { type: "object", additionalProperties: false, required: ["needs_clarification", "questions", "name", "emoji", "interpretation", "withdrawal_risk"],
          properties: { needs_clarification: { type: "boolean" }, questions: { type: "array", items: { type: "string" } }, name: { type: "string" }, emoji: { type: "string" }, interpretation: { type: "string" }, withdrawal_risk: { type: "boolean" } } },
      });
      if (data.answers.length >= 2) r.needs_clarification = false;
      r.questions = r.questions.slice(0, 2);
      return { ok: true as const, ...r };
    } catch (e) {
      return { ok: false as const, error: e instanceof AiError ? e.message : "Something went wrong." };
    }
  });

const genInput = z.object({
  interpretation: z.string().max(2000), habit: z.string().max(1000), goal: z.string().max(1000),
  intensity: z.number().int().min(1).max(3), withdrawal_risk: z.boolean(),
  reroll: z.object({ position: z.number().int().min(1).max(40), existing: z.array(z.string()).max(40) }).optional(),
});

export const generatePath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => genInput.parse(d))
  .handler(async ({ data }) => {
    const { aiJson, AiError } = await import("./ai-gateway.server");
    const positions = data.reroll ? [data.reroll.position] : Array.from({ length: 40 }, (_, i) => i + 1);
    const targets = positions.map((p) => ({ position: p, difficulty: sawtooth(p, data.intensity), checkpoint: p % 5 === 0 }));
    try {
      const r = await aiJson<{ fields: { title: string; description: string; difficulty: number }[] }>({
        system: `You design a gamified path of challenges to help someone change a habit. Produce exactly ${targets.length} field(s), in order, matching the given target difficulties (1-10). Every 5th field is a checkpoint: make it a meaningful milestone. Vary formats: abstain for X hours, replace with an activity, reflect/journal, tell a friend, change the environment, a small kind reward for yourself. Never repeat wording. Titles max 6 words; descriptions 1-2 concrete sentences.${data.withdrawal_risk ? " This habit may carry withdrawal risk: keep the first blocks very gradual (cut down, never abrupt full stop), and include a checkpoint suggesting talking to a doctor." : ""} ${SAFETY}`,
        user: JSON.stringify({ habit: data.habit, goal: data.goal, interpretation: data.interpretation, targets, avoid_duplicating: data.reroll?.existing ?? [] }),
        schemaName: "path",
        schema: { type: "object", additionalProperties: false, required: ["fields"], properties: { fields: { type: "array", items: fieldSchema } } },
      });
      const fields: AiField[] = targets.map((t, i) => {
        const f = r.fields[i];
        return {
          position: t.position,
          title: (f?.title ?? `Challenge ${t.position}`).slice(0, 80),
          description: (f?.description ?? "").slice(0, 400),
          difficulty: t.difficulty,
          is_checkpoint: t.checkpoint,
        };
      });
      return { ok: true as const, fields };
    } catch (e) {
      return { ok: false as const, error: e instanceof AiError ? e.message : "Something went wrong." };
    }
  });
