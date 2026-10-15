import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, Flame, Heart, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseQuestionnaire } from "@/lib/questionnaire";
import { breathingCue, BREATHING_EXERCISE_SECONDS } from "@/lib/relapse-support";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Főoldal – Szokásváltó" }] }),
  component: Home,
});

const encouragements = [
  "Nem kell tökéletesnek lenned. Elég, ha ma teszel egy apró lépést.",
  "Minden próbálkozásból tanulsz valamit magadról.",
  "A saját tempód is jó tempó. Haladj úgy, ahogy ma belefér.",
  "A változás nem egyetlen nagy döntés, hanem sok kis újrakezdés.",
  "A nehéz napok nem törlik el azt, amit már elértél.",
  "Légy olyan türelmes magaddal, mint egy jó baráttal lennél.",
  "Ma csak a következő lépésre figyelj. Az is számít.",
];

function Home() {
  const { user } = Route.useRouteContext();
  const [supportOpen, setSupportOpen] = useState(false);
  const [breathingSeconds, setBreathingSeconds] = useState<number | null>(null);
  const [breathingDone, setBreathingDone] = useState(false);
  const habits = useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("habits").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const habit = habits.data?.[0];
  const fields = useQuery({
    queryKey: ["current-field", habit?.id, habit?.current_position],
    enabled: !!habit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fields")
        .select("*")
        .eq("habit_id", habit!.id)
        .eq("position", habit!.current_position)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("xp, szikra, onboarding_answers")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const streak = useQuery({
    queryKey: ["streak", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("user_streak", { _u: user.id });
      if (error) throw error;
      return data;
    },
  });
  const completedFields = useQuery({
    queryKey: ["completed-field-count", user.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("challenge_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("outcome", "completed");
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (breathingSeconds === null) return;
    if (breathingSeconds === 0) {
      setBreathingSeconds(null);
      setBreathingDone(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setBreathingSeconds((remaining) => (remaining === null ? null : Math.max(0, remaining - 1)));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [breathingSeconds]);

  const day = new Date().toISOString().slice(0, 10);
  const dayIndex =
    [...day].reduce((sum, char) => sum + char.charCodeAt(0), 0) % encouragements.length;
  const encouragement = encouragements[dayIndex];
  const questionnaire = parseQuestionnaire(profile.data?.onboarding_answers);

  if (habits.isLoading || profile.isLoading) {
    return <main className="p-8 text-center text-muted-foreground">Betöltés…</main>;
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-5 pb-28 pt-8 lg:pb-10">
      <header>
        <p className="font-display text-sm font-semibold text-primary">SZOKÁSVÁLTÓ</p>
        <h1 className="mt-1 text-3xl font-bold">
          Szia
          {user.user_metadata["full_name"]
            ? `, ${String(user.user_metadata["full_name"]).split(" ")[0]}`
            : ""}
          !
        </h1>
      </header>

      {(habits.error || profile.error || fields.error || streak.error || completedFields.error) && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"
        >
          Nem sikerült betölteni az összes adatot. Ellenőrizd a kapcsolatot, majd frissítsd az
          oldalt.
        </p>
      )}

      <section className="grid grid-cols-3 gap-3">
        <Stat
          icon={<Flame className="size-4 text-checkpoint" />}
          label="Sorozat"
          value={`${streak.data ?? 0} nap`}
        />
        <Stat
          icon={<Sparkles className="size-4 text-primary" />}
          label="Szikra"
          value={`${profile.data?.szikra ?? 0}`}
        />
        <Stat
          icon={<span className="text-xs font-bold text-primary">XP</span>}
          label="Szint"
          value={`${Math.floor((profile.data?.xp ?? 0) / 200) + 1}`}
        />
      </section>

      <section className="rounded-3xl border bg-card p-5">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="size-5" />
          <h2 className="font-semibold">Mai bátorítás</h2>
        </div>
        <p className="mt-3 text-lg leading-relaxed">{encouragement}</p>
      </section>

      <section className="rounded-3xl border border-primary/30 bg-primary/5 p-5">
        <button
          type="button"
          aria-expanded={supportOpen}
          aria-controls="relapse-support"
          onClick={() => setSupportOpen((open) => !open)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-center font-semibold text-primary-foreground"
        >
          <Heart className="size-5" />
          Mindjárt visszaesem
        </button>
        {supportOpen && (
          <div id="relapse-support" className="mt-5 space-y-4" aria-live="polite">
            <div>
              <h2 className="text-lg font-semibold">Álljunk meg egy pillanatra.</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Nem kell most mindent eldöntened. A késztetés változhat; elég a következő percet
                végigkísérned.
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <h3 className="font-semibold">Egy perc nyugodt légzés</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Lélegezz be kényelmesen 4 számolásig, majd fújd ki lassan 6 számolásig. Ne erőltesd.
              </p>
              {breathingSeconds !== null ? (
                <div className="mt-4 text-center">
                  <div
                    className="mx-auto grid size-20 place-items-center rounded-full bg-primary/15 text-primary motion-safe:animate-pulse motion-reduce:animate-none"
                    aria-hidden="true"
                  >
                    <span className="text-2xl">•</span>
                  </div>
                  <p className="mt-3 font-semibold">
                    {breathingCue(BREATHING_EXERCISE_SECONDS - breathingSeconds) === "inhale"
                      ? "Lélegezz be finoman"
                      : "Lélegezz ki lassan"}
                  </p>
                  <p className="text-sm text-muted-foreground">{breathingSeconds} mp</p>
                  <button
                    type="button"
                    onClick={() => setBreathingSeconds(null)}
                    className="mt-2 text-sm underline"
                  >
                    Most befejezem
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setBreathingDone(false);
                    setBreathingSeconds(BREATHING_EXERCISE_SECONDS);
                  }}
                  className="mt-3 rounded-xl border px-4 py-2 font-semibold"
                >
                  {breathingDone ? "Légzés újrakezdése" : "Légzés indítása · 1 perc"}
                </button>
              )}
              {breathingDone && (
                <p className="mt-2 text-sm text-primary">
                  Végigcsináltad ezt az egy percet. Ez is számít.
                </p>
              )}
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <h3 className="font-semibold">Válassz egy apró késleltetést</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Várj tíz percet, mielőtt döntesz; állíts be egy emlékeztetőt.</li>
                <li>Menj át egy másik helyiségbe, vagy sétálj egy rövidet.</li>
                <li>Igyál egy pohár vizet, és írj valakinek, akiben megbízol.</li>
              </ul>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <h3 className="font-semibold">Amit már megtettél</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Eddig {completedFields.data ?? 0} feladatot teljesítettél, és {streak.data ?? 0}{" "}
                napos sorozatod van. A legutóbbi mentett ellenőrzőpontod:{" "}
                {habit?.last_checkpoint ?? 0}. Egy nehéz pillanat nem törli el ezt.
              </p>
            </div>
            <Link
              to="/coach"
              className="flex items-center justify-center gap-2 rounded-xl border bg-card px-4 py-3 font-semibold"
            >
              Beszélgetés a coachcsal <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </section>

      {!questionnaire.completed && (
        <section className="rounded-3xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="font-semibold">Hangoljuk hozzád az utadat</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A rövid, menthető kérdőív segít a saját helyzetedhez igazítani a kihívásokat.
          </p>
          <Link
            to="/questionnaire"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
          >
            {Object.keys(questionnaire.answers).length ? "Kérdőív folytatása" : "Kérdőív kitöltése"}{" "}
            <ArrowRight className="size-4" />
          </Link>
        </section>
      )}

      {habit && fields.data ? (
        <section className="rounded-3xl border border-primary/30 bg-primary/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Mai következő lépés · {habit.emoji} {habit.name}
          </p>
          <h2 className="mt-2 text-xl font-bold">{fields.data.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{fields.data.description}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Személyes nehézség: {fields.data.difficulty}/10
          </p>
          <Link
            to="/map"
            search={{ h: habit.id }}
            className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
          >
            Megnézem az utat <ArrowRight className="size-4" />
          </Link>
        </section>
      ) : habits.data?.length === 0 ? (
        <section className="rounded-3xl border bg-card p-6 text-center">
          <h2 className="text-xl font-bold">Kezdj egy apró lépéssel</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Írd le a saját szavaiddal, min szeretnél változtatni.
          </p>
          <Link
            to="/onboarding"
            className="mt-4 inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground"
          >
            Új szokás hozzáadása
          </Link>
        </section>
      ) : null}
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3 text-center">
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 font-display text-lg font-bold">{value}</p>
    </div>
  );
}
