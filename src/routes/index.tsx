import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Habit Shift – beat bad habits one field at a time" },
      { name: "description", content: "A playful map with one AI-made challenge per field. Checkpoints you never fall below." },
      { property: "og:title", content: "Habit Shift" },
      { property: "og:description", content: "A playful map for leaving bad habits behind." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const preview = [1, 2, 3, 4, 5, 6, 7];
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
      <p className="font-display text-lg text-primary">Habit Shift</p>
      <h1 className="mt-6 text-5xl font-bold leading-[1.05]">
        One field.<br />One challenge.<br /><span className="text-primary">A new you.</span>
      </h1>
      <p className="mt-5 text-muted-foreground">
        Move along the path like a game. Every 5th field is a checkpoint — progress behind it can never be taken away.
      </p>

      <div className="my-10 flex items-end justify-between">
        {preview.map((n) => {
          const cp = n === 5;
          const done = n < 4;
          return (
            <div
              key={n}
              style={{ marginBottom: `${Math.sin(n) * 18 + 18}px` }}
              className={`flex size-10 items-center justify-center rounded-full font-display font-bold ${
                cp ? "bg-checkpoint text-checkpoint-foreground node-checkpoint"
                : done ? "bg-primary text-primary-foreground"
                : n === 4 ? "bg-card ring-2 ring-primary node-current"
                : "bg-locked text-muted-foreground"
              }`}
            >
              {cp ? "🏁" : n}
            </div>
          );
        })}
      </div>

      <div className="mt-auto space-y-3">
        <Link to="/map" className="block rounded-2xl bg-primary py-4 text-center font-display text-lg font-semibold text-primary-foreground">
          Get started
        </Link>
        <p className="text-center text-xs text-muted-foreground">A motivation tool, not medical advice.</p>
      </div>
    </main>
  );
}
