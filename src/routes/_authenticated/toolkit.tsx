import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Lightbulb, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFutureLetter } from "@/components/FutureLetterCard";
import { suggestActivities, suggestLetterPrompts } from "@/lib/support-ai.functions";

export const Route = createFileRoute("/_authenticated/toolkit")({
  head: () => ({
    meta: [
      { title: "My toolkit – Szokásváltó" },
      { name: "description", content: "Your letter to your future self and your personal list of replacement activities." },
    ],
  }),
  component: Toolkit,
});

export const CATEGORIES = [
  { value: "movement", label: "Movement" },
  { value: "creative", label: "Creative" },
  { value: "social", label: "Social" },
  { value: "calming", label: "Calming" },
  { value: "useful", label: "Useful" },
] as const;
type Cat = (typeof CATEGORIES)[number]["value"];

function Toolkit() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const letter = useFutureLetter();
  const [why, setWhy] = useState("");
  const [note, setNote] = useState("");
  const [prompts, setPrompts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const getPrompts = useServerFn(suggestLetterPrompts);
  const getIdeas = useServerFn(suggestActivities);

  useEffect(() => {
    if (letter.data) { setWhy(letter.data.why); setNote(letter.data.note); }
  }, [letter.data]);

  const activities = useQuery({
    queryKey: ["replacement-activities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("replacement_activities").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState(5);
  const [cat, setCat] = useState<Cat>("calming");
  const [ideas, setIdeas] = useState<{ name: string; minutes: number; category: Cat }[]>([]);

  async function saveLetter() {
    setBusy(true);
    const { error } = await supabase.from("future_letters").upsert({ user_id: user.id, why: why.trim(), note: note.trim(), updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast.error("Couldn't save your letter.");
    toast.success("Letter saved.");
    qc.invalidateQueries({ queryKey: ["future-letter"] });
  }

  async function addActivity(a: { name: string; minutes: number; category: Cat }) {
    const { error } = await supabase.from("replacement_activities").insert({ ...a, user_id: user.id });
    if (error) return toast.error("Couldn't add that activity.");
    qc.invalidateQueries({ queryKey: ["replacement-activities"] });
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-5 pb-28 pt-8">
      <Link to="/home" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Back</Link>
      <h1 className="text-3xl font-bold">My toolkit</h1>

      <section className="space-y-3 rounded-3xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Letter to your future self</h2>
        <p className="text-sm text-muted-foreground">You'll see this when you're about to slip, at every checkpoint, and after a hard moment. Write it in your own words.</p>
        <label className="block text-sm font-semibold" htmlFor="why">Why am I doing this?</label>
        <textarea id="why" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={2000} rows={5} className="w-full rounded-xl border bg-background p-3" placeholder="Dear me…" />
        <label className="block text-sm font-semibold" htmlFor="note">Anything else to remember (optional)</label>
        <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} className="w-full rounded-xl border bg-background p-3" />
        {prompts.length > 0 && (
          <ul className="space-y-1 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
            {prompts.map((p) => <li key={p}>• {p}</li>)}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={saveLetter} disabled={busy || !why.trim()} className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">Save letter</button>
          <button
            onClick={async () => {
              const r = await getPrompts();
              if ("error" in r && r.error) toast.error(r.error); else setPrompts(r.prompts ?? []);
            }}
            className="inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-sm font-semibold"
          ><Lightbulb className="size-4" /> I'm stuck — give me questions</button>
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Things I do instead</h2>
        <p className="text-sm text-muted-foreground">The craving timer and your coach pick from this list.</p>
        <ul className="space-y-2">
          {(activities.data ?? []).map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
              <span><b>{a.name}</b> · {a.minutes} min · {CATEGORIES.find((c) => c.value === a.category)?.label}</span>
              <button aria-label={`Remove ${a.name}`} onClick={async () => { await supabase.from("replacement_activities").delete().eq("id", a.id); qc.invalidateQueries({ queryKey: ["replacement-activities"] }); }}><Trash2 className="size-4 text-muted-foreground" /></button>
            </li>
          ))}
          {activities.data?.length === 0 && <li className="text-sm text-muted-foreground">Nothing yet — add your first one below.</li>}
        </ul>
        <form
          className="grid gap-2 sm:grid-cols-[1fr_80px_130px_auto]"
          onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; addActivity({ name: name.trim(), minutes, category: cat }); setName(""); }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Walk around the block" className="rounded-xl border bg-background px-3 py-2" aria-label="Activity name" />
          <input type="number" min={1} max={240} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 1)} className="rounded-xl border bg-background px-3 py-2" aria-label="Minutes" />
          <select value={cat} onChange={(e) => setCat(e.target.value as Cat)} className="rounded-xl border bg-background px-3 py-2" aria-label="Category">
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 font-semibold text-primary-foreground"><Plus className="size-4" /> Add</button>
        </form>
        <button
          onClick={async () => {
            const r = await getIdeas({ data: { existing: (activities.data ?? []).map((a) => a.name) } });
            if ("error" in r && r.error) toast.error(r.error); else setIdeas((r.items ?? []) as typeof ideas);
          }}
          className="inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-sm font-semibold"
        ><Sparkles className="size-4" /> Suggest ideas for me</button>
        {ideas.length > 0 && (
          <ul className="space-y-2">
            {ideas.map((i) => (
              <li key={i.name} className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-sm">
                <span>{i.name} · {i.minutes} min</span>
                <button onClick={() => { addActivity(i); setIdeas((x) => x.filter((y) => y !== i)); }} className="font-semibold text-primary">Add</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
