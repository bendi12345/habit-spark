import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Check, List, Lock, Map as MapIcon, X } from "lucide-react";
import { buildWindingPath, getFieldNodeState, getWindingOffset } from "@/lib/path-map";
import { EXTEND_THRESHOLD, proofTypeForDifficulty } from "@/lib/path-generation";
import { useServerFn } from "@tanstack/react-start";
import { extendPath, recalibratePath } from "@/lib/path-adapt.functions";

export const Route = createFileRoute("/_authenticated/map")({
  validateSearch: (s: Record<string, unknown>): { h?: string } => (typeof s["h"] === "string" ? { h: s["h"] } : {}),
  head: () => ({ meta: [{ title: "Útvonal – Habit Shift" }] }),
  component: MapPage,
});

type PathView = "map" | "list";

function MapPage() {
  const { user } = Route.useRouteContext();
  const { h } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [giveUpOpen, setGiveUpOpen] = useState(false);
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<PathView>("map");
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [ratingTarget, setRatingTarget] = useState<{ fieldId: string; position: number; outcome: "completed" | "failed" } | null>(null);
  const [difficultyRating, setDifficultyRating] = useState<number | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [proofText, setProofText] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [honorConfirmed, setHonorConfirmed] = useState(false);
  const currentRef = useRef<HTMLButtonElement>(null);
  const extendFn = useServerFn(extendPath);
  const recalibrateFn = useServerFn(recalibratePath);
  const extendTried = useRef<string>("");
  const [extending, setExtending] = useState(false);

  const habits = useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("habits").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const habit = habits.data?.find((x) => x.id === h) ?? habits.data?.[0];

  const fields = useQuery({
    queryKey: ["fields", habit?.id],
    enabled: !!habit,
    queryFn: async () => {
      const { data, error } = await supabase.from("fields").select("*").eq("habit_id", habit!.id).order("position");
      if (error) throw error;
      return data;
    },
  });
  const activeField = fields.data?.find((field) => field.position === habit?.current_position);
  const activeProof = useQuery({
    queryKey: ["field-proof", activeField?.id],
    enabled: !!activeField,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_proofs")
        .select("*")
        .eq("field_id", activeField!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!habit || !fields.data?.length) return;
    const last = fields.data[fields.data.length - 1]!.position;
    const key = `${habit.id}:${last}`;
    if (last - habit.current_position > EXTEND_THRESHOLD || extendTried.current === key) return;
    extendTried.current = key;
    setExtending(true);
    void extendFn({ data: { habitId: habit.id } }).then(async (r) => {
      setExtending(false);
      if (!r.ok) { toast.error(r.error); return; }
      if (r.added > 0) {
        toast.success(`${r.added} new steps were added to your path.`);
        await qc.invalidateQueries({ queryKey: ["fields", habit.id] });
      }
    });
  }, [habit, fields.data, extendFn, qc]);

  useEffect(() => {
    if (habits.data && habits.data.length === 0) navigate({ to: "/onboarding" });
  }, [habits.data, navigate]);

  useEffect(() => {
    if (view === "map") currentRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [view, fields.data?.length, habit?.current_position]);

  useEffect(() => {
    if (selectedPosition === -1) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPosition(-1);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedPosition]);

  if (!habit) {
    if (habits.isError) {
      return (
        <main className="p-8 text-center">
          <p className="text-destructive">Nem sikerült betölteni a szokásaidat.</p>
          <button className="mt-3 underline" onClick={() => void habits.refetch()}>Próbáld újra</button>
        </main>
      );
    }
    return <main className="p-8 text-muted-foreground">Betöltés…</main>;
  }
  if (fields.isError) {
    return (
      <main className="p-8 text-center">
        <p className="text-destructive">Nem sikerült betölteni az útvonaladat.</p>
        <button className="mt-3 underline" onClick={() => void fields.refetch()}>Próbáld újra</button>
      </main>
    );
  }

  const current = fields.data?.find((f) => f.position === habit.current_position);
  const selectedField =
    selectedPosition === -1
      ? undefined
      : selectedPosition === null
        ? current
        : fields.data?.find((field) => field.position === selectedPosition);
  const selectedState = selectedField
    ? getFieldNodeState(selectedField.position, habit.current_position, selectedField.status)
    : undefined;
  const pausedUntil = habit.paused_until ? new Date(habit.paused_until) : null;
  const paused = pausedUntil && pausedUntil > new Date();
  const emoji = habit.emoji ?? "✨";

  async function refresh() {
    await Promise.all([qc.invalidateQueries({ queryKey: ["habits"] }), qc.invalidateQueries({ queryKey: ["fields", habit!.id] })]);
  }

  async function complete() {
    if (activeProof.data?.status !== "accepted") {
      toast.error("A feladat befejezéséhez előbb elfogadott igazolás szükséges.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("complete_field", { _habit: habit!.id });
    setBusy(false);
    if (error) {
      toast.error(progressError(error.message));
      return;
    }
    const r = data as { checkpoint: boolean; position: number };
    const completedField = fields.data?.find((field) => field.position === r.position);
    if (completedField) {
      setRatingTarget({ fieldId: completedField.id, position: completedField.position, outcome: "completed" });
      setDifficultyRating(null);
    }
    setSelectedPosition(null);
    if (r.checkpoint) setCelebrate(r.position);
    else toast.success("Szép munka! Jöhet a következő feladat.");
    await refresh();
  }

  async function submitProof(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeField) return;
    const proofType = proofTypeForDifficulty(activeField.difficulty);
    let storagePath: string | null = null;
    let proofValue: string | null = null;
    if (proofType === "honor") {
      if (!honorConfirmed) {
        toast.error("Jelöld be, ha valóban teljesítetted a feladatot.");
        return;
      }
      proofValue = "I confirm that I completed this step.";
    } else if (proofType === "reflection") {
      proofValue = proofText.trim();
      if (proofValue.length < 10 || proofValue.length > 2000) {
        toast.error("Írj legalább 10, legfeljebb 2000 karakteres reflexiót.");
        return;
      }
    } else {
      if (
        !proofFile ||
        !["image/jpeg", "image/png", "image/webp"].includes(proofFile.type) ||
        proofFile.size > 10 * 1024 * 1024
      ) {
        toast.error("Válassz legfeljebb 10 MB-os JPEG, PNG vagy WebP képet.");
        return;
      }
      const extension = proofFile.type === "image/jpeg" ? "jpg" : proofFile.type.split("/")[1];
      storagePath = `${user.id}/${activeField.id}/${crypto.randomUUID()}.${extension}`;
    }

    setProofBusy(true);
    if (proofFile && storagePath) {
      const { error } = await supabase.storage
        .from("field-proofs")
        .upload(storagePath, proofFile, { contentType: proofFile.type, upsert: false });
      if (error) {
        setProofBusy(false);
        toast.error("Nem sikerült biztonságosan feltölteni a képet. Próbáld újra.");
        return;
      }
    }
    const { error } = await supabase.from("field_proofs").insert({
      field_id: activeField.id,
      user_id: user.id,
      proof_type: proofType,
      proof_text: proofValue,
      storage_path: storagePath,
      status: proofType === "honor" ? "accepted" : "pending",
    });
    setProofBusy(false);
    if (error) {
      if (storagePath) {
        const { error: cleanupError } = await supabase.storage.from("field-proofs").remove([storagePath]);
        if (cleanupError) console.error("Could not remove unreferenced failed proof upload.", cleanupError);
      }
      toast.error("Nem sikerült elmenteni az igazolást. A privát feltöltés nem lett nyilvánossá téve.");
      return;
    }
    setProofText("");
    setProofFile(null);
    setHonorConfirmed(false);
    await qc.invalidateQueries({ queryKey: ["field-proof", activeField.id] });
    toast.success(
      proofType === "honor"
        ? "Az önbevallásodat elmentettük. Most már befejezheted a feladatot."
        : "Az igazolás privát és ellenőrzésre vár. A feladat addig nem fejezhető be.",
    );
  }

  async function saveDifficultyRating() {
    if (!ratingTarget || difficultyRating === null) return;
    setRatingBusy(true);
    const { error } = await supabase.from("difficulty_history").insert({
      field_id: ratingTarget.fieldId,
      user_id: user.id,
      rating: difficultyRating,
      attempt_outcome: ratingTarget.outcome,
    });
    setRatingBusy(false);
    if (error) {
      toast.error("Nem sikerült elmenteni az értékelést. Próbáld újra.");
      return;
    }
    toast.success("Köszönjük, az értékelésed elmentettük.");
    setRatingTarget(null);
    const r = await recalibrateFn({ data: { habitId: habit!.id } });
    if (!r.ok) toast.error(r.error);
    else if (r.updated > 0) {
      toast(r.shift < 0 ? "A következő lépéseket kicsit szelídebbre igazítottuk." : "A következő lépéseket az értékeléseidhez igazítottuk.");
      await qc.invalidateQueries({ queryKey: ["fields", habit!.id] });
    }
  }

  async function fail(action: "retry" | "easier" | "pause" | "fallback") {
    setBusy(true);
    const { error } = await supabase.rpc("fail_field", { _habit: habit!.id, _action: action });
    setBusy(false);
    setGiveUpOpen(false);
    if (error) {
      toast.error(progressError(error.message));
      return;
    }
    setSelectedPosition(null);
    const attemptedField = fields.data?.find((field) => field.position === habit!.current_position);
    if (attemptedField && action !== "fallback") {
      setRatingTarget({ fieldId: attemptedField.id, position: attemptedField.position, outcome: "failed" });
      setDifficultyRating(null);
    }
    toast(
      action === "retry" ? "Semmi baj — a feladat megvár. Próbáld újra, amikor készen állsz."
      : action === "easier" ? "Készítettünk egy könnyebb változatot."
      : action === "pause" ? "Pihenj 24 órát — az eddigi haladásod biztonságban van."
      : "Visszatértél az utolsó ellenőrzőpont utáni feladathoz. Kezdheted innen újra.",
    );
    await refresh();
    if (attemptedField) {
      await qc.invalidateQueries({ queryKey: ["field-proof", attemptedField.id] });
    }
  }

  const byPos = new Map(fields.data?.map((f) => [f.position, f]));
  const pathLength = fields.data?.length ?? 0;
  const positions = Array.from({ length: pathLength }, (_, index) => index + 1);
  const pointY = (position: number) =>
    56 + (position - 1) * 80 + Math.floor((position - 1) / 5) * 16;
  const pointX = (position: number) => 160 + getWindingOffset(position);
  const completedPositions: number[] = [];
  for (const position of positions) {
    if (position >= habit.current_position || byPos.get(position)?.status !== "completed") break;
    completedPositions.push(position);
  }
  const toRoadPath = (pathPositions: number[]) =>
    buildWindingPath(pathPositions.map((position) => ({ x: pointX(position), y: pointY(position) })));
  const roadPath = toRoadPath(positions);
  const completedRoadPath = toRoadPath(completedPositions);
  const roadHeight = Math.max(96, pointY(pathLength) + 48);
  const stateLabel = (state: string) =>
    state === "current" ? "aktuális" : state === "completed" ? "teljesítve" : state === "failed" ? "próbáld újra" : "zárolva";

  return (
    <main className={`mx-auto max-w-md ${view === "map" ? "pb-80" : "pb-28"}`}>
      <header className="sticky top-0 z-20 border-b bg-background/85 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2 overflow-x-auto">
          {habits.data!.map((x) => (
            <Link
              key={x.id} to="/map" search={{ h: x.id }}
              className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${x.id === habit.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
            >
              {x.emoji} {x.name}
            </Link>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{pathLength ? `Feladat ${Math.min(habit.current_position, pathLength)} / ${pathLength}` : "Útvonal betöltése…"}</span>
          <span>🏁 Biztonságos pont: {habit.last_checkpoint || "–"}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" aria-label="Útvonal nézete">
          <button
            type="button"
            aria-pressed={view === "map"}
            onClick={() => setView("map")}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold ${view === "map" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            <MapIcon className="size-4" /> Térkép
          </button>
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold ${view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            <List className="size-4" /> Lista
          </button>
        </div>
      </header>

      {view === "map" ? (
        <ol aria-label="Szokásútvonal térképe" className="relative flex flex-col items-center gap-4 px-5 pt-8">
          {pathLength > 1 && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-0 z-0 h-full w-[320px] -translate-x-1/2 overflow-visible"
              viewBox={`0 0 320 ${roadHeight}`}
              preserveAspectRatio="none"
            >
              <path d={roadPath} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" className="text-muted" />
              {completedRoadPath && (
                <path d={completedRoadPath} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
              )}
            </svg>
          )}
          {positions.map((position) => {
            const field = byPos.get(position);
            const isCheckpoint = position % 5 === 0;
            const state = getFieldNodeState(position, habit.current_position, field?.status);
            const isCurrent = state === "current";
            const isSelected = selectedPosition === position;
            const offset = getWindingOffset(position);
            return (
              <li
                key={position}
                style={{ transform: `translateX(${offset}px)` }}
                className="relative z-10 flex min-h-16 flex-col items-center"
              >
                <button
                  ref={isCurrent ? currentRef : undefined}
                  type="button"
                  onClick={() => {
                    setSelectedPosition(position);
                    setGiveUpOpen(false);
                  }}
                  aria-label={`${isCheckpoint ? "Ellenőrzőpont" : "Feladat"} ${position}, ${stateLabel(state)}${field ? `, nehézség ${field.difficulty} a 10-ből` : ""}`}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`relative flex items-center justify-center rounded-full font-display font-bold transition ${
                    isCheckpoint ? "size-16 text-xl" : "size-12 text-base"
                  } ${
                    isCurrent
                      ? "bg-card text-primary ring-4 ring-primary shadow-lg node-current"
                      : state === "completed"
                        ? isCheckpoint
                          ? "bg-checkpoint text-checkpoint-foreground node-checkpoint"
                          : "bg-primary text-primary-foreground"
                        : state === "failed"
                          ? "bg-destructive/15 text-destructive ring-2 ring-destructive"
                          : isCheckpoint
                            ? "bg-checkpoint/20 text-checkpoint ring-2 ring-checkpoint/40"
                            : "bg-locked text-muted-foreground opacity-70"
                  } ${isSelected ? "outline outline-2 outline-offset-4 outline-primary/50" : ""}`}
                >
                  {state === "completed" ? <Check className="size-5" /> : isCheckpoint ? "🏁" : position}
                  {state === "locked" && field && <Lock className="absolute -right-1 -top-1 size-3" />}
                  {isCurrent && <span className="absolute -top-7 text-2xl">{emoji}</span>}
                </button>
                <span className={`mt-1 flex items-center gap-1 text-[10px] font-semibold ${isCheckpoint ? "text-checkpoint" : "text-muted-foreground"}`}>
                  {isCheckpoint ? `Ellenőrzőpont ${position}` : `Feladat ${position}`}
                  {field && <Difficulty value={field.difficulty} compact />}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <ol aria-label="Szokásútvonal listája" className="space-y-2 px-4 py-4">
          {positions.map((position) => {
            const field = byPos.get(position);
            const isCheckpoint = position % 5 === 0;
            const state = getFieldNodeState(position, habit.current_position, field?.status);
            const isCurrent = state === "current";
            return (
              <li key={position}>
                <button
                  ref={isCurrent ? currentRef : undefined}
                  type="button"
                  onClick={() => setSelectedPosition(position)}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`${isCheckpoint ? "Ellenőrzőpont" : "Feladat"} ${position}, ${stateLabel(state)}`}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${isCurrent ? "border-primary bg-primary/5" : isCheckpoint ? "border-checkpoint/40 bg-checkpoint/5" : "bg-card"}`}
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${state === "completed" ? "bg-primary text-primary-foreground" : isCheckpoint ? "bg-checkpoint/20 text-checkpoint" : "bg-muted text-muted-foreground"}`}>
                    {state === "completed" ? <Check className="size-4" /> : isCheckpoint ? "🏁" : position}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {field?.title ?? (isCheckpoint ? `Ellenőrzőpont ${position}` : `Feladat ${position}`)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {stateLabel(state)}{isCheckpoint ? " · ellenőrzőpont · a haladásod mentve" : ""}
                    </span>
                  </span>
                  {field ? <Difficulty value={field.difficulty} /> : <Lock className="size-4 text-muted-foreground" />}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {pathLength > 0 && habit.current_position > pathLength && (
        <p className="mx-4 mt-5 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          {extending ? "Új feladatokat készítünk neked…" : "Az útvonal jelenlegi összes feladatát teljesítetted. A folytatás új feladatok hozzáadásakor jelenik meg itt."}
        </p>
      )}

      {selectedField && selectedState && (
        <section
          aria-label="Feladat részletei"
          className="fixed inset-x-0 bottom-16 z-20 mx-auto max-h-[65dvh] max-w-md overflow-y-auto px-4"
        >
          <div className="rounded-3xl border bg-card p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{selectedField.position} · {selectedField.is_checkpoint ? "ellenőrzőpont" : `feladat · ${stateLabel(selectedState)}`}</span>
                <Difficulty value={selectedField.difficulty} />
              </div>
              <button
                type="button"
                aria-label="Feladat részleteinek bezárása"
                onClick={() => setSelectedPosition(-1)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <h2 id="field-sheet-title" className="text-xl font-semibold">
              {selectedField.title}
            </h2>
            {selectedState !== "locked" && (
              <>
                <p className="mt-1 text-sm text-muted-foreground">{selectedField.description}</p>
                {selectedField.difficulty_reason && (
                  <p className="mt-2 rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary">{selectedField.difficulty_reason}</p>
                )}
              </>
            )}
            {selectedField.is_checkpoint && (
              <p className="mt-3 rounded-xl bg-checkpoint/10 p-3 text-sm text-muted-foreground">
                Az ellenőrzőpont megőrzi az előtte elért haladásodat. Ezt a részt már nem veszítheted el.
              </p>
            )}
            {selectedState === "current" && (
              paused ? (
                <p className="mt-4 rounded-xl bg-muted p-3 text-sm">
                  Szünetel eddig: {pausedUntil!.toLocaleString("hu-HU", { weekday: "short", hour: "2-digit", minute: "2-digit" })}. A haladásod biztonságban van.
                </p>
              ) : (
                <>
                  <div className="mt-4 rounded-xl bg-muted p-3">
                    <h3 className="font-semibold">Igazolás · {proofLabel(proofTypeForDifficulty(selectedField.difficulty))}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Az igazolásodat csak te láthatod. Az írásos és fényképes igazolás ellenőrzéséhez szükséges háttérszolgáltatás még nincs telepítve; ezek privát, függőben lévő állapotban maradnak.
                    </p>
                    {activeProof.isError ? (
                      <p className="mt-3 text-sm text-destructive">Nem sikerült betölteni az igazolás állapotát.</p>
                    ) : activeProof.data?.status === "accepted" ? (
                      <p className="mt-3 text-sm font-semibold text-primary">Elfogadva · most már befejezheted a feladatot.</p>
                    ) : activeProof.data?.status === "pending" ? (
                      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                        <span>Privát igazolás · ellenőrzésre vár.</span>
                        <button type="button" onClick={() => void activeProof.refetch()} className="shrink-0 underline">Állapot frissítése</button>
                      </div>
                    ) : activeProof.data?.status === "rejected" ? (
                      <p className="mt-3 text-sm">Az igazolás nem lett elfogadva. {activeProof.data.review_reason}</p>
                    ) : activeProof.data?.status === "used" ? (
                      <p className="mt-3 text-sm text-muted-foreground">Korábbi igazolás. Új próbálkozáshoz új igazolás szükséges.</p>
                    ) : null}
                    {activeProof.data?.status !== "pending" && activeProof.data?.status !== "accepted" && (
                      <form onSubmit={submitProof} className="mt-3 space-y-3">
                        {proofTypeForDifficulty(selectedField.difficulty) === "honor" ? (
                          <label className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={honorConfirmed}
                              onChange={(event) => setHonorConfirmed(event.target.checked)}
                              className="mt-1"
                            />
                            <span>Megerősítem, hogy teljesítettem ezt a feladatot.</span>
                          </label>
                        ) : proofTypeForDifficulty(selectedField.difficulty) === "reflection" ? (
                          <label className="block text-sm">
                            Rövid reflexió
                            <textarea
                              value={proofText}
                              onChange={(event) => setProofText(event.target.value)}
                              maxLength={2000}
                              rows={3}
                              minLength={10}
                              required
                              className="mt-1 w-full rounded-xl border bg-background p-3"
                            />
                          </label>
                        ) : (
                          <label className="block text-sm">
                            Fényképes igazolás (JPEG, PNG vagy WebP, legfeljebb 10 MB)
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
                              required
                              className="mt-1 block w-full text-xs"
                            />
                          </label>
                        )}
                        <button
                          type="submit"
                          disabled={proofBusy || activeProof.isLoading}
                          className="w-full rounded-xl border bg-background py-2 font-semibold disabled:opacity-50"
                        >
                          {proofBusy ? "Mentés…" : "Igazolás elküldése"}
                        </button>
                      </form>
                    )}
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button disabled={busy || proofBusy} onClick={() => setGiveUpOpen(true)} className="flex-1 rounded-2xl border py-3 font-semibold">Most nem sikerült</button>
                    <button
                      disabled={busy || proofBusy || activeProof.data?.status !== "accepted"}
                      onClick={complete}
                      className="flex-[2] rounded-2xl bg-primary py-3 font-display text-lg font-semibold text-primary-foreground disabled:opacity-40"
                    >
                      {activeProof.data?.status === "accepted" ? "Kész ✓" : "Elfogadott igazolás kell"}
                    </button>
                  </div>
                </>
              )
            )}
          </div>
        </section>
      )}

      {giveUpOpen && (
        <Overlay onClose={() => setGiveUpOpen(false)}>
          <h2 className="text-2xl font-bold">Semmi baj.</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ezt a feladatot nem veszíted el. Hogyan folytatnád?</p>
          <div className="mt-5 space-y-3">
            <Option onClick={() => fail("retry")} title="Próbáld újra" desc="Maradj ennél a feladatnál." />
            <Option onClick={() => fail("easier")} title="Könnyebb változat" desc="Tegyél egy kisebb lépést ugyanebben a feladatban." />
            <Option onClick={() => fail("pause")} title="Szünet 24 órára" desc="Pihenj, és folytasd holnap." />
            {habit.consecutive_failures >= 3 && (
              <Option onClick={() => fail("fallback")} title="Vissza az ellenőrzőponthoz" desc={`Folytatás a(z) ${habit.last_checkpoint + 1}. feladattól. Az előző haladásod megmarad.`} />
            )}
          </div>
          {habit.consecutive_failures > 0 && habit.consecutive_failures < 3 && (
            <p className="mt-4 text-xs text-muted-foreground">Egymást követő nehéz próbálkozások: {habit.consecutive_failures}. Három után választhatod az ellenőrzőponthoz való visszatérést — csak ha szeretnéd.</p>
          )}
        </Overlay>
      )}

      {celebrate && (
        <Overlay onClose={() => setCelebrate(null)}>
          <Confetti />
          <div className="celebrate mx-auto flex size-28 items-center justify-center rounded-full bg-checkpoint text-5xl node-checkpoint">🏆</div>
          <h2 className="mt-5 text-center text-3xl font-bold">Ellenőrzőpont: {celebrate}!</h2>
          <p className="mt-2 text-center text-muted-foreground">Az eddigi haladásod megmarad, ezt már senki nem veheti el tőled.</p>
          <button onClick={() => setCelebrate(null)} className="mt-6 w-full rounded-2xl bg-checkpoint py-3 font-display text-lg font-semibold text-checkpoint-foreground">Tovább</button>
        </Overlay>
      )}

      {ratingTarget && !celebrate && !giveUpOpen && (
        <Overlay onClose={() => setRatingTarget(null)}>
          <h2 className="text-2xl font-bold">Mennyire volt nehéz?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A {ratingTarget.position}. feladat nehézségéről kérdezünk. Ez nem változtatja meg a jutalmad vagy az útvonalad.
          </p>
          <div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-10" role="group" aria-label="A feladat nehézsége">
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={difficultyRating === value}
                onClick={() => setDifficultyRating(value)}
                className={`rounded-xl border py-3 font-semibold ${difficultyRating === value ? "border-primary bg-primary/10 text-primary" : "bg-background/50"}`}
              >{value}</button>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Könnyű</span><span>Nehéz</span></div>
          <div className="mt-6 flex gap-3">
            <button type="button" disabled={ratingBusy} onClick={() => setRatingTarget(null)} className="flex-1 rounded-xl border py-3 font-semibold">Kihagyás</button>
            <button type="button" disabled={ratingBusy || difficultyRating === null} onClick={saveDifficultyRating} className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40">
              {ratingBusy ? "Mentés…" : "Küldés"}
            </button>
          </div>
        </Overlay>
      )}

    </main>
  );
}

function Difficulty({ value, compact = false }: { value: number; compact?: boolean }) {
  return (
    <span className={`flex items-center gap-0.5 ${compact ? "ml-1" : ""}`} aria-label={`Nehézség: ${value}/10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={`${compact ? "h-1.5 w-1" : "h-2 w-1.5"} rounded-full ${i < value ? "bg-primary" : "bg-locked"}`} />
      ))}
      {!compact && <span className="ml-1 font-semibold">{value}/10</span>}
    </span>
  );
}

function progressError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("accepted proof required")) return "A feladat befejezéséhez előbb elfogadott igazolás szükséges.";
  if (normalized.includes("paused")) return "Az útvonalad jelenleg szünetel. Próbáld újra a szünet lejárta után.";
  if (normalized.includes("no current field")) return "Ehhez a szokáshoz jelenleg nincs aktív feladat.";
  if (normalized.includes("habit not found")) return "A szokás nem található vagy már nem érhető el.";
  if (normalized.includes("fallback requires")) return "Az ellenőrzőponthoz való visszatérés három egymást követő nehéz próbálkozás után választható.";
  if (normalized.includes("not the current field")) return "Ezt a feladatot még nem oldottad fel.";
  return `Nem sikerült menteni a haladásodat: ${message}`;
}

function proofLabel(type: "honor" | "reflection" | "photo"): string {
  if (type === "honor") return "őszinte önbevallás";
  if (type === "reflection") return "rövid írásos reflexió";
  return "fényképes bizonyíték";
}

function Option({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-2xl border bg-background/40 p-4 text-left hover:border-primary">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </button>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="relative w-full max-w-md overflow-hidden rounded-t-3xl border bg-card p-6 pb-10 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="Bezárás"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function Confetti() {
  const colors = ["bg-primary", "bg-checkpoint", "bg-accent", "bg-destructive"];
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: 24 }, (_, i) => (
        <span
          key={i}
          className={`absolute top-0 h-3 w-2 rounded-sm ${colors[i % 4]}`}
          style={{ left: `${(i * 37) % 100}%`, animation: `confetti-fall ${1.2 + (i % 5) * 0.3}s ease-in ${(i % 6) * 0.1}s both` }}
        />
      ))}
    </div>
  );
}
