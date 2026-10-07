import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings – Habit Shift" }] }),
  component: Settings,
});

function Settings() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="mx-auto max-w-md px-5 pb-28 pt-8">
      <h1 className="text-3xl font-bold">Settings</h1>
      <div className="mt-6 rounded-2xl bg-card p-5">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="font-semibold">{user.email}</p>
      </div>
      <div className="mt-4 rounded-2xl border border-checkpoint/40 bg-checkpoint/10 p-5">
        <h2 className="text-lg font-semibold text-checkpoint">Important</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Habit Shift is a personal motivation tool, <strong>not medical advice</strong>, and doesn’t replace professional care.
          For serious addiction or withdrawal risk, talk to a doctor or professional. In a crisis, call your local emergency number (<strong>112</strong> in Europe).
        </p>
      </div>
      <button onClick={signOut} className="mt-6 w-full rounded-2xl border py-4 font-semibold">Sign out</button>
      <BottomNav />
    </main>
  );
}
