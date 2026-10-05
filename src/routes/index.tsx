import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Szokásváltó – lépésről lépésre a rossz szokások ellen" },
      { name: "description", content: "Játékos térkép, mezőnként egy kihívás. Ellenőrzőpontok, ahonnan nincs visszaesés." },
      { property: "og:title", content: "Szokásváltó" },
      { property: "og:description", content: "Játékos térkép a rossz szokások elhagyásához." },
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
      <p className="font-display text-lg text-primary">Szokásváltó</p>
      <h1 className="mt-6 text-5xl font-bold leading-[1.05]">
        Egy mező.<br />Egy kihívás.<br /><span className="text-primary">Egy új te.</span>
      </h1>
      <p className="mt-5 text-muted-foreground">
        Haladj végig a pályán, mint egy játékban. Minden 5. mező ellenőrzőpont – ami onnan visszafelé van, azt már senki nem veheti el.
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
          Indulás
        </Link>
        <p className="text-center text-xs text-muted-foreground">Motivációs eszköz, nem orvosi tanács.</p>
      </div>
    </main>
  );
}
