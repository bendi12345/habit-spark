import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  isQuestionAnswered,
  parseQuestionnaire,
  questionnairePrompt,
  QUESTIONNAIRE_QUESTIONS,
  type QuestionnaireAnswer,
  type QuestionnaireAnswers,
} from "@/lib/questionnaire";

export const Route = createFileRoute("/_authenticated/questionnaire")({
  head: () => ({ meta: [{ title: "Személyes kérdőív – Szokásváltó" }] }),
  component: Questionnaire,
});

function Questionnaire() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_answers")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [draft, setDraft] = useState<{
    answers: QuestionnaireAnswers;
    step: number;
    completed: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [promptVariants] = useState(() =>
    QUESTIONNAIRE_QUESTIONS.map(() => Math.floor(Math.random() * 3)),
  );

  if (profile.isLoading)
    return <main className="p-8 text-center text-muted-foreground">Betöltés…</main>;
  if (profile.isError)
    return (
      <main role="alert" className="p-8 text-center text-destructive">
        Nem sikerült betölteni a kérdőívet.
      </main>
    );

  const state = draft ?? parseQuestionnaire(profile.data?.onboarding_answers);
  const question = QUESTIONNAIRE_QUESTIONS[state.step]!;
  const answer = state.answers[question.id];
  const answered = isQuestionAnswered(question, answer);

  async function persist(next: {
    answers: QuestionnaireAnswers;
    step: number;
    completed: boolean;
  }) {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        onboarding_answers: { version: 1, ...next },
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Nem sikerült elmenteni a válaszokat. Próbáld újra.");
      return false;
    }
    setDraft(next);
    await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    return true;
  }

  function setAnswer(value: QuestionnaireAnswer) {
    setDraft({ ...state, answers: { ...state.answers, [question.id]: value } });
  }

  async function saveDraft() {
    if (await persist(state)) toast.success("A válaszaid elmentve.");
  }

  async function move(direction: -1 | 1) {
    if (direction > 0 && !answered) return;
    const nextStep = state.step + direction;
    const next = { ...state, step: nextStep, completed: false };
    if (await persist(next)) {
      if (direction > 0) toast.success("A válasz elmentve.");
    }
  }

  async function finish() {
    if (!answered) return;
    if (await persist({ ...state, completed: true }))
      toast.success("Köszönjük, a személyes válaszaidat elmentettük.");
  }

  function toggleOption(option: string) {
    const selected = Array.isArray(answer) ? answer : [];
    setAnswer(
      selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option],
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-5 pb-28 pt-8 lg:pb-10">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">SZEMÉLYRE SZABOTT TÁMOGATÁS</p>
          <h1 className="mt-1 text-3xl font-bold">Rövid kérdőív</h1>
        </div>
        <Link to="/profile" className="rounded-xl border p-3" aria-label="Vissza a profilhoz">
          <ArrowLeft className="size-5" />
        </Link>
      </header>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {QUESTIONNAIRE_QUESTIONS.length} rövid kérdés segít, hogy a saját tempódhoz és helyzetedhez
        igazítsuk az utadat. Bármikor menthetsz és később folytathatod; csak annyit ossz meg,
        amennyi kényelmes.
      </p>

      {state.completed && (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <Check className="size-5 shrink-0 text-primary" />A kérdőív már kitöltve. A válaszaidat
          bármikor módosíthatod.
        </div>
      )}

      <section className="rounded-3xl border bg-card p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {state.step + 1}. kérdés / {QUESTIONNAIRE_QUESTIONS.length}
          </span>
          <button
            type="button"
            onClick={saveDraft}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-medium disabled:opacity-50"
          >
            <Save className="size-4" /> {saving ? "Mentés…" : "Mentés"}
          </button>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((state.step + 1) / QUESTIONNAIRE_QUESTIONS.length) * 100}%` }}
          />
        </div>
        <h2 id="questionnaire-prompt" className="mt-7 text-xl font-semibold">
          {questionnairePrompt(question, promptVariants[state.step]!)}
        </h2>
        {!question.required && (
          <p className="mt-1 text-xs text-muted-foreground">Ez a kérdés kihagyható.</p>
        )}

        {question.kind === "text" && (
          <textarea
            value={typeof answer === "string" ? answer : ""}
            aria-labelledby="questionnaire-prompt"
            onChange={(event) => setAnswer(event.target.value.slice(0, 1000))}
            rows={4}
            maxLength={1000}
            placeholder="Írd le a saját szavaiddal…"
            className="mt-5 w-full rounded-2xl border bg-input/30 p-4"
          />
        )}

        {(question.kind === "single" || question.kind === "mood") && (
          <div className={`mt-5 grid gap-3 ${question.kind === "mood" ? "grid-cols-5" : ""}`}>
            {question.options?.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={answer === option}
                onClick={() => setAnswer(option)}
                className={`rounded-xl border p-3 text-left transition ${answer === option ? "border-primary bg-primary/10" : "bg-background/50"}`}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {question.kind === "multiple" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {question.options?.map((option) => {
              const selected = Array.isArray(answer) && answer.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleOption(option)}
                  className={`rounded-xl border p-3 text-left transition ${selected ? "border-primary bg-primary/10" : "bg-background/50"}`}
                >
                  {selected ? "✓ " : ""}
                  {option}
                </button>
              );
            })}
          </div>
        )}

        {question.kind === "scale" && (
          <div className="mt-6">
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from(
                { length: (question.max ?? 10) - (question.min ?? 1) + 1 },
                (_, index) => (question.min ?? 1) + index,
              ).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={answer === value}
                  onClick={() => setAnswer(value)}
                  className={`rounded-xl border py-3 font-semibold ${answer === value ? "border-primary bg-primary/10 text-primary" : "bg-background/50"}`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Kevéssé</span>
              <span>Nagyon</span>
            </div>
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            disabled={state.step === 0 || saving}
            onClick={() => move(-1)}
            className="flex-1 rounded-xl border py-3 font-semibold disabled:opacity-40"
          >
            Vissza
          </button>
          {state.step < QUESTIONNAIRE_QUESTIONS.length - 1 ? (
            <button
              type="button"
              disabled={!answered || saving}
              onClick={() => move(1)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40"
            >
              Tovább <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!answered || saving}
              onClick={finish}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40"
            >
              Befejezés <Check className="size-4" />
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
