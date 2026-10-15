import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({
    meta: [
      { title: "Bolt – Szokásváltó" },
      { name: "description", content: "Váltsd be a megszerzett Szikrát megjelenési és hasznos tárgyakra." },
      { property: "og:title", content: "Bolt – Szokásváltó" },
      { property: "og:description", content: "Szikra bolt: tárgyak, amiket a haladásoddal szerzel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Shop,
});

function Shop() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const balance = useQuery({
    queryKey: ["szikra-balance", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("szikra").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data?.szikra ?? 0;
    },
  });
  const items = useQuery({
    queryKey: ["shop-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shop_items").select("*").order("sort");
      if (error) throw error;
      return data;
    },
  });
  const owned = useQuery({
    queryKey: ["user-items", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_items").select("item_code").eq("user_id", user.id);
      if (error) throw error;
      return data.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.item_code]: (acc[i.item_code] ?? 0) + 1 }), {});
    },
  });

  async function buy(code: string) {
    setBusy(code);
    const { data, error } = await supabase.rpc("buy_item", { _code: code });
    setBusy(null);
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || res?.ok === false) {
      toast.error(res?.error ?? error?.message ?? "Nem sikerült a vásárlás.");
      return;
    }
    toast.success("Megvetted! ✨");
    await Promise.all(["szikra-balance", "user-items", "szikra-ledger", "profile-page"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  }

  return (
    <main className="mx-auto max-w-lg space-y-5 px-4 pb-28 pt-6 lg:pl-60">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Bolt</h1>
        <div className="rounded-full border bg-card px-4 py-2 font-display font-bold text-checkpoint">{balance.data ?? "…"} ✨</div>
      </div>
      <Link to="/history" className="block text-sm text-muted-foreground underline">Szikra előzmények megtekintése</Link>
      {items.isError && <p className="text-destructive">Nem sikerült betölteni a boltot.</p>}
      <div className="grid gap-3">
        {(items.data ?? []).map((item) => {
          const count = owned.data?.[item.code] ?? 0;
          const tooPoor = (balance.data ?? 0) < item.price;
          return (
            <div key={item.code} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
              <span className="text-3xl">{item.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
                {count > 0 && <p className="mt-1 text-xs text-primary">Birtokolt: {count}</p>}
                {item.monthly_limit && <p className="text-xs text-muted-foreground">Havi limit: {item.monthly_limit}</p>}
              </div>
              <button
                disabled={tooPoor || busy === item.code}
                onClick={() => buy(item.code)}
                className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                {item.price} ✨
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
