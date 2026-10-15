import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Szikra előzmények – Szokásváltó" },
      { name: "description", content: "Minden megszerzett és elköltött Szikra és XP egy helyen." },
      { property: "og:title", content: "Szikra előzmények – Szokásváltó" },
      { property: "og:description", content: "Lásd, mit szereztél az egyes teljesített mezőkért." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: History,
});

function History() {
  const { user } = Route.useRouteContext();
  const ledger = useQuery({
    queryKey: ["szikra-ledger", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("szikra_ledger").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const rows = ledger.data ?? [];
  const earned = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const spent = rows.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);

  return (
    <main className="mx-auto max-w-lg space-y-5 px-4 pb-28 pt-6 lg:pl-60">
      <h1 className="font-display text-3xl font-bold">Szikra előzmények</h1>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Szerzett</p><p className="font-display text-2xl font-bold text-checkpoint">+{earned}</p></div>
        <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Elköltött</p><p className="font-display text-2xl font-bold">−{spent}</p></div>
      </div>
      <Link to="/shop" className="block text-sm text-muted-foreground underline">Irány a bolt</Link>
      {ledger.isError && <p className="text-destructive">Nem sikerült betölteni az előzményeket.</p>}
      {!ledger.isLoading && rows.length === 0 && <p className="text-muted-foreground">Még nincs bejegyzés. Teljesíts egy mezőt, és itt látod, mit kaptál!</p>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.reason}</p>
              <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("hu-HU")}</p>
            </div>
            <div className="text-right">
              <p className={`font-display font-bold ${r.amount >= 0 ? "text-checkpoint" : ""}`}>{r.amount >= 0 ? "+" : ""}{r.amount} ✨</p>
              {r.xp > 0 && <p className="text-xs text-primary">+{r.xp} XP</p>}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
