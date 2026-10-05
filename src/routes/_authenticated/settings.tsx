import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Beállítások – Szokásváltó" }] }),
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
      <h1 className="text-3xl font-bold">Beállítások</h1>
      <div className="mt-6 rounded-2xl bg-card p-5">
        <p className="text-sm text-muted-foreground">Bejelentkezve</p>
        <p className="font-semibold">{user.email}</p>
      </div>
      <div className="mt-4 rounded-2xl border border-checkpoint/40 bg-checkpoint/10 p-5">
        <h2 className="text-lg font-semibold text-checkpoint">Fontos tudnivaló</h2>
        <p className="mt-2 text-sm leading-relaxed">
          A Szokásváltó személyes motivációs eszköz, <strong>nem orvosi tanács</strong> és nem helyettesíti a szakszerű kezelést.
          Komoly függőség esetén fordulj orvoshoz vagy szakemberhez. Krízishelyzetben hívd a <strong>112</strong>-t.
        </p>
      </div>
      <button onClick={signOut} className="mt-6 w-full rounded-2xl border py-4 font-semibold">Kijelentkezés</button>
      <BottomNav />
    </main>
  );
}
