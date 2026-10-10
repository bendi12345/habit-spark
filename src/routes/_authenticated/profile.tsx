import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Flame, Settings, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profil – Szokásváltó" }] }),
  component: Profile,
});

function Profile() {
  const { user } = Route.useRouteContext();
  const profile = useQuery({
    queryKey: ["profile-page", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("display_name, username, xp, szikra, pinned_badges").eq("id", user.id).maybeSingle();
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
  const attempts = useQuery({
    queryKey: ["completed-attempts", user.id],
    queryFn: async () => {
      const { count, error } = await supabase.from("challenge_attempts").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("outcome", "completed");
      if (error) throw error;
      return count ?? 0;
    },
  });
  const badges = useQuery({
    queryKey: ["profile-badges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("badges").select("code,name,description,rarity,hidden").order("sort");
      if (error) throw error;
      return data;
    },
  });
  const earned = useQuery({
    queryKey: ["earned-badges", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_badges").select("badge_code").eq("user_id", user.id);
      if (error) throw error;
      return new Set(data.map((badge) => badge.badge_code));
    },
  });

  const name = profile.data?.display_name || profile.data?.username || "Úton lévő";
  const level = Math.floor((profile.data?.xp ?? 0) / 200) + 1;
  const levelProgress = ((profile.data?.xp ?? 0) % 200) / 2;
  const visibleBadges = (badges.data ?? []).filter((badge) => !badge.hidden || earned.data?.has(badge.code));
  const pinned = profile.data?.pinned_badges ?? [];

  if ([profile, streak, attempts, badges, earned].some((query) => query.isError)) {
    return <main className="p-8 text-center text-destructive">Nem sikerült betölteni a profilodat. Frissítsd az oldalt, vagy próbáld újra később.</main>;
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-5 pb-28 pt-8 lg:pb-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">SZOKÁSVÁLTÓ</p>
          <h1 className="mt-1 text-3xl font-bold">Profil</h1>
        </div>
        <Link to="/settings" aria-label="Beállítások" className="rounded-xl border p-3"><Settings className="size-5" /></Link>
      </header>

      <section className="rounded-3xl border bg-card p-6 text-center">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-primary/15 font-display text-3xl font-bold text-primary">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <h2 className="mt-3 text-2xl font-bold">{name}</h2>
        <p className="text-sm text-muted-foreground">@{profile.data?.username ?? "felhasznalonev"}</p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat icon={<Award className="size-4" />} label="Szint" value={`${level}`} />
          <Stat icon={<Flame className="size-4 text-checkpoint" />} label="Sorozat" value={`${streak.data ?? 0} nap`} />
          <Stat icon={<Sparkles className="size-4 text-primary" />} label="Szikra" value={`${profile.data?.szikra ?? 0}`} />
        </div>
        <div className="mt-5 text-left">
          <div className="flex justify-between text-xs text-muted-foreground"><span>Szint {level}</span><span>{levelProgress}/100%</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, levelProgress))}%` }} /></div>
          <p className="mt-3 text-center text-sm text-muted-foreground">{attempts.data ?? 0} teljesített feladat</p>
        </div>
      </section>

      <section className="rounded-3xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Kitűzők</h2>
        <p className="mt-1 text-sm text-muted-foreground">A kitűzők emlékeztetnek arra, meddig jutottál.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleBadges.map((badge) => {
            const unlocked = earned.data?.has(badge.code) ?? false;
            return (
              <div key={badge.code} className={`rounded-2xl border p-3 ${unlocked ? "border-checkpoint/50 bg-checkpoint/10" : "bg-muted/50 opacity-60"}`}>
                <div className="flex items-center gap-2"><Award className={`size-5 ${unlocked ? "text-checkpoint" : "text-muted-foreground"}`} /><span className="text-xs font-semibold">{unlocked ? badge.name : "Még zárolva"}</span></div>
                <p className="mt-2 text-xs text-muted-foreground">{unlocked ? badge.description : `${badge.rarity} kitűző`}</p>
              </div>
            );
          })}
        </div>
        {(profile.data?.pinned_badges?.length ?? 0) > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">Kitűzött jelvények: {pinned.join(", ")}</p>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/settings" className="block rounded-2xl border bg-card p-4 text-center font-semibold">Profil és beállítások szerkesztése</Link>
        <Link to="/shop" className="block rounded-2xl border bg-card p-4 text-center font-semibold">Szikra bolt ✨</Link>
        <Link to="/history" className="block rounded-2xl border bg-card p-4 text-center font-semibold">Szikra előzmények</Link>
        <Link to="/questionnaire" className="block rounded-2xl border bg-card p-4 text-center font-semibold">Személyes kérdőív</Link>
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-background/50 p-3">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
      <p className="mt-2 font-display text-lg font-bold">{value}</p>
    </div>
  );
}
