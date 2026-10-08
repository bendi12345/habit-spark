import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { interpretHabit, generatePath, type AiField } from "@/lib/path-ai.functions";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "New habit – Habit Shift" }] }),
  component: Onboarding,
});

const INTENSITY = [
  { v: 1, label: "Gentle", desc: "Tiny steps to start" },
  { v: 2, label: "Balanced", desc: "A steady pace" },
  { v: 3, label: "Bold", desc: "I like a challenge" },
];

type Interp = { name: string; emoji: string; interpretation: string; withdrawal_risk: boolean };

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const interpret = useServerFn(interpretHabit);
  const generate = useServerFn(generatePath);
  const [step, setStep] = useState<"describe" | "clarify" | "pace" | "edit">("describe");
  const [habit, setHabit] = useState("");
  const [goal, setGoal] = useState("");
  const [answers, setAnswers] = useState<{ q: string; a: string }[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [interp, setInterp] = useState<Interp | null>(null);
  const [intensity, setIntensity] = useState(2);
  const [fields, setFields] = useState<AiField[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function runInterpret(ans: { q: string; a: string }[]) {
    setBusy("Reading your description…");
    const r = await interpret({ data: { habit, goal, answers: ans } });
    setBusy(null);
    if (!r.ok) { toast.error(r.error); return; }
    setInterp({ name: r.name, emoji: r.emoji, interpretation: r.interpretation, withdrawal_risk: r.withdrawal_risk });
    if (r.needs_clarification && r.questions.length) {
      setQuestions(r.questions); setDraft(r.questions.map(() => "")); setStep("clarify");
    } else setStep("pace");
  }

  function fullContext() {
    return habit + (answers.length ? "\n" + answers.map((x) => `${x.q} ${x.a}`).join("\n") : "");
  }

  async function runGenerate() {
    if (!interp) return;
    setBusy("Building your path…");
    const r = await generate({ data: { interpretation: interp.interpretation, habit: fullContext(), goal, intensity, withdrawal_risk: interp.withdrawal_risk } });
    setBusy(null);
    if (!r.ok) { toast.error(r.error); return; }
    setFields(r.fields); setStep("edit");
  }

  async function reroll(pos: number) {
    if (!interp) return;
    setBusy(`Rerolling field ${pos}…`);
    const r = await generate({ data: { interpretation: interp.interpretation, habit: fullContext(), goal, intensity, withdrawal_risk: interp.withdrawal_risk, reroll: { position: pos, existing: fields.map((f) => f.title) } } });
    setBusy(null);
    if (!r.ok) { toast.error(r.error); return; }
    setFields((fs) => fs.map((f) => (f.position === pos && r.fields[0] ? r.fields[0] : f)));
  }

  function edit(pos: number, patch: Partial<AiField>) {
    setFields((fs) => fs.map((f) => (f.position === pos ? { ...f, ...patch } : f)));
  }

  async function save() {
    if (!interp) return;
    setBusy("Saving…");
    const { data: h, error } = await supabase.from("habits")
      .insert({ habit_key: "custom", name: interp.name, emoji: interp.emoji, goal: goal || null, intensity, free_text: fullContext(), ai_interpretation: interp.interpretation })
      .select().single();
    if (error || !h) { setBusy(null); toast.error("Couldn't create the habit"); return; }
    const rows = fields.map((f) => ({ ...f, habit_id: h.id, status: f.position === 1 ? "current" : "locked" }));
    const { error: e2 } = await supabase.from("fields").insert(rows);
    setBusy(null);
    if (e2) { toast.error("Couldn't save the path"); return; }
    await qc.invalidateQueries({ queryKey: ["habits"] });
    navigate({ to: "/map", search: { h: h.id } });
  }

  const primary = "w-full rounded-2xl bg-primary py-4 font-display text-lg font-semibold text-primary-foreground disabled:opacity-40";
  const card = (on: boolean) => `w-full rounded-2xl border p-4 text-left transition ${on ? "border-primary bg-primary/10" : "bg-card"}`;

  return (
    <main className="mx-auto max-w-md px-5 pb-28 pt-8">
      {busy && <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur"><p className="animate-pulse font-display text-xl text-primary">{busy}</p></div>}

      {step === "describe" && (
        <>
          <h1 className="text-3xl font-bold">What do you want to change?</h1>
          <p className="mt-2 text-muted-foreground">Describe it in your own words — there's no wrong answer.</p>
          <textarea value={habit} onChange={(e) => setHabit(e.target.value)} rows={4} placeholder="e.g. I scroll TikTok until midnight and don't get enough sleep"
            className="mt-6 w-full rounded-2xl border bg-input/30 p-4" />
          <h2 className="mt-6 text-lg font-semibold">Your goal</h2>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} placeholder="e.g. Be in bed with my phone away by 11pm"
            className="mt-2 w-full rounded-2xl border bg-input/30 p-4" />
          <button disabled={habit.trim().length < 3} onClick={() => runInterpret([])} className={`mt-6 ${primary}`}>Continue</button>
        </>
      )}

      {step === "clarify" && (
        <>
          <h1 className="text-3xl font-bold">Quick question{questions.length > 1 ? "s" : ""}</h1>
          <p className="mt-2 text-muted-foreground">This helps tailor your path.</p>
          <div className="mt-6 space-y-4">
            {questions.map((q, i) => (
              <div key={i}>
                <p className="rounded-2xl rounded-bl-sm bg-card p-3 text-sm">{q}</p>
                <input value={draft[i]} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? e.target.value : x)))}
                  className="mt-2 w-full rounded-xl border bg-input/30 px-4 py-3" placeholder="Your answer" />
              </div>
            ))}
          </div>
          <button disabled={draft.some((d) => !d.trim())} onClick={() => {
            const next = [...answers, ...questions.map((q, i) => ({ q, a: draft[i] ?? "" }))];
            setAnswers(next); runInterpret(next);
          }} className={`mt-6 ${primary}`}>Continue</button>
        </>
      )}

      {step === "pace" && interp && (
        <>
          <p className="text-4xl">{interp.emoji}</p>
          <h1 className="mt-2 text-3xl font-bold">{interp.name}</h1>
          <p className="mt-2 text-muted-foreground">{interp.interpretation}</p>
          {interp.withdrawal_risk && (
            <p className="mt-4 rounded-2xl border border-checkpoint/40 bg-checkpoint/10 p-4 text-sm">
              Stopping this suddenly can affect your body. Please talk to a doctor or professional — your path will start gradually.
            </p>
          )}
          <h2 className="mt-6 text-lg font-semibold">What pace suits you?</h2>
          <div className="mt-3 space-y-3">
            {INTENSITY.map((i) => (
              <button key={i.v} onClick={() => setIntensity(i.v)} className={card(intensity === i.v)}>
                <span className="font-display text-lg font-semibold">{i.label}</span>
                <p className="text-sm text-muted-foreground">{i.desc}</p>
              </button>
            ))}
          </div>
          <button onClick={runGenerate} className={`mt-6 ${primary}`}>Generate my path</button>
        </>
      )}

      {step === "edit" && (
        <>
          <h1 className="text-3xl font-bold">Your first 40 fields</h1>
          <p className="mt-2 text-muted-foreground">Edit anything, reroll a single field, or regenerate the whole path.</p>
          <ol className="mt-6 space-y-3">
            {fields.map((f) => (
              <li key={f.position} className={`rounded-2xl border p-4 ${f.is_checkpoint ? "border-checkpoint/60 bg-checkpoint/10" : "bg-card"}`}>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-semibold">
                    {f.is_checkpoint && <Flag className="size-3 text-checkpoint" />}Field {f.position}{f.is_checkpoint && " · checkpoint"}
                  </span>
                  <span className="flex items-center gap-3">
                    <span>Difficulty {f.difficulty}/10</span>
                    <button onClick={() => reroll(f.position)} aria-label={`Reroll field ${f.position}`} className="text-primary"><RefreshCw className="size-4" /></button>
                  </span>
                </div>
                <input value={f.title} onChange={(e) => edit(f.position, { title: e.target.value })} className="mt-2 w-full bg-transparent font-display text-lg font-semibold outline-none" />
                <textarea value={f.description} onChange={(e) => edit(f.position, { description: e.target.value })} rows={2} className="mt-1 w-full resize-none bg-transparent text-sm text-muted-foreground outline-none" />
              </li>
            ))}
          </ol>
          <div className="sticky bottom-20 mt-6 flex gap-3">
            <button onClick={runGenerate} className="flex-1 rounded-2xl border bg-card py-4 font-semibold">Regenerate</button>
            <button disabled={fields.some((f) => !f.title.trim())} onClick={save} className="flex-[2] rounded-2xl bg-primary py-4 font-display text-lg font-semibold text-primary-foreground disabled:opacity-40">Save & start</button>
          </div>
        </>
      )}
      <BottomNav />
    </main>
  );
}
