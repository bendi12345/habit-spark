import { Link } from "@tanstack/react-router";
import { Map, Plus, Settings } from "lucide-react";

export function BottomNav() {
  const item = "flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground";
  const active = { className: "text-primary" };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md">
        <Link to="/map" className={item} activeProps={active}><Map className="size-5" />Path</Link>
        <Link to="/onboarding" className={item} activeProps={active}><Plus className="size-5" />New habit</Link>
        <Link to="/settings" className={item} activeProps={active}><Settings className="size-5" />Settings</Link>
      </div>
    </nav>
  );
}
