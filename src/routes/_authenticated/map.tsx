import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Lock, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/map")({
  validateSearch: (s: Record<string, unknown>): { h?: string } => (typeof s["h"] === "string" ? { h: s["h"] } : {}),
  head: () => ({ meta: [{ title: "Path – Habit Shift" }] }),
  component: MapPage,
});

const TOTAL = 100;

function MapPage() {
  const { h } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [giveUpOpen, setGiveUpOpen] = useState(false);
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const currentRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (habits.data && habits.data.length === 0) navigate({ to: "/onboarding" });
  }, [habits.data, navigate]);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [fields.data?.length, habit?.current_position]);

  if (!habit) return <main className="p-8 text-muted-foreground">Loading…</main>;

  const current = fields.data?.find((f) => f.position === habit.current_position);
  const pausedUntil = habit.paused_until ? new Date(habit.paused_until) : null;
  const paused = pausedUntil && pausedUntil > new Date();
  const emoji = habit.emoji ?? "✨";

  async function refresh() {
    await Promise.all([qc.invalidateQueries({ queryKey: ["habits"] }), qc.invalidateQueries({ queryKey: ["fields", habit!.id] })]);
  }

  async function complete() {
    setBusy(true);
    const { data, error } = await supabase.rpc("complete_field", { _habit: habit!.id });
    setBusy(false);
    if (error) { toast.error("Couldn't save"); return; }
    const r = data as { checkpoint: boolean; position: number };
    if (r.checkpoint) setCelebrate(r.position);
    else toast.success("Nice work! On to the next field.");
    refresh();
  }

  async function fail(action: "retry" | "easier" | "pause" | "fallback") {
    setBusy(true);
    const { error } = await supabase.rpc("fail_field", { _habit: habit!.id, _action: action });
    setBusy(false);
    setGiveUpOpen(false);
    if (error) { toast.error("Couldn't save"); return; }
    toast(
      action === "retry" ? "Okay — the field stays yours. Try again!"
      : action === "easier" ? "Here's an easier version."
      : action === "pause" ? "Rest for 24 hours — your progress is safe."
      : "You're back just after your last checkpoint. Fresh start!",
    );
    refresh();
  }

  const byPos = new Map(fields.data?.map((f) => [f.position, f]));

  return (
    <main className="mx-auto max-w-md pb-72">
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
          <span>Field {habit.current_position} / {TOTAL}</span>
          <span>🏁 Safe point: {habit.last_checkpoint || "–"}</span>
        </div>
      </header>

      <ol className="flex flex-col items-center gap-5 px-5 pt-8">
        {Array.from({ length: TOTAL }, (_, i) => i + 1).map((pos) => {
          const f = byPos.get(pos);
          const isCp = pos % 5 === 0;
          const status = f?.status ?? "locked";
          const isCur = pos === habit.current_position;
          const x = Math.sin(pos * 0.8) * 90;
          const base = "relative flex items-center justify-center rounded-full font-display font-bold transition";
          const size = isCp ? "size-20 text-xl" : "size-14 text-lg";
          const look = isCur
            ? "bg-card ring-4 ring-primary node-current text-primary"
            : status === "completed"
              ? isCp ? "bg-checkpoint text-checkpoint-foreground node-checkpoint" : "bg-primary text-primary-foreground"
              : isCp ? "bg-checkpoint/25 text-checkpoint ring-2 ring-checkpoint/50" : "bg-locked text-muted-foreground opacity-60";
          return (
            <li key={pos} style={{ transform: `translateX(${x}px)` }} className="flex flex-col items-center">
              <div ref={isCur ? currentRef : undefined} className={`${base} ${size} ${look}`} title={f?.title}>
                {status === "completed" && !isCp ? <Check className="size-6" /> : isCp ? (status === "completed" ? "🏆" : "🏁") : pos}
                {!f && !isCp && <Lock className="absolute -right-1 -top-1 size-4" />}
                {isCur && <span className="absolute -top-7 text-2xl">{emoji}</span>}
              </div>
              {isCp && <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-checkpoint">Checkpoint {pos}</span>}
            </li>
          );
        })}
      </ol>

      {current && (
        <section className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-md px-4">
          <div className="rounded-3xl border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{current.position} · field {current.is_checkpoint && "· checkpoint"}</span>
              <Difficulty value={current.difficulty} />
            </div>
            <h2 className="mt-1 text-xl font-semibold">{current.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>
            {paused ? (
              <p className="mt-4 rounded-xl bg-muted p-3 text-sm">
                Paused until: {pausedUntil!.toLocaleString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" })}. Your progress is safe.
              </p>
            ) : (
              <div className="mt-4 flex gap-3">
                <button disabled={busy} onClick={() => setGiveUpOpen(true)} className="flex-1 rounded-2xl border py-3 font-semibold">I didn't make it</button>
                <button disabled={busy} onClick={complete} className="flex-[2] rounded-2xl bg-primary py-3 font-display text-lg font-semibold text-primary-foreground">Done ✓</button>
              </div>
            )}
          </div>
        </section>
      )}

      {giveUpOpen && (
        <Overlay onClose={() => setGiveUpOpen(false)}>
          <h2 className="text-2xl font-bold">That's okay.</h2>
          <p className="mt-1 text-sm text-muted-foreground">You won't lose this field. What would you like to do?</p>
          <div className="mt-5 space-y-3">
            <Option onClick={() => fail("retry")} title="Try again" desc="Keep this challenge." />
            <Option onClick={() => fail("easier")} title="Easier version" desc="A smaller step on the same field." />
            <Option onClick={() => fail("pause")} title="Pause for 24 hours" desc="Rest, continue tomorrow." />
            {habit.consecutive_failures >= 3 && (
              <Option onClick={() => fail("fallback")} title="Go back to checkpoint" desc={`Restart from field ${habit.last_checkpoint + 1}. Everything before stays.`} />
            )}
          </div>
          {habit.consecutive_failures > 0 && habit.consecutive_failures < 3 && (
            <p className="mt-4 text-xs text-muted-foreground">Attempts in a row: {habit.consecutive_failures}. Going back is only possible after 3 — and only if you want to.</p>
          )}
        </Overlay>
      )}

      {celebrate && (
        <Overlay onClose={() => setCelebrate(null)}>
          <Confetti />
          <div className="celebrate mx-auto flex size-28 items-center justify-center rounded-full bg-checkpoint text-5xl node-checkpoint">🏆</div>
          <h2 className="mt-5 text-center text-3xl font-bold">Checkpoint {celebrate}!</h2>
          <p className="mt-2 text-center text-muted-foreground">No one can take this from you. You'll never fall below it.</p>
          <button onClick={() => setCelebrate(null)} className="mt-6 w-full rounded-2xl bg-checkpoint py-3 font-display text-lg font-semibold text-checkpoint-foreground">Onward!</button>
        </Overlay>
      )}

      <BottomNav />
    </main>
  );
}

function Difficulty({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Difficulty ${value}/10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={`h-2 w-1.5 rounded-full ${i < value ? "bg-primary" : "bg-locked"}`} />
      ))}
      <span className="ml-1 font-semibold">{value}/10</span>
    </span>
  );
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
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="relative w-full max-w-md overflow-hidden rounded-t-3xl border bg-card p-6 pb-10 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
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
