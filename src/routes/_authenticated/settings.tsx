import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { clearInstallPrompt, getInstallPrompt, type InstallPromptEvent } from "@/lib/pwa-install";

type Preferences = {
  coachTone: "friendly" | "mentor" | "direct";
  sound: boolean;
  reducedMotion: boolean;
  quietHours: boolean;
  quietFrom: string;
  quietTo: string;
};

const preferenceKey = "habit-shift-preferences";
const defaultPreferences: Preferences = {
  coachTone: "friendly",
  sound: false,
  reducedMotion: false,
  quietHours: false,
  quietFrom: "22:00",
  quietTo: "08:00",
};

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Beállítások – Szokásváltó" }] }),
  component: Settings,
});

function Settings() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [newEmail, setNewEmail] = useState(user.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [busy, setBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.display_name ?? "");
    setUsername(profile.data.username ?? "");
  }, [profile.data]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(preferenceKey);
      if (saved) {
        setPreferences(parsePreferences(saved));
      }
    } catch {
      toast.error("A beállításokat nem sikerült beolvasni.");
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset["reducedMotion"] = String(preferences.reducedMotion);
  }, [preferences.reducedMotion]);

  useEffect(() => {
    const updatePrompt = () => setInstallPrompt(getInstallPrompt());
    updatePrompt();
    window.addEventListener("pwa-install-available", updatePrompt);
    return () => window.removeEventListener("pwa-install-available", updatePrompt);
  }, []);

  async function saveProfile() {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null,
      username: username.trim().toLowerCase() || null,
    }).eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(`Nem sikerült menteni a profilt: ${error.message}`);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["profile", user.id] });
    toast.success("A profilod elmentve.");
  }

  function updatePreferences(patch: Partial<Preferences>) {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(preferenceKey, JSON.stringify(next));
      } catch (error) {
        toast.error(`Nem sikerült menteni a beállítást: ${error instanceof Error ? error.message : "ismeretlen hiba"}`);
      }
      return next;
    });
  }

  async function updateEmail() {
    if (!newEmail.trim() || newEmail === user.email) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setBusy(false);
    if (error) {
      toast.error(`Nem sikerült módosítani az e-mail-címet: ${error.message}`);
      return;
    }
    toast.success("A módosítás megerősítéséhez ellenőrizd az e-mailjeidet.");
  }

  async function updatePassword() {
    if (newPassword.length < 8) {
      toast.error("A jelszónak legalább 8 karakter hosszúnak kell lennie.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) {
      toast.error(`Nem sikerült módosítani a jelszót: ${error.message}`);
      return;
    }
    setNewPassword("");
    toast.success("A jelszavad frissült.");
  }

  async function exportData() {
    setBusy(true);
    const [habits, attempts, difficultyHistory, ledger, rewards, profileData] = await Promise.all([
      supabase.from("habits").select("*"),
      supabase.from("challenge_attempts").select("*"),
      supabase.from("difficulty_history").select("*"),
      supabase.from("szikra_ledger").select("*"),
      supabase.from("custom_rewards").select("*"),
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    ]);
    setBusy(false);
    const failure = [habits, attempts, difficultyHistory, ledger, rewards, profileData].find((result) => result.error);
    if (failure?.error) {
      toast.error(`Nem sikerült exportálni az adataidat: ${failure.error.message}`);
      return;
    }

    const habitIds = (habits.data ?? []).map((habit) => habit.id);
    const fields = habitIds.length
      ? await supabase.from("fields").select("*").in("habit_id", habitIds)
      : { data: [], error: null };
    if (fields.error) {
      toast.error(`Nem sikerült exportálni az útvonalfeladatokat: ${fields.error.message}`);
      return;
    }

    const blob = new Blob([JSON.stringify({
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email },
      profile: profileData.data,
      habits: habits.data,
      fields: fields.data,
      challengeAttempts: attempts.data,
      difficultyHistory: difficultyHistory.data,
      szikraLedger: ledger.data,
      customRewards: rewards.data,
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "szokasvalto-adataim.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Az adatexport elkészült.");
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(`Nem sikerült kijelentkezni: ${error.message}`);
      return;
    }
    navigate({ to: "/auth", replace: true });
  }

  async function installApp() {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      clearInstallPrompt();
      setInstallPrompt(null);
    } catch (error) {
      toast.error(`Nem sikerült elindítani a telepítést: ${error instanceof Error ? error.message : "ismeretlen hiba"}`);
    }
  }

  const inputClass = "mt-1 w-full rounded-xl border bg-input/30 px-4 py-3";

  return (
    <main className="mx-auto max-w-md space-y-5 px-5 pb-28 pt-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Szokásváltó</p>
          <h1 className="text-3xl font-bold">Beállítások</h1>
        </div>
        <Link to="/map" className="rounded-full border px-3 py-2 text-sm">Vissza az útra</Link>
      </header>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Profil</h2>
        <label className="mt-4 block text-sm font-medium">
          Megjelenített név
          <input className={inputClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Felhasználónév
          <input className={inputClass} value={username} onChange={(event) => setUsername(event.target.value)} maxLength={30} autoCapitalize="none" />
        </label>
        <button disabled={busy || profile.isLoading} onClick={saveProfile} className="mt-4 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50">
          Profil mentése
        </button>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Fiók</h2>
        <label className="mt-4 block text-sm font-medium">
          E-mail-cím
          <input className={inputClass} type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} autoComplete="email" />
        </label>
        <button disabled={busy || newEmail === user.email} onClick={updateEmail} className="mt-3 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50">
          E-mail módosítása
        </button>
        <label className="mt-4 block text-sm font-medium">
          Új jelszó
          <input className={inputClass} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
        </label>
        <button disabled={busy || newPassword.length < 8} onClick={updatePassword} className="mt-3 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50">
          Jelszó módosítása
        </button>
        <button disabled={busy} onClick={exportData} className="mt-4 w-full rounded-xl border py-3 font-semibold disabled:opacity-50">
          Adataim letöltése
        </button>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Alkalmazás</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Telepítsd a Szokásváltót az eszközödre. A személyes oldalak és adatok nem kerülnek az offline gyorsítótárba.
        </p>
        {installPrompt ? (
          <button onClick={installApp} className="mt-4 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">
            Alkalmazás telepítése
          </button>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Ha a böngésződ támogatja, a telepítési lehetőség a böngésző menüjében jelenik meg.
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Személyes beállítások</h2>
        <label className="block text-sm font-medium">
          Coach hangneme
          <select className={inputClass} value={preferences.coachTone} onChange={(event) => updatePreferences({ coachTone: parseCoachTone(event.target.value) })}>
            <option value="friendly">Barátságos társ</option>
            <option value="mentor">Bölcs mentor</option>
            <option value="direct">Egyenes, határozott</option>
          </select>
        </label>
        <Toggle label="Hanghatások" checked={preferences.sound} onChange={(checked) => updatePreferences({ sound: checked })} />
        <Toggle label="Mozgáscsökkentés" checked={preferences.reducedMotion} onChange={(checked) => updatePreferences({ reducedMotion: checked })} />
        <Toggle label="Csendes időszak (értesítésekhez)" checked={preferences.quietHours} onChange={(checked) => updatePreferences({ quietHours: checked })} />
        {preferences.quietHours && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Kezdete<input className={inputClass} type="time" value={preferences.quietFrom} onChange={(event) => updatePreferences({ quietFrom: event.target.value })} /></label>
            <label className="text-sm">Vége<input className={inputClass} type="time" value={preferences.quietTo} onChange={(event) => updatePreferences({ quietTo: event.target.value })} /></label>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Ezek a beállítások ezen az eszközön tárolódnak.</p>
      </section>

      <section className="rounded-2xl border border-checkpoint/40 bg-checkpoint/10 p-5">
        <h2 className="text-lg font-semibold text-checkpoint">Fontos tudnivaló</h2>
        <p className="mt-2 text-sm leading-relaxed">
          A Szokásváltó személyes motivációs eszköz, <strong>nem egészségügyi tanácsadás</strong>, és nem helyettesíti a szakellátást.
          Komoly függőség vagy megvonási kockázat esetén beszélj orvossal vagy szakemberrel. Közvetlen veszélyben hívd a <strong>112</strong>-t.
        </p>
      </section>

      <button onClick={signOut} className="w-full rounded-2xl border py-4 font-semibold">Kijelentkezés</button>
    </main>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-5 accent-primary" />
    </label>
  );
}

function parsePreferences(serialized: string): Preferences {
  const parsed: unknown = JSON.parse(serialized);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("A beállítások formátuma érvénytelen.");
  }
  const record = parsed as Record<string, unknown>;
  return {
    coachTone: parseCoachTone(typeof record["coachTone"] === "string" ? record["coachTone"] : "friendly"),
    sound: typeof record["sound"] === "boolean" ? record["sound"] : defaultPreferences.sound,
    reducedMotion: typeof record["reducedMotion"] === "boolean" ? record["reducedMotion"] : defaultPreferences.reducedMotion,
    quietHours: typeof record["quietHours"] === "boolean" ? record["quietHours"] : defaultPreferences.quietHours,
    quietFrom: typeof record["quietFrom"] === "string" ? record["quietFrom"] : defaultPreferences.quietFrom,
    quietTo: typeof record["quietTo"] === "string" ? record["quietTo"] : defaultPreferences.quietTo,
  };
}

function parseCoachTone(value: string): Preferences["coachTone"] {
  if (value === "mentor" || value === "direct") return value;
  return "friendly";
}
