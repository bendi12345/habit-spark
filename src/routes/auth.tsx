import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Belépés – Szokásváltó" },
      { name: "description", content: "Lépj be vagy regisztrálj a Szokásváltóba." },
      { property: "og:title", content: "Belépés – Szokásváltó" },
      { property: "og:description", content: "Lépj be vagy regisztrálj." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: window.location.origin + "/map" },
        });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/map" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba történt");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) return toast.error("Google belépés sikertelen");
    if (r.redirected) return;
    navigate({ to: "/map" });
  }

  const input = "w-full rounded-xl border bg-input/30 px-4 py-3 outline-none focus:ring-2 focus:ring-ring";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="text-4xl font-bold">{mode === "in" ? "Üdv újra!" : "Kezdjük el"}</h1>
      <p className="mt-2 text-muted-foreground">{mode === "in" ? "Folytasd ott, ahol abbahagytad." : "Hozd létre a fiókod."}</p>

      {sent ? (
        <div className="mt-8 rounded-2xl bg-card p-5">
          <p className="font-semibold">Nézd meg az e-mailjeidet!</p>
          <p className="mt-1 text-sm text-muted-foreground">Küldtünk egy megerősítő linket a(z) {email} címre.</p>
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="mt-8 space-y-3">
            <input className={input} type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={input} type="password" required minLength={6} placeholder="Jelszó" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button disabled={busy} className="w-full rounded-xl bg-primary py-3 font-display text-lg font-semibold text-primary-foreground disabled:opacity-60">
              {mode === "in" ? "Belépés" : "Regisztráció"}
            </button>
          </form>
          <button onClick={google} className="mt-3 w-full rounded-xl border bg-card py-3 font-semibold">
            Folytatás Google-fiókkal
          </button>
          <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-6 text-sm text-muted-foreground underline">
            {mode === "in" ? "Még nincs fiókod? Regisztrálj" : "Van már fiókod? Lépj be"}
          </button>
        </>
      )}
    </main>
  );
}
