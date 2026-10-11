import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SAFETY =
  "Be warm and kind. Never shame or guilt-trip. Never suggest pain-based, shock-based, risky, or money-related ideas. Write in English.";

/** Starter prompts for the letter to the future self. The user always writes the letter themselves. */
export const suggestLetterPrompts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { aiJson, AiError } = await import("./ai-gateway.server");
    const { data: habits } = await context.supabase.from("habits").select("name, goal").limit(3);
    try {
      const r = await aiJson<{ prompts: string[] }>({
        system: `You help someone start a short letter to their future self about why they are changing a habit. Return 4 short open questions (max 14 words each) they can answer in their own words. Do not write the letter. ${SAFETY}`,
        user: JSON.stringify({ habits: habits ?? [] }),
        schemaName: "prompts",
        schema: { type: "object", additionalProperties: false, required: ["prompts"], properties: { prompts: { type: "array", items: { type: "string" } } } },
      });
      return { prompts: r.prompts.slice(0, 4).map((p) => p.slice(0, 140)) };
    } catch (e) {
      return { error: e instanceof AiError ? e.message : "Couldn't load ideas right now." };
    }
  });

const CATS = ["movement", "creative", "social", "calming", "useful"] as const;

/** Suggests replacement activities from questionnaire answers and the existing list. */
export const suggestActivities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ existing: z.array(z.string().max(80)).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { aiJson, AiError } = await import("./ai-gateway.server");
    const [{ data: profile }, { data: habits }] = await Promise.all([
      context.supabase.from("profiles").select("onboarding_answers").eq("id", context.userId).maybeSingle(),
      context.supabase.from("habits").select("name, goal").limit(3),
    ]);
    try {
      const r = await aiJson<{ items: { name: string; minutes: number; category: (typeof CATS)[number] }[] }>({
        system: `Suggest 5 simple, safe things this person can do instead of their habit when a craving hits. Use their questionnaire answers and interests. Each has a short name (max 6 words), duration in minutes (1-30), and a category. Avoid duplicates of their existing list. ${SAFETY}`,
        user: JSON.stringify({ habits, answers: profile?.onboarding_answers ?? {}, existing: data.existing }),
        schemaName: "activities",
        schema: {
          type: "object", additionalProperties: false, required: ["items"],
          properties: { items: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "minutes", "category"],
            properties: { name: { type: "string" }, minutes: { type: "integer" }, category: { type: "string", enum: [...CATS] } } } } },
        },
      });
      return { items: r.items.slice(0, 5).map((i) => ({ name: i.name.slice(0, 80), minutes: Math.min(30, Math.max(1, i.minutes)), category: i.category })) };
    } catch (e) {
      return { error: e instanceof AiError ? e.message : "Couldn't load ideas right now." };
    }
  });
