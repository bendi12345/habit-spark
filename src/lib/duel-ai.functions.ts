import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  difficulty: z.number().int().min(1).max(10),
  avoidTitle: z.string().max(80).optional(),
});

export const generateDuelChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { data: habits, error } = await context.supabase
      .from("habits")
      .select("name, goal, ai_interpretation, intensity")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(`Couldn't load your personal path: ${error.message}`);

    const habit = habits?.[0];
    const { aiJson } = await import("./ai-gateway.server");
    const createChallenge = (avoidTitle: string) =>
      aiJson<{ title: string; description: string }>({
        system: `Create one safe, concrete habit challenge for the signed-in participant. Personalize it to their own habit and goal. Match difficulty ${data.difficulty}/10. Keep title under 80 characters and description 1-2 sentences, maximum 500 characters. It must be achievable within the duel period, never harmful, punishing, shaming, extreme, or involve money. Write in English. This challenge must use a different title from the opponent's: ${avoidTitle || "(none provided)"}.`,
        user: JSON.stringify({
          habit: habit?.name ?? "personal growth",
          goal: habit?.goal ?? "",
          context: habit?.ai_interpretation ?? "",
          intensity: habit?.intensity ?? 2,
        }),
        schemaName: "duel_challenge",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description"],
          properties: { title: { type: "string" }, description: { type: "string" } },
        },
      });
    let result = await createChallenge(data.avoidTitle ?? "");
    if (
      data.avoidTitle &&
      result.title.trim().toLocaleLowerCase() === data.avoidTitle.trim().toLocaleLowerCase()
    ) {
      result = await createChallenge(
        `Do not repeat "${data.avoidTitle}". Choose another activity and title.`,
      );
      if (result.title.trim().toLocaleLowerCase() === data.avoidTitle.trim().toLocaleLowerCase()) {
        throw new Error("Couldn't generate a distinct duel challenge. Please try again.");
      }
    }
    return { title: result.title.slice(0, 80), description: result.description.slice(0, 500) };
  });
