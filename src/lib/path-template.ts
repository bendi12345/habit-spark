// Hardcoded starter path (AI generation will replace this later).
// Sawtooth: inside each 5-field block difficulty ramps easy -> hard,
// the next block restarts easy, and the baseline slowly rises.

export type HabitKey = "smoking" | "energy" | "scrolling" | "junkfood" | "other";

export const HABITS: { key: HabitKey; name: string; emoji: string; hint: string }[] = [
  { key: "smoking", name: "Dohányzás", emoji: "🚭", hint: "Cigaretta, e-cigi, hevítős dohány" },
  { key: "energy", name: "Energiaital", emoji: "⚡", hint: "Napi dobozok, koffeinfüggés" },
  { key: "scrolling", name: "Doomscrolling", emoji: "📱", hint: "Végtelen görgetés, esti telefon" },
  { key: "junkfood", name: "Gyorskaja", emoji: "🍟", hint: "Nassolás, rendelés, cukor" },
  { key: "other", name: "Saját szokás", emoji: "✨", hint: "Bármi más, amit elengednél" },
];

type Tier = [string, string][]; // [title, description]
// 5 tiers (block position 1..5), 2 variants each that rotate across blocks.
const T: Record<HabitKey, Tier[]> = {
  smoking: [
    [["Tudatos szál", "Mielőtt rágyújtasz, várj 2 percet és írd le, miért most."], ["Vizes reggel", "Az első cigi előtt igyál meg egy pohár vizet."]],
    [["Késleltetés", "Tolj el minden cigit 10 perccel."], ["Füstmentes szoba", "Válassz egy helyet, ahol ma egyáltalán nem gyújtasz rá."]],
    [["Egy szállal kevesebb", "Szívj ma eggyel kevesebbet, mint tegnap."], ["Kávé cigi nélkül", "Idd meg a mai kávédat cigaretta nélkül."]],
    [["Fél nap tisztán", "Délig ne gyújts rá."], ["Séta helyett", "A sóvárgás első három hullámánál menj inkább 5 perc sétára."]],
    [["Füstmentes nap", "Egy teljes nap cigaretta nélkül."], ["Este tisztán", "18 órától lefekvésig egy szálat se."]],
  ],
  energy: [
    [["Mai doboz tudatosan", "Írd fel, mikor és miért nyúlsz az energiaitalhoz."], ["Víz előtte", "Minden doboz előtt igyál egy pohár vizet."]],
    [["Kisebb adag", "Ma csak fél dobozt igyál meg egyszerre."], ["Délutáni szünet", "14 óra után ne igyál energiaitalt."]],
    [["Csere", "Az egyik dobozt cseréld zöld teára vagy kávéra."], ["Eggyel kevesebb", "Igyál ma eggyel kevesebbet, mint tegnap."]],
    [["Fél nap nélküle", "Délig ne igyál energiaitalt."], ["Bolt kihagyva", "Ma ne vegyél energiaitalt, csak ami otthon van."]],
    [["Energiaital-mentes nap", "Egy teljes nap egy doboz nélkül."], ["Hűtő ürítés", "Ne legyen ma energiaital a hűtődben, és ne is igyál."]],
  ],
  scrolling: [
    [["Időmérés", "Nézd meg a mai képernyőidődet, és írd fel."], ["Értesítés-diéta", "Kapcsold ki egy app értesítéseit."]],
    [["Reggeli szünet", "Ébredés után 15 percig ne nyúlj a telefonhoz."], ["Szürkeárnyalat", "Állítsd a kijelzőt fekete-fehérre 2 órára."]],
    [["Ágy telefon nélkül", "Lefekvés előtt 30 perccel tedd le a telefont."], ["Egy app ki", "Töröld le a kezdőképernyőről a leggörgetősebb appot."]],
    [["Görgetésmentes délután", "12 és 18 óra között ne görgess közösségi médiát."], ["Időkorlát", "Állíts be napi 30 perces limitet és tartsd be."]],
    [["Offline este", "18 órától csak hívásra/üzenetre használd a telefont."], ["Közösségi média-mentes nap", "Egy teljes nap görgetés nélkül."]],
  ],
  junkfood: [
    [["Étkezési napló", "Írd fel ma mindent, amit nassolsz."], ["Víz a nasi előtt", "Minden nasi előtt igyál egy pohár vizet."]],
    [["Gyümölcs csere", "Egy nasit cserélj gyümölcsre."], ["Lassú evés", "A mai nasit ülve, lassan, telefon nélkül edd meg."]],
    [["Rendelésmentes nap", "Ma ne rendelj kaját."], ["Cukormentes délután", "15 óra után ne egyél édességet."]],
    [["Bevásárlás lista szerint", "Csak listáról vásárolj, nasi nélkül."], ["Házi vacsora", "Főzz ma valami egyszerűt magadnak."]],
    [["Nasimentes nap", "Egy teljes nap gyorskaja és nasi nélkül."], ["Esti tisztaság", "Vacsora után semmi nassolás."]],
  ],
  other: [
    [["Megfigyelés", "Írd le háromszor, mikor és miért jön a késztetés."], ["Kiváltó ok", "Azonosíts egy helyzetet, ami beindítja a szokást."]],
    [["10 perc késleltetés", "Minden késztetésnél várj 10 percet."], ["Pótcselekvés", "Válassz egy egészséges pótcselekvést és próbáld ki egyszer."]],
    [["Eggyel kevesebb", "Ma egy alkalommal kevesebbszer engedj a szokásnak."], ["Akadály", "Nehezítsd meg a hozzáférést (tedd el, töröld, zárd el)."]],
    [["Fél nap nélküle", "Délig egyáltalán ne."], ["Kritikus időszak", "A legnehezebb napszakodban tartsd magad."]],
    [["Tiszta nap", "Egy teljes nap a szokás nélkül."], ["Tiszta este", "Estétől lefekvésig egyszer se."]],
  ],
};

export function difficultyFor(position: number, intensity: number) {
  const block = Math.floor((position - 1) / 5);
  const step = (position - 1) % 5;
  const base = 0.5 + intensity * 0.5 + block * 0.35; // slow rise across blocks
  const d = Math.round(base + step * 1.4);
  // keep relief: first field of a block is always clearly below the previous peak
  return Math.max(1, Math.min(10, step === 0 ? Math.min(d, 6) : d));
}

export function buildTemplate(habit: HabitKey, intensity: number, count = 40) {
  return Array.from({ length: count }, (_, i) => {
    const position = i + 1;
    const block = Math.floor(i / 5);
    const step = i % 5;
    const [title, description] = T[habit][step][block % 2];
    const isCheckpoint = position % 5 === 0;
    return {
      position,
      title: isCheckpoint ? `🏁 ${title}` : title,
      description,
      difficulty: difficultyFor(position, intensity),
      is_checkpoint: isCheckpoint,
      status: position === 1 ? "current" : "locked",
    };
  });
}
