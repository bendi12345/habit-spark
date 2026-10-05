import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HABITS, buildTemplate, type HabitKey } from "@/lib/path-template";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Új szokás – Szokásváltó" }] }),
  component: Onboarding,
});

const INTENSITY = [
  { v: 1, label: "Óvatos", desc: "Apró lépésekkel indulok" },
  { v: 2, label: "Kiegyensúlyozott", desc: "Normál tempó" },
  { v: 3, label: "Bátor", desc: "Bírom a kihívást" },
];

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [habit, setHabit] = useState<HabitKey | null>(null);
  const [customName, setCustomName] = useState("");
  const [goal, setGoal] = useState("");
  const [intensity, setIntensity] = useState(2);
  const [busy, setBusy] = useState(false);

  const meta = HABITS.find((h) => h.key === habit);
  const name = habit === "other" ? customName.trim() : meta?.name ?? "";

  async function create() {
    if (!habit || !name) return;
    setBusy(true);
    const { data: h, error } = await supabase
      .from("habits")
      .insert({ habit_key: habit, name, goal: goal || null, intensity })
      .select()
      .single();
    if (error || !h) { setBusy(false); { toast.error("Nem sikerült létrehozni"); return; } }
    const rows = buildTemplate(habit, intensity).map((f) => ({ ...f, habit_id: h.id }));
    const { error: e2 } = await supabase.from("fields").insert(rows);
    setBusy(false);
    if (e2) { toast.error("Nem sikerült a pályát létrehozni"); return; }
    await qc.invalidateQueries({ queryKey: ["habits"] });
    navigate({ to: "/map", search: { h: h.id } });
  }

  const card = (on: boolean) =>
    `w-full rounded-2xl border p-4 text-left transition ${on ? "border-primary bg-primary/10" : "bg-card"}`;

  return (
    <main className="mx-auto max-w-md px-5 pb-28 pt-8">
      <p className="text-sm text-muted-foreground">{step + 1} / 3</p>
      {step === 0 && (
        <>
          <h1 className="mt-2 text-3xl font-bold">Mitől szabadulnál meg?</h1>
          <div className="mt-6 space-y-3">
            {HABITS.map((h) => (
              <button key={h.key} onClick={() => setHabit(h.key)} className={card(habit === h.key)}>
                <span className="text-2xl">{h.emoji}</span>
                <span className="ml-3 font-display text-lg font-semibold">{h.name}</span>
                <p className="mt-1 text-sm text-muted-foreground">{h.hint}</p>
              </button>
            ))}
            {habit === "other" && (
              <input
                autoFocus value={customName} onChange={(e) => setCustomName(e.target.value)}
                placeholder="Pl. körömrágás" className="w-full rounded-xl border bg-input/30 px-4 py-3"
              />
            )}
          </div>
          <button disabled={!name} onClick={() => setStep(1)} className="mt-6 w-full rounded-2xl bg-primary py-4 font-display text-lg font-semibold text-primary-foreground disabled:opacity-40">Tovább</button>
        </>
      )}
      {step === 1 && (
        <>
          <h1 className="mt-2 text-3xl font-bold">Mi a célod?</h1>
          <p className="mt-2 text-muted-foreground">Fogalmazd meg a saját szavaiddal.</p>
          <textarea
            value={goal} onChange={(e) => setGoal(e.target.value)} rows={4}
            placeholder="Pl. Nyárra teljesen leteszem, hogy jobban bírjam a futást."
            className="mt-6 w-full rounded-2xl border bg-input/30 p-4"
          />
          <div className="mt-6 flex gap-3">
            <button onClick={() => setStep(0)} className="flex-1 rounded-2xl border py-4">Vissza</button>
            <button onClick={() => setStep(2)} className="flex-[2] rounded-2xl bg-primary py-4 font-display text-lg font-semibold text-primary-foreground">Tovább</button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h1 className="mt-2 text-3xl font-bold">Milyen tempóban?</h1>
          <div className="mt-6 space-y-3">
            {INTENSITY.map((i) => (
              <button key={i.v} onClick={() => setIntensity(i.v)} className={card(intensity === i.v)}>
                <span className="font-display text-lg font-semibold">{i.label}</span>
                <p className="text-sm text-muted-foreground">{i.desc}</p>
              </button>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 rounded-2xl border py-4">Vissza</button>
            <button disabled={busy} onClick={create} className="flex-[2] rounded-2xl bg-primary py-4 font-display text-lg font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? "Pálya épül…" : "Pálya indítása"}
            </button>
          </div>
        </>
      )}
      <BottomNav />
    </main>
  );
}
