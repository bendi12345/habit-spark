import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in – Habit Shift" },
      { name: "description", content: "Sign in or create your Habit Shift account." },
      { property: "og:title", content: "Sign in – Habit Shift" },
      { property: "og:description", content: "Sign in or sign up." },
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
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) { toast.error("Google sign-in failed"); return; }
    if (r.redirected) return;
    navigate({ to: "/map" });
  }

  const input = "w-full rounded-xl border bg-input/30 px-4 py-3 outline-none focus:ring-2 focus:ring-ring";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="text-4xl font-bold">{mode === "in" ? "Welcome back!" : "Let's begin"}</h1>
      <p className="mt-2 text-muted-foreground">{mode === "in" ? "Pick up where you left off." : "Create your account."}</p>

      {sent ? (
        <div className="mt-8 rounded-2xl bg-card p-5">
          <p className="font-semibold">Check your email!</p>
          <p className="mt-1 text-sm text-muted-foreground">We sent a confirmation link to {email}.</p>
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="mt-8 space-y-3">
            <input className={input} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={input} type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button disabled={busy} className="w-full rounded-xl bg-primary py-3 font-display text-lg font-semibold text-primary-foreground disabled:opacity-60">
              {mode === "in" ? "Sign in" : "Sign up"}
            </button>
          </form>
          <button onClick={google} className="mt-3 w-full rounded-xl border bg-card py-3 font-semibold">
            Continue with Google
          </button>
          <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-6 text-sm text-muted-foreground underline">
            {mode === "in" ? "No account yet? Sign up" : "Have an account? Sign in"}
          </button>
        </>
      )}
    </main>
  );
}
