import { Link } from "@tanstack/react-router";
import { Compass, Home, MessageCircle, Plus, Settings, ShieldUser, Users } from "lucide-react";

export function BottomNav() {
  const item = "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground lg:flex-none lg:justify-start lg:gap-3 lg:px-4 lg:py-3 lg:text-sm";
  const active = { className: "text-primary" };
  const links = [
    { to: "/home" as const, label: "Főoldal", icon: Home },
    { to: "/map" as const, label: "Út", icon: Compass },
    { to: "/coach" as const, label: "Coach", icon: MessageCircle },
    { to: "/friends" as const, label: "Barátok", icon: Users },
    { to: "/profile" as const, label: "Profil", icon: ShieldUser },
  ];
  return (
    <>
      <nav aria-label="Fő navigáció" className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg">
          {links.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={item} activeProps={active}>
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
          <Link to="/onboarding" aria-label="Új szokás" className={`${item} text-primary`}>
            <Plus className="size-5" />
            Új
          </Link>
        </div>
      </nav>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r bg-card/95 px-3 py-6 backdrop-blur lg:flex lg:flex-col">
        <Link to="/home" className="mb-8 px-4 font-display text-xl font-bold text-primary">Szokásváltó</Link>
        <nav aria-label="Fő navigáció" className="flex flex-col gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={item} activeProps={active}>
              <Icon className="size-5 shrink-0" />
              {label}
            </Link>
          ))}
          <Link to="/onboarding" className={item} activeProps={active}>
            <Plus className="size-5 shrink-0" />
            Új szokás
          </Link>
          <Link to="/settings" className={item} activeProps={active}>
            <Settings className="size-5 shrink-0" />
            Beállítások
          </Link>
        </nav>
      </aside>
      <div aria-hidden className="hidden h-0 lg:block" />
    </>
  );
}
