import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeShift, EXTEND_COUNT, EXTEND_THRESHOLD, personalDifficulty, type RatingSample } from "@/lib/path-generation";

const SAFETY = `Biztonsági szabályok: soha ne adj káros, önbüntető, megszégyenítő, fájdalomra vagy sokkolásra épülő, szélsőséges vagy pénzzel kapcsolatos kihívást. A hangnem kedves és bátorító. Minden szöveget magyarul írj.`;

const itemsSchema = {
  type: "object", additionalProperties: false, required: ["fields"],
  properties: { fields: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "description", "reason"],
    properties: { title: { type: "string" }, description: { type: "string" }, reason: { type: "string" } } } } },
};

type Supa = { from: (t: string) => any };

async function loadStats(supabase: Supa, habitId: string) {
  const [{ data: hist }, { data: attempts }] = await Promise.all([
    supabase.from("difficulty_history").select("rating, attempt_outcome, created_at, fields!inner(habit_id, difficulty)").eq("fields.habit_id", habitId).order("created_at").limit(50),
    supabase.from("challenge_attempts").select("outcome, created_at").eq("habit_id", habitId).order("created_at", { ascending: false }).limit(40),
  ]);
  const samples: RatingSample[] = (hist ?? []).map((h: any) => ({ planned: h.fields.difficulty, rating: h.rating, outcome: h.attempt_outcome }));
  const fails = (attempts ?? []).filter((a: any) => a.outcome !== "completed");
  const hour = (a: any) => new Date(a.created_at).getUTCHours() + 2; // Hungary local, approx
  return {
    samples,
    summary: {
      ratings_given: samples.length,
      avg_felt_minus_planned: samples.length ? +(samples.reduce((s, r) => s + r.rating - r.planned, 0) / samples.length).toFixed(1) : 0,
      recent_attempts: attempts?.length ?? 0,
      recent_failures: fails.length,
      evening_failures: fails.filter((a: any) => hour(a) >= 18 || hour(a) < 4).length,
      morning_failures: fails.filter((a: any) => hour(a) >= 5 && hour(a) < 12).length,
    },
  };
}

async function writeFields(habit: any, targets: { position: number; difficulty: number; checkpoint: boolean }[], summary: object, existing: string[], mode: "extend" | "rewrite") {
  const { aiJson } = await import("./ai-gateway.server");
  const r = await aiJson<{ fields: { title: string; description: string; reason: string }[] }>({
    system: `Személyre szabott kihívásútvonalat ${mode === "extend" ? "folytatsz" : "igazítasz át"} valakinek, aki változtatni szeretne egy szokásán. Pontosan ${targets.length} feladatot adj vissza a megadott sorrendben. A difficulty a felhasználó SZEMÉLYES nehézsége (1-10, a 10 neki a legnehezebb); a feladat valóban ilyen nehéz legyen neki, a statisztikái alapján. Minden 5. feladat ellenőrzőpont és a blokk legnehezebb valódi kihívása. Változatos feladattípusok, ne ismételd a korábbi címeket. Cím legfeljebb 6 szó, leírás 1-2 konkrét mondat. A reason egy rövid mondat, ami elmagyarázza a személyes értékelést, pl. "Ez neked 8/10, mert az esti órákban eddig kétszer buktál." Csak a megadott statisztikára hivatkozz, ne találj ki adatot, és soha ne szégyenítsd meg. ${SAFETY}`,
    user: JSON.stringify({ habit: habit.name, goal: habit.goal, interpretation: habit.ai_interpretation, stats: summary, targets, avoid_duplicating: existing.slice(-40) }),
    schemaName: "fields", schema: itemsSchema,
  });
  return targets.map((t, i) => ({
    title: (r.fields[i]?.title ?? `A következő lépés ${t.position}.`).slice(0, 80),
    description: (r.fields[i]?.description ?? "Tegyél ma egy apró, biztonságos lépést a célod felé.").slice(0, 400),
    difficulty_reason: (r.fields[i]?.reason ?? `Ez neked ${t.difficulty}/10.`).slice(0, 200),
  }));
}

const input = z.object({ habitId: z.string().uuid() });

export const extendPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as Supa;
    const { AiError } = await import("./ai-gateway.server");
    try {
      const { data: habit } = await supabase.from("habits").select("*").eq("id", data.habitId).maybeSingle();
      if (!habit) return { ok: false as const, error: "Habit not found." };
      const { data: fields } = await supabase.from("fields").select("position, title").eq("habit_id", habit.id).order("position");
      const last = fields?.at(-1)?.position ?? 0;
      if (last - habit.current_position > EXTEND_THRESHOLD) return { ok: true as const, added: 0 };
      const { summary } = await loadStats(supabase, habit.id);
      const targets = Array.from({ length: EXTEND_COUNT }, (_, i) => {
        const p = last + i + 1;
        return { position: p, difficulty: personalDifficulty(p, habit.intensity, habit.difficulty_shift ?? 0), checkpoint: p % 5 === 0 };
      });
      const texts = await writeFields(habit, targets, summary, (fields ?? []).map((f: any) => f.title), "extend");
      const rows = targets.map((t, i) => ({ habit_id: habit.id, position: t.position, difficulty: t.difficulty, is_checkpoint: t.checkpoint, status: "locked", ...texts[i] }));
      const { error } = await (supabase.from("fields") as any).upsert(rows, { onConflict: "habit_id,position", ignoreDuplicates: true });
      if (error) { console.error("extendPath insert", error); return { ok: false as const, error: "Couldn't save new steps." }; }
      return { ok: true as const, added: rows.length };
    } catch (e) {
      return { ok: false as const, error: e instanceof AiError ? e.message : "Something went wrong." };
    }
  });

export const recalibratePath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as Supa;
    const { AiError } = await import("./ai-gateway.server");
    try {
      const { data: habit } = await supabase.from("habits").select("*").eq("id", data.habitId).maybeSingle();
      if (!habit) return { ok: false as const, error: "Habit not found." };
      const { samples, summary } = await loadStats(supabase, habit.id);
      const shift = computeShift(samples);
      const { data: upcoming } = await supabase.from("fields").select("id, position, title, difficulty, difficulty_reason")
        .eq("habit_id", habit.id).eq("status", "locked").gt("position", habit.current_position).order("position").limit(10);
      const { data: all } = await supabase.from("fields").select("title").eq("habit_id", habit.id);
      const changed = (upcoming ?? []).filter((f: any) => f.difficulty !== personalDifficulty(f.position, habit.intensity, shift) || !f.difficulty_reason);
      await supabase.from("habits").update({ difficulty_shift: shift }).eq("id", habit.id);
      if (changed.length === 0) return { ok: true as const, shift, updated: 0 };
      const targets = changed.map((f: any) => ({ position: f.position, difficulty: personalDifficulty(f.position, habit.intensity, shift), checkpoint: f.position % 5 === 0 }));
      const texts = await writeFields(habit, targets, summary, (all ?? []).map((f: any) => f.title), "rewrite");
      for (let i = 0; i < changed.length; i++) {
        await supabase.from("fields").update({ difficulty: targets[i]!.difficulty, ...texts[i] }).eq("id", changed[i].id).eq("status", "locked");
      }
      return { ok: true as const, shift, updated: changed.length };
    } catch (e) {
      return { ok: false as const, error: e instanceof AiError ? e.message : "Something went wrong." };
    }
  });
