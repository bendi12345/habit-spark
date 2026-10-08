import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { targetDifficulty } from "@/lib/path-generation";

export type AiField = { position: number; title: string; description: string; difficulty: number; is_checkpoint: boolean };

const SAFETY = `Biztonsági szabályok: soha ne adj káros, önbüntető, megszégyenítő, fájdalomra vagy sokkolásra épülő, illetve szélsőséges kihívást (például szélsőséges böjtöt, veszélyes feladatot vagy pénzzel kapcsolatos kihívást). A hangnem legyen kedves és bátorító. Minden felhasználónak szánt szöveget magyarul írj.`;

const fieldSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "difficulty"],
  properties: { title: { type: "string" }, description: { type: "string" }, difficulty: { type: "integer" } },
};

export const interpretHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ habit: z.string().min(2).max(1000), goal: z.string().max(1000), answers: z.array(z.object({ q: z.string(), a: z.string() })).max(4) }).parse(d))
  .handler(async ({ data }) => {
    const { aiJson, AiError } = await import("./ai-gateway.server");
    try {
      const r = await aiJson<{ needs_clarification: boolean; questions: string[]; name: string; emoji: string; interpretation: string; withdrawal_risk: boolean }>({
        system: `Segíts valakinek megfogalmazni a szokást, amin változtatni szeretne. Értelmezd a saját szavaival leírt választ. Ha a leírás túl homályos ahhoz, hogy kihívásokat tervezz (és még kevesebb mint 2 pontosító választ adott), állítsd a needs_clarification értékét true-ra, és tegyél fel 1-2 rövid, kedves kérdést. Egyébként legyen false, a kérdések listája pedig üres. Adj rövid, legfeljebb 4 szavas magyar szokásnevet, egy emojit, 1-2 mondatos magyar értelmezést, és állítsd a withdrawal_risk értékét true-ra, ha alkoholról, kábítószerről, benzodiazepinekről, opioidokról vagy más, megvonási kockázattal járó szerről van szó. ${SAFETY}`,
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
  questionnaire: z.record(z.string().max(40), z.union([
    z.string().max(1000),
    z.array(z.string().max(200)).max(12),
    z.number().min(1).max(10),
  ])).refine((answers) => Object.keys(answers).length <= 25 && JSON.stringify(answers).length <= 5000).optional(),
  reroll: z.object({ position: z.number().int().min(1).max(40), existing: z.array(z.string()).max(40) }).optional(),
});

export const generatePath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => genInput.parse(d))
  .handler(async ({ data }) => {
    const { aiJson, AiError } = await import("./ai-gateway.server");
    const positions = data.reroll ? [data.reroll.position] : Array.from({ length: 40 }, (_, i) => i + 1);
    const targets = positions.map((p) => ({ position: p, difficulty: targetDifficulty(p, data.intensity), checkpoint: p % 5 === 0 }));
    try {
      const r = await aiJson<{ fields: { title: string; description: string; difficulty: number }[] }>({
        system: `Személyre szabott, játékos kihívásútvonalat készítesz valakinek, aki változtatni szeretne egy szokásán. Pontosan ${targets.length} feladatot adj vissza a megadott sorrendben és személyes nehézségi értékekkel (1-10); minden címet és leírást magyarul írj, angol szavak és címek nélkül. A kérdőív válaszait használd a tempó, a feladatok és az időigény személyre szabásához, de ne állíts fel diagnózist, és ne következtess többre annál, amit a felhasználó megosztott. Minden 5. feladat ellenőrzőpont és az adott ötfeladatos blokk legnehezebb VALÓDI kihívása: az ellenőrzőpont ne pusztán ünneplés vagy jelvény legyen. A megadott nehézségi értékeket ne módosítsd. Változatos feladattípusokat használj: rövid idejű tartózkodás, helyettesítő tevékenység, önreflexió vagy napló, beszélgetés egy baráttal, környezet átalakítása, apró kedves jutalom önmagadnak. Ne ismételd a megfogalmazást. A cím legfeljebb 6 szó, a leírás 1-2 konkrét magyar mondat.${data.withdrawal_risk ? " Ennél a szokásnál fennállhat megvonási kockázat: az első blokkok feladatai legyenek fokozatosak; ne javasolj hirtelen teljes abbahagyást, az ellenőrzőpont pedig finoman javasolja szakember felkeresését." : ""} ${SAFETY}`,
        user: JSON.stringify({ habit: data.habit, goal: data.goal, interpretation: data.interpretation, questionnaire: data.questionnaire ?? {}, targets, avoid_duplicating: data.reroll?.existing ?? [] }),
        schemaName: "path",
        schema: { type: "object", additionalProperties: false, required: ["fields"], properties: { fields: { type: "array", items: fieldSchema } } },
      });
      const fields: AiField[] = targets.map((t, i) => {
        const f = r.fields[i];
        return {
          position: t.position,
          title: (f?.title ?? `A következő lépés ${t.position}.`).slice(0, 80),
          description: (f?.description ?? "Tegyél ma egy apró, biztonságos lépést a célod felé.").slice(0, 400),
          difficulty: t.difficulty,
          is_checkpoint: t.checkpoint,
        };
      });
      return { ok: true as const, fields };
    } catch (e) {
      return { ok: false as const, error: e instanceof AiError ? e.message : "Something went wrong." };
    }
  });
