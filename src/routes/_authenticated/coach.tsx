import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { coachReply } from "@/lib/coach.functions";

type Message = { role: "user" | "assistant"; text: string; crisis?: boolean };

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({ meta: [{ title: "Coach – Szokásváltó" }] }),
  component: Coach,
});

function Coach() {
  const { user } = Route.useRouteContext();
  const replyWithCoach = useServerFn(coachReply);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const habit = useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("habits").select("name,current_position,last_checkpoint").order("created_at").limit(1).maybeSingle();
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

  async function send() {
    const message = draft.trim();
    if (!message || busy) return;
    setDraft("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    setBusy(true);
    const result = await replyWithCoach({
      data: {
        message,
        context: JSON.stringify({
          displayName: profile.data?.display_name,
          habit: habit.data,
          currentStreak: streak.data ?? 0,
        }),
        tone: readCoachTone(),
      },
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setMessages((current) => [...current, { role: "assistant", text: result.reply, crisis: result.crisis }]);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 pb-28 pt-8 lg:pb-10">
      <header className="mb-5 flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary"><MessageCircle className="size-6" /></div>
        <div><p className="text-sm font-semibold text-primary">SZOKÁSVÁLTÓ</p><h1 className="text-2xl font-bold">Coach</h1></div>
      </header>
      <div className="mb-4 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        Megoszthatod, mi jár a fejedben. A coach bátorít, nem ítélkezik. Ez nem egészségügyi vagy sürgősségi segítség.
      </div>
      <section aria-label="Beszélgetés a coachcsal" aria-live="polite" className="flex-1 space-y-3">
        {messages.length === 0 && (
          <div className="rounded-2xl bg-card p-4 text-sm">
            Szia{profile.data?.display_name ? `, ${profile.data.display_name}` : ""}! Miben segíthetek most?
          </div>
        )}
        {messages.map((message, index) => (
          <article key={`${message.role}-${index}`} className={`max-w-[90%] rounded-2xl p-4 text-sm leading-relaxed ${message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card"}`}>
            {message.text}
            {message.crisis && (
              <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
                <p className="font-semibold">Azonnali segítség</p>
                <a className="mt-2 inline-block rounded-lg bg-destructive px-4 py-2 font-bold text-destructive-foreground" href="tel:112">112 hívása</a>
                <p className="mt-2 text-xs">Ha nem vagy közvetlen veszélyben, kérlek, szólj most egy megbízható embernek is.</p>
              </div>
            )}
          </article>
        ))}
        {busy && <p className="animate-pulse rounded-2xl bg-card p-4 text-sm text-muted-foreground">A coach válaszol…</p>}
      </section>
      <form className="mt-4 flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <label className="sr-only" htmlFor="coach-message">Üzenet a coachnak</label>
        <textarea
          id="coach-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={2000}
          rows={2}
          placeholder="Írd le, mi foglalkoztat…"
          className="min-h-12 flex-1 resize-y rounded-2xl border bg-input/30 p-3"
        />
        <button type="submit" disabled={!draft.trim() || busy} aria-label="Üzenet küldése" className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-40">
          <Send className="size-5" />
        </button>
      </form>
    </main>
  );
}

function readCoachTone(): "friendly" | "mentor" | "direct" {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem("habit-shift-preferences") ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return "friendly";
    const tone = (value as Record<string, unknown>)["coachTone"];
    return tone === "mentor" || tone === "direct" ? tone : "friendly";
  } catch {
    toast.error("A coach hangnem-beállítását nem sikerült beolvasni; az alapértelmezett hangnemet használjuk.");
    return "friendly";
  }
}
