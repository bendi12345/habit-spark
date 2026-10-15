import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Check,
  Flame,
  Heart,
  Home,
  LockKeyhole,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  clearDemoProgress,
  isDevDemoEnabled,
  readDemoProgress,
  writeDemoProgress,
  type DemoProgress,
} from "@/lib/dev-demo";
import {
  clearDemoQuestionnaire,
  isQuestionAnswered,
  localizeQuestion,
  localizeQuestionOption,
  parseQuestionnaire,
  questionnairePrompt,
  QUESTIONNAIRE_QUESTIONS,
  readDemoQuestionnaire,
  writeDemoQuestionnaire,
  type QuestionnaireAnswer,
} from "@/lib/questionnaire";
import {
  clearDemoDifficultyRatings,
  readDemoDifficultyRatings,
  writeDemoDifficultyRatings,
  type DifficultyRatings,
} from "@/lib/difficulty-rating";
import {
  clearDemoProofs,
  readDemoProofs,
  removeDemoProof,
  writeDemoProofs,
  type DemoProof,
  type ProofType,
} from "@/lib/field-proof";
import { proofTypeForDifficulty } from "@/lib/path-generation";

type Section = "path" | "new-habit" | "questionnaire" | "friends" | "duels" | "settings";
type Language = "en" | "hu";
const DEMO_FIELD_DIFFICULTIES = [2, 4, 6, 8, 9, 3, 7] as const;

const languageStorageKey = "habit-shift-dev-demo-language";
const soundStorageKey = "habit-shift-dev-demo-sound";
const copy = {
  en: {
    preview: "Development preview · sample data only",
    previewDescription:
      "This is the app's local preview. Changes stay in this browser; nothing syncs to an account, Supabase, friends, or real Szikra balances.",
    titles: {
      path: "Your path",
      "new-habit": "New habit",
      questionnaire: "Questionnaire",
      friends: "Friends & groups",
      duels: "Duels",
      settings: "Settings",
    },
    nav: {
      path: "Path",
      "new-habit": "New habit",
      questionnaire: "Questionnaire",
      friends: "Friends",
      duels: "Duels",
      settings: "Settings",
    },
    reset: "Reset",
    resetTitle: "Clear local demo progress",
    sound: "Sound effects",
    soundOn: "Sound on",
    soundOff: "Sound off",
    celebrateTitle: "Checkpoint reached!",
    celebrateMessage: "You showed up for yourself. Your progress is yours to keep.",
    celebrateClose: "Continue",
    personalPath: "Your personal path",
    level: "Level",
    fieldsComplete: "fields complete",
    streak: (days: number) => `${days} day streak`,
    checkpoint: "Checkpoint",
    newPath: "Start a personal path",
    newPathDescription:
      "In the real app, tell us the habit you want to change and we'll help break it into small, manageable steps.",
    habitQuestion: "What would you like to work on?",
    habitPlaceholder: "e.g. a calmer evening routine",
    createPath: "Create sample path",
    questionnaireDescription:
      "Answer at your own pace. Your draft is saved only in this browser and never sent to Supabase.",
    questionnaireOptional: "Optional — you can skip this question.",
    questionnaireSave: "Saved locally",
    questionnaireComplete: "Questionnaire complete",
    questionnaireCompleteNote: "You can revisit and change your answers at any time.",
    questionnaireBack: "Back",
    questionnaireNext: "Next",
    questionnaireFinish: "Finish",
    questionnaireSkip: "Skip",
    questionnairePlaceholder: "Write in your own words…",
    questionnaireLow: "A little",
    questionnaireHigh: "A lot",
    questionnaireProgress: (step: number, total: number) => `Question ${step} of ${total}`,
    questionnaireEntry: "Open the personal questionnaire",
    questionnaireEntryComplete: "Your local questionnaire is complete.",
    questionnaireEntryDraft: "Your local answers are saved in this browser.",
    rateDifficulty: "How difficult was that step?",
    ratingDescription: "This local rating does not change your rewards or path.",
    ratingSkip: "Skip",
    ratingSaved: "Rating saved locally",
    ratingEasy: "Easy",
    ratingHard: "Hard",
    proofPrompt: "Simulated proof of completion",
    proofDisclaimer:
      "Preview only: no proof is reviewed or uploaded. Completing this sample step is simulated.",
    proofHonor: "Confirm that you completed this step",
    proofReflection: "Write a short reflection (at least 10 characters)",
    proofPhoto: "Choose a sample photo (only its filename is stored locally)",
    proofSubmit: "Submit simulated proof",
    proofCancel: "Cancel",
    proofPending: "Simulated locally · not reviewed",
    proofError: "Add the required reflection or choose a sample photo.",
    previewNote:
      "Preview note: this creates a local sample title only. AI path generation and cloud saving require sign-in.",
    levelStreak: "Level 6 · 8 day streak",
    pinnedBadge: "Steady steps",
    addFriend: "Add friend",
    friendAdded: "Friend added ✓",
    cheer: "Cheer",
    cheered: "Cheered",
    groupStreak: "4 members · shared streak 3",
    youPreview: "You (preview)",
    joinGroup: "Join sample group",
    joinedGroup: "Joined sample group ✓",
    friendsNote:
      "Sample friends and group data only. Real invites, activity, and peer confirmations need an account and deployed backend.",
    friendlyChallenge: "Friendly challenge",
    duelDetails: "Luca · 3 days · difficulty 6/10",
    yourChallenge: "Your challenge",
    opponentProgress: "Opponent's progress",
    inProgress: "In progress · private proof",
    acceptChallenge: "Accept sample challenge",
    acceptedChallenge: "Challenge accepted ✓",
    virtualSzikra:
      "Szikra shown here is virtual only. This sample duel does not lock, transfer, or award any real or account balance.",
    previewProfile: "Preview profile",
    notSignedIn: "Not signed in · data stays in this browser",
    saveReminder: "Toggle sample reminder preference",
    reminderSaved: "Reminder preference saved locally ✓",
    privacyTitle: "Privacy in preview",
    privacyDescription:
      "Your sample progress is stored in local browser storage only. Reset clears this demo's progress.",
    clearData: "Clear preview data",
    realAccount: "Looking for your real account?",
    signIn: "Go to sign in",
    fields: [
      [
        "Notice your usual evening trigger",
        "Take a moment to notice what tends to lead into the habit you want to change.",
      ],
      [
        "Try a five-minute pause",
        "When the urge shows up, pause for five minutes and notice how it changes.",
      ],
      [
        "Choose a small replacement",
        "Pick one gentle activity that can make this part of your evening feel easier.",
      ],
      [
        "Reflect on what helped",
        "Write down one thing that supported you, even if the day was imperfect.",
      ],
      ["Your first checkpoint", "Celebrate showing up for yourself. Progress is yours to keep."],
      [
        "Make the next evening easier",
        "Choose one small change that supports the routine you want.",
      ],
      ["Build on what worked", "Repeat a helpful choice and notice how it feels today."],
    ],
  },
  hu: {
    preview: "Fejlesztői előnézet · csak próbaadatok",
    previewDescription:
      "Ez az alkalmazás helyi előnézete. A változások csak ebben a böngészőben maradnak; nem szinkronizálódnak fiókkal, Supabase-szel, barátokkal vagy valódi Szikra-egyenleggel.",
    titles: {
      path: "Saját utad",
      "new-habit": "Új szokás",
      questionnaire: "Kérdőív",
      friends: "Barátok és csoportok",
      duels: "Párbajok",
      settings: "Beállítások",
    },
    nav: {
      path: "Út",
      "new-habit": "Új szokás",
      questionnaire: "Kérdőív",
      friends: "Barátok",
      duels: "Párbaj",
      settings: "Beállítások",
    },
    reset: "Visszaállítás",
    resetTitle: "Helyi próbaadatok törlése",
    sound: "Hanghatások",
    soundOn: "Hang be",
    soundOff: "Hang ki",
    celebrateTitle: "Elérted az ellenőrzőpontot!",
    celebrateMessage: "Tettél magadért. Az elért haladás a tiéd marad.",
    celebrateClose: "Tovább",
    personalPath: "Személyes utad",
    level: "Szint",
    fieldsComplete: "mező teljesítve",
    streak: (days: number) => `${days} napos sorozat`,
    checkpoint: "Ellenőrzőpont",
    newPath: "Indíts személyes utat",
    newPathDescription:
      "A valódi alkalmazásban elmondhatod, min szeretnél változtatni, és segítünk apró, teljesíthető lépésekre bontani.",
    habitQuestion: "Min szeretnél dolgozni?",
    habitPlaceholder: "pl. nyugodtabb esti rutin",
    createPath: "Mintaút létrehozása",
    questionnaireDescription:
      "Válaszolj a saját tempódban. A piszkozat csak ebben a böngészőben tárolódik, és nem kerül Supabase-be.",
    questionnaireOptional: "Kihagyható kérdés — továbbléphetsz válasz nélkül.",
    questionnaireSave: "Helyben elmentve",
    questionnaireComplete: "A kérdőív kitöltve",
    questionnaireCompleteNote: "Bármikor visszatérhetsz, és módosíthatod a válaszaidat.",
    questionnaireBack: "Vissza",
    questionnaireNext: "Tovább",
    questionnaireFinish: "Befejezés",
    questionnaireSkip: "Kihagyás",
    questionnairePlaceholder: "Írd le a saját szavaiddal…",
    questionnaireLow: "Kevéssé",
    questionnaireHigh: "Nagyon",
    questionnaireProgress: (step: number, total: number) => `${step}. kérdés / ${total}`,
    questionnaireEntry: "Személyes kérdőív megnyitása",
    questionnaireEntryComplete: "A helyi kérdőívet kitöltötted.",
    questionnaireEntryDraft: "A válaszaid ebben a böngészőben vannak elmentve.",
    rateDifficulty: "Mennyire volt nehéz ez a lépés?",
    ratingDescription: "Ez a helyi értékelés nem változtatja meg a jutalmad vagy az utad.",
    ratingSkip: "Kihagyás",
    ratingSaved: "Értékelés helyben elmentve",
    ratingEasy: "Könnyű",
    ratingHard: "Nehéz",
    proofPrompt: "A teljesítés szimulált igazolása",
    proofDisclaimer:
      "Csak előnézet: az igazolást nem ellenőrizzük és nem töltjük fel. A feladat teljesítése szimulált.",
    proofHonor: "Megerősítem, hogy teljesítettem ezt a feladatot",
    proofReflection: "Írj rövid reflexiót (legalább 10 karakter)",
    proofPhoto: "Válassz mintaképet (csak a fájlnév mentődik helyben)",
    proofSubmit: "Szimulált igazolás elküldése",
    proofCancel: "Mégse",
    proofPending: "Helyben szimulálva · nincs ellenőrizve",
    proofError: "Írd meg a reflexiót, vagy válassz mintaképet.",
    previewNote:
      "Előnézeti megjegyzés: ez csak egy helyi mintacímet hoz létre. Az AI-útvonaltervezéshez és a felhőmentéshez bejelentkezés kell.",
    levelStreak: "6. szint · 8 napos sorozat",
    pinnedBadge: "Kitartó lépések",
    addFriend: "Barát hozzáadása",
    friendAdded: "Barát hozzáadva ✓",
    cheer: "Biztatás",
    cheered: "Biztattad ✓",
    groupStreak: "4 tag · közös sorozat: 3",
    youPreview: "Te (előnézet)",
    joinGroup: "Csatlakozás a mintacsoporthoz",
    joinedGroup: "Csatlakoztál a mintacsoporthoz ✓",
    friendsNote:
      "Csak minta barátok és csoportadatok. Valódi meghívókhoz, aktivitáshoz és társas megerősítéshez fiók és telepített háttérrendszer szükséges.",
    friendlyChallenge: "Baráti kihívás",
    duelDetails: "Luca · 3 nap · nehézség: 6/10",
    yourChallenge: "A te kihívásod",
    opponentProgress: "Ellenfeled haladása",
    inProgress: "Folyamatban · a bizonyíték privát",
    acceptChallenge: "Mintapárbaj elfogadása",
    acceptedChallenge: "Kihívás elfogadva ✓",
    virtualSzikra:
      "Az itt látható Szikra csak virtuális. Ez a mintapárbaj nem zárol, nem utal át és nem ad valódi vagy fiókhoz kötött egyenleget.",
    previewProfile: "Előnézeti profil",
    notSignedIn: "Nincs bejelentkezve · az adatok ebben a böngészőben maradnak",
    saveReminder: "Mintaemlékeztető beállításának váltása",
    reminderSaved: "Emlékeztető-beállítás helyben elmentve ✓",
    privacyTitle: "Adatvédelem az előnézetben",
    privacyDescription:
      "A mintaelőrehaladás csak a böngésző helyi tárhelyén tárolódik. A visszaállítás törli az előnézet adatait.",
    clearData: "Előnézeti adatok törlése",
    realAccount: "A valódi fiókodat keresed?",
    signIn: "Tovább a bejelentkezéshez",
    fields: [
      [
        "Vedd észre a megszokott esti kiváltó okot",
        "Figyeld meg, mi szokott elvezetni ahhoz a szokáshoz, amin változtatni szeretnél.",
      ],
      [
        "Tarts öt perc szünetet",
        "Amikor jelentkezik a késztetés, állj meg öt percre, és figyeld meg, hogyan változik.",
      ],
      [
        "Válassz egy apró helyettesítő tevékenységet",
        "Válassz egy kíméletes tevékenységet, amitől könnyebb lehet az estéd.",
      ],
      [
        "Gondold át, mi segített",
        "Írj le egy dolgot, ami támogatott, akkor is, ha nem volt tökéletes a nap.",
      ],
      [
        "Az első ellenőrzőpontod",
        "Ünnepeld meg, hogy tettél magadért. Az elért haladás a tiéd marad.",
      ],
      [
        "Tedd könnyebbé a következő estét",
        "Válassz egy apró változtatást, ami segít a kívánt rutin kialakításában.",
      ],
      [
        "Építs arra, ami bevált",
        "Ismételj meg egy hasznos lépést, és figyeld meg, milyen érzés ma.",
      ],
    ],
  },
} as const;

function playDemoSound(enabled: boolean, checkpoint = false) {
  if (!enabled || typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const notes = checkpoint ? [523.25, 659.25, 783.99] : [587.33];
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.12;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.24);
  });
  window.setTimeout(() => void context.close(), 800);
}

export const Route = createFileRoute("/demo")({
  ssr: false,
  beforeLoad: () => {
    if (!isDevDemoEnabled(import.meta.env.DEV)) throw redirect({ to: "/auth" });
  },
  component: DemoPage,
});

function DemoPage() {
  const [section, setSection] = useState<Section>("path");
  const [language, setLanguage] = useState<Language>("en");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [progress, setProgress] = useState<DemoProgress>({ completedFields: [] });
  const [loaded, setLoaded] = useState(false);
  const [habitName, setHabitName] = useState("A calmer evening");
  const [newHabit, setNewHabit] = useState("");
  const [friendAdded, setFriendAdded] = useState(false);
  const [groupJoined, setGroupJoined] = useState(false);
  const [cheered, setCheered] = useState(false);
  const [duelAccepted, setDuelAccepted] = useState(false);
  const [settingSaved, setSettingSaved] = useState(false);
  const [questionnaire, setQuestionnaire] = useState(() => parseQuestionnaire(null));
  const [difficultyRatings, setDifficultyRatings] = useState<DifficultyRatings>({});
  const [ratingField, setRatingField] = useState<number | null>(null);
  const [proofs, setProofs] = useState<DemoProof[]>([]);
  const [proofField, setProofField] = useState<number | null>(null);
  const [proofText, setProofText] = useState("");
  const [proofFileName, setProofFileName] = useState("");
  const [honorConfirmed, setHonorConfirmed] = useState(false);
  const [proofError, setProofError] = useState(false);
  const completed = new Set(progress.completedFields);
  const t = copy[language];

  useEffect(() => {
    setProgress(readDemoProgress(window.localStorage));
    setQuestionnaire(readDemoQuestionnaire(window.localStorage));
    setDifficultyRatings(readDemoDifficultyRatings(window.localStorage));
    setProofs(readDemoProofs(window.localStorage));
    const savedLanguage = window.localStorage.getItem(languageStorageKey);
    if (savedLanguage === "en" || savedLanguage === "hu") setLanguage(savedLanguage);
    setSoundEnabled(window.localStorage.getItem(soundStorageKey) === "true");
    setLoaded(true);
  }, []);

  function chooseLanguage(next: Language) {
    setLanguage(next);
    window.localStorage.setItem(languageStorageKey, next);
    playDemoSound(soundEnabled);
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    window.localStorage.setItem(soundStorageKey, String(next));
    playDemoSound(next);
  }

  function toggleField(field: number) {
    const next = new Set(progress.completedFields);
    const wasComplete = next.has(field);
    if (!wasComplete) {
      setProofField(field);
      setProofText("");
      setProofFileName("");
      setHonorConfirmed(false);
      setProofError(false);
      return;
    }
    next.delete(field);
    const nextProgress = { completedFields: [...next].sort((a, b) => a - b) };
    writeDemoProgress(window.localStorage, nextProgress);
    setProgress(nextProgress);
    const nextProofs = removeDemoProof(proofs, field);
    writeDemoProofs(window.localStorage, nextProofs);
    setProofs(nextProofs);
    const nextRatings = { ...difficultyRatings };
    delete nextRatings[field];
    writeDemoDifficultyRatings(window.localStorage, nextRatings);
    setDifficultyRatings(nextRatings);
    setRatingField(null);
  }

  function submitDemoProof(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (proofField === null) return;
    const proofType: ProofType = proofTypeForDifficulty(
      DEMO_FIELD_DIFFICULTIES[proofField - 1] ?? 5,
    );
    let value = "";
    if (proofType === "honor") {
      if (!honorConfirmed) {
        setProofError(true);
        return;
      }
      value = "Simulated self-report";
    } else if (proofType === "reflection") {
      value = proofText.trim();
      if (value.length < 10 || value.length > 2000) {
        setProofError(true);
        return;
      }
    } else {
      value = proofFileName;
      if (!value) {
        setProofError(true);
        return;
      }
    }
    const entry: DemoProof = {
      position: proofField,
      type: proofType,
      value,
      submittedAt: new Date().toISOString(),
    };
    const nextProofs = [...removeDemoProof(proofs, proofField), entry];
    writeDemoProofs(window.localStorage, nextProofs);
    setProofs(nextProofs);
    const nextProgress = {
      completedFields: [...new Set([...progress.completedFields, proofField])].sort(
        (a, b) => a - b,
      ),
    };
    writeDemoProgress(window.localStorage, nextProgress);
    setProgress(nextProgress);
    const checkpoint = proofField % 5 === 0;
    setProofField(null);
    setProofText("");
    setProofFileName("");
    setProofError(false);
    setRatingField(proofField);
    playDemoSound(soundEnabled, checkpoint);
    if (checkpoint) setShowCheckpoint(true);
  }

  function resetDemo() {
    clearDemoProgress(window.localStorage);
    clearDemoQuestionnaire(window.localStorage);
    clearDemoDifficultyRatings(window.localStorage);
    clearDemoProofs(window.localStorage);
    setProgress({ completedFields: [] });
    setQuestionnaire(parseQuestionnaire(null));
    setDifficultyRatings({});
    setRatingField(null);
    setProofs([]);
    setProofField(null);
    setProofText("");
    setProofFileName("");
    setHabitName("A calmer evening");
    setFriendAdded(false);
    setGroupJoined(false);
    setCheered(false);
    setDuelAccepted(false);
    setShowCheckpoint(false);
    playDemoSound(soundEnabled);
  }

  function updateQuestionnaire(next: typeof questionnaire) {
    writeDemoQuestionnaire(window.localStorage, next);
    setQuestionnaire(next);
  }

  function setQuestionnaireAnswer(questionId: string, answer: QuestionnaireAnswer) {
    updateQuestionnaire({
      ...questionnaire,
      completed: false,
      answers: { ...questionnaire.answers, [questionId]: answer },
    });
  }

  function moveQuestionnaire(direction: -1 | 1) {
    const question = QUESTIONNAIRE_QUESTIONS[questionnaire.step]!;
    if (direction > 0 && !isQuestionAnswered(question, questionnaire.answers[question.id])) return;
    updateQuestionnaire({
      ...questionnaire,
      step: Math.max(
        0,
        Math.min(QUESTIONNAIRE_QUESTIONS.length - 1, questionnaire.step + direction),
      ),
    });
  }

  function finishQuestionnaire() {
    const question = QUESTIONNAIRE_QUESTIONS[questionnaire.step]!;
    if (!isQuestionAnswered(question, questionnaire.answers[question.id])) return;
    updateQuestionnaire({ ...questionnaire, completed: true });
  }

  function createHabit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newHabit.trim();
    if (!name) return;
    setHabitName(name);
    setNewHabit("");
    setProgress({ completedFields: [] });
    writeDemoProgress(window.localStorage, { completedFields: [] });
    clearDemoDifficultyRatings(window.localStorage);
    clearDemoProofs(window.localStorage);
    setDifficultyRatings({});
    setProofs([]);
    setProofField(null);
    setRatingField(null);
    setSection("path");
    playDemoSound(soundEnabled, true);
  }

  const nav: { id: Section; label: string; icon: typeof Home }[] = [
    { id: "path", label: t.nav.path, icon: Home },
    { id: "new-habit", label: t.nav["new-habit"], icon: Plus },
    { id: "questionnaire", label: t.nav.questionnaire, icon: ShieldCheck },
    { id: "friends", label: t.nav.friends, icon: Users },
    { id: "duels", label: t.nav.duels, icon: Swords },
    { id: "settings", label: t.nav.settings, icon: Settings },
  ];
  const questionnaireQuestion = QUESTIONNAIRE_QUESTIONS[questionnaire.step]!;
  const localizedQuestion = localizeQuestion(questionnaireQuestion, language);
  const questionnaireAnswer = questionnaire.answers[questionnaireQuestion.id];
  const questionnaireAnswered = isQuestionAnswered(questionnaireQuestion, questionnaireAnswer);

  return (
    <main className="mx-auto flex min-h-dvh max-w-7xl gap-3 px-3 py-3 sm:gap-6 sm:px-6">
      <aside className="sticky top-3 flex h-[calc(100dvh-1.5rem)] w-14 shrink-0 flex-col rounded-2xl border bg-card p-2 shadow-sm sm:w-16 sm:p-3 lg:w-60">
        <Link
          to="/demo"
          className="mb-5 flex items-center justify-center gap-3 rounded-xl px-1 py-3 lg:justify-start lg:px-2"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate font-bold">Habit Shift</span>
            <span className="block text-xs text-muted-foreground">
              {language === "hu" ? "Fejlesztői demó" : "Development demo"}
            </span>
          </span>
        </Link>
        <p className="mb-2 hidden px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:block">
          {language === "hu" ? "MUNKATERÜLET" : "WORKSPACE"}
        </p>
        <nav
          aria-label={language === "hu" ? "Főmenü" : "Main menu"}
          className="flex flex-1 flex-col gap-1"
        >
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setSection(id);
                playDemoSound(soundEnabled);
              }}
              aria-current={section === id ? "page" : undefined}
              title={label}
              className={`flex items-center justify-center gap-3 rounded-xl px-2 py-3 text-sm font-medium transition-all duration-200 hover:translate-x-0.5 hover:bg-muted motion-reduce:transform-none lg:justify-start ${
                section === id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              <Icon className="size-5 shrink-0" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-3 border-t pt-3">
          <p className="mb-2 hidden px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:block">
            {language === "hu" ? "BEÁLLÍTÁSOK" : "PREFERENCES"}
          </p>
          <div className="mb-2 flex justify-center rounded-lg border bg-background/70 p-0.5 lg:justify-start">
            {(["hu", "en"] as const).map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={language === code}
                onClick={() => chooseLanguage(code)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-bold transition-colors ${language === code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? t.soundOff : t.soundOn}
            aria-pressed={soundEnabled}
            className="flex w-full items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted lg:justify-start"
          >
            {soundEnabled ? (
              <Volume2 className="size-5 shrink-0" />
            ) : (
              <VolumeX className="size-5 shrink-0" />
            )}
            <span className="hidden lg:inline">
              {t.sound}: {soundEnabled ? t.soundOn : t.soundOff}
            </span>
          </button>
          <button
            type="button"
            onClick={resetDemo}
            disabled={!loaded}
            title={t.resetTitle}
            className="mt-1 flex w-full items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50 lg:justify-start"
          >
            <RotateCcw className="size-5 shrink-0" />
            <span className="hidden lg:inline">{t.reset}</span>
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-8">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">{t.preview}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{t.titles[section]}</h1>
          </div>
        </header>

        {section === "path" && (
          <section>
            {proofField !== null && (
              <form
                onSubmit={submitDemoProof}
                className="mb-4 space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4"
              >
                <h2 className="font-semibold">
                  {t.proofPrompt} · {proofField}
                </h2>
                <p className="text-sm text-muted-foreground">{t.proofDisclaimer}</p>
                {proofTypeForDifficulty(DEMO_FIELD_DIFFICULTIES[proofField - 1] ?? 5) ===
                "honor" ? (
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={honorConfirmed}
                      onChange={(event) => setHonorConfirmed(event.target.checked)}
                      className="mt-1"
                    />
                    <span>{t.proofHonor}</span>
                  </label>
                ) : proofTypeForDifficulty(DEMO_FIELD_DIFFICULTIES[proofField - 1] ?? 5) ===
                  "reflection" ? (
                  <label className="block text-sm">
                    {t.proofReflection}
                    <textarea
                      value={proofText}
                      onChange={(event) => setProofText(event.target.value)}
                      maxLength={2000}
                      minLength={10}
                      rows={3}
                      required
                      className="mt-1 w-full rounded-xl border bg-background p-3"
                    />
                  </label>
                ) : (
                  <label className="block text-sm">
                    {t.proofPhoto}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => setProofFileName(event.target.files?.[0]?.name ?? "")}
                      required
                      className="mt-1 block w-full text-xs"
                    />
                  </label>
                )}
                {proofError && (
                  <p role="alert" className="text-sm text-destructive">
                    {t.proofError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setProofField(null)}
                    className="flex-1 rounded-xl border py-2"
                  >
                    {t.proofCancel}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-primary py-2 font-semibold text-primary-foreground"
                  >
                    {t.proofSubmit}
                  </button>
                </div>
              </form>
            )}
            {ratingField !== null && (
              <div className="mb-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <h2 className="font-semibold">{t.rateDifficulty}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t.ratingDescription}</p>
                <div
                  className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10"
                  role="group"
                  aria-label={t.rateDifficulty}
                >
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => {
                        const nextRatings = { ...difficultyRatings, [ratingField]: rating };
                        writeDemoDifficultyRatings(window.localStorage, nextRatings);
                        setDifficultyRatings(nextRatings);
                        setRatingField(null);
                      }}
                      className="rounded-xl border bg-card py-2 font-semibold hover:border-primary"
                    >
                      {rating}
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{t.ratingEasy}</span>
                  <span>{t.ratingHard}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRatingField(null)}
                  className="mt-3 text-sm font-medium text-muted-foreground underline"
                >
                  {t.ratingSkip}
                </button>
              </div>
            )}
            <div className="mb-4 rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t.personalPath}</p>
                  <h2 className="text-xl font-semibold">{habitName}</h2>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                  {t.level} 3
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span>
                  {completed.size} {t.fieldsComplete}
                </span>
                <span className="flex items-center gap-1 text-orange-500">
                  <Flame className="size-4" /> {t.streak(4)}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(completed.size / 5, 1) * 100}%` }}
                />
              </div>
            </div>
            <ol className="space-y-3">
              {t.fields.map(([title, description], index) => {
                const number = index + 1;
                const isComplete = completed.has(number);
                const savedRating = difficultyRatings[number];
                const savedProof = proofs.find((proof) => proof.position === number);
                const proofType = proofTypeForDifficulty(DEMO_FIELD_DIFFICULTIES[index] ?? 5);
                return (
                  <li key={number}>
                    <button
                      type="button"
                      disabled={!loaded}
                      onClick={() => toggleField(number)}
                      className={`group flex w-full items-start gap-4 rounded-2xl border bg-card p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none ${isComplete ? "border-primary/50 bg-primary/5" : ""}`}
                    >
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold transition-all duration-300 ${isComplete ? "scale-105 bg-primary text-primary-foreground" : "bg-muted group-hover:bg-primary/10"}`}
                      >
                        {isComplete ? <Check className="size-4" /> : number}
                      </span>
                      <span className="flex-1">
                        <span className="flex items-center gap-2 font-semibold">
                          {title}
                          {number % 5 === 0 && (
                            <span className="rounded-full bg-checkpoint/15 px-2 py-0.5 text-xs text-checkpoint">
                              {t.checkpoint}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {description} · {DEMO_FIELD_DIFFICULTIES[index]}/10 · {proofType}
                        </span>
                        {savedProof && (
                          <span className="mt-1 block text-xs text-primary">
                            {t.proofPending}: {savedProof.type}
                          </span>
                        )}
                        {savedRating && (
                          <span className="mt-1 block text-xs text-primary">
                            {t.ratingSaved}: {savedRating}/10
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {section === "new-habit" && (
          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </div>
            <h2 className="text-xl font-semibold">{t.newPath}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.newPathDescription}</p>
            <form className="mt-5 space-y-3" onSubmit={createHabit}>
              <label className="block text-sm font-medium" htmlFor="demo-habit">
                {t.habitQuestion}
              </label>
              <input
                id="demo-habit"
                value={newHabit}
                onChange={(event) => setNewHabit(event.target.value)}
                className="w-full rounded-xl border bg-input/30 px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
                placeholder={t.habitPlaceholder}
                maxLength={80}
              />
              <button
                disabled={!loaded || !newHabit.trim()}
                className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
              >
                {t.createPath}
              </button>
            </form>
            <p className="mt-4 text-xs text-muted-foreground">{t.previewNote}</p>
            <button
              type="button"
              onClick={() => setSection("questionnaire")}
              className="mt-4 w-full rounded-xl border p-3 text-left text-sm font-semibold"
            >
              {t.questionnaireEntry}
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {questionnaire.completed ? t.questionnaireEntryComplete : t.questionnaireEntryDraft}
              </span>
            </button>
          </section>
        )}

        {section === "questionnaire" && (
          <section className="mx-auto max-w-2xl space-y-5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t.questionnaireDescription}
            </p>
            {questionnaire.completed && (
              <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
                <Check className="size-5 shrink-0 text-primary" />
                <span>
                  <strong>{t.questionnaireComplete}.</strong> {t.questionnaireCompleteNote}
                </span>
              </div>
            )}
            <div className="rounded-3xl border bg-card p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>
                  {t.questionnaireProgress(questionnaire.step + 1, QUESTIONNAIRE_QUESTIONS.length)}
                </span>
                <span>{t.questionnaireSave} · localStorage</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${((questionnaire.step + 1) / QUESTIONNAIRE_QUESTIONS.length) * 100}%`,
                  }}
                />
              </div>
              <h2 id="demo-questionnaire-prompt" className="mt-7 text-xl font-semibold">
                {questionnairePrompt(localizedQuestion, questionnaire.step % 3, language)}
              </h2>
              {!questionnaireQuestion.required && (
                <p className="mt-1 text-xs text-muted-foreground">{t.questionnaireOptional}</p>
              )}

              {questionnaireQuestion.kind === "text" && (
                <textarea
                  value={typeof questionnaireAnswer === "string" ? questionnaireAnswer : ""}
                  aria-labelledby="demo-questionnaire-prompt"
                  onChange={(event) =>
                    setQuestionnaireAnswer(
                      questionnaireQuestion.id,
                      event.target.value.slice(0, 1000),
                    )
                  }
                  rows={4}
                  maxLength={1000}
                  placeholder={t.questionnairePlaceholder}
                  className="mt-5 w-full rounded-2xl border bg-input/30 p-4"
                />
              )}

              {(questionnaireQuestion.kind === "single" ||
                questionnaireQuestion.kind === "mood") && (
                <div
                  className={`mt-5 grid gap-3 ${questionnaireQuestion.kind === "mood" ? "grid-cols-5" : ""}`}
                >
                  {questionnaireQuestion.options?.map((option) => {
                    const displayOption = localizeQuestionOption(
                      questionnaireQuestion,
                      option,
                      language,
                    );
                    const selected = questionnaireAnswer === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setQuestionnaireAnswer(questionnaireQuestion.id, option)}
                        className={`rounded-xl border p-3 text-left transition ${selected ? "border-primary bg-primary/10" : "bg-background/50"}`}
                      >
                        {displayOption}
                      </button>
                    );
                  })}
                </div>
              )}

              {questionnaireQuestion.kind === "multiple" && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {questionnaireQuestion.options?.map((option) => {
                    const selected =
                      Array.isArray(questionnaireAnswer) && questionnaireAnswer.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          const values = Array.isArray(questionnaireAnswer)
                            ? questionnaireAnswer
                            : [];
                          setQuestionnaireAnswer(
                            questionnaireQuestion.id,
                            selected
                              ? values.filter((value) => value !== option)
                              : [...values, option],
                          );
                        }}
                        className={`rounded-xl border p-3 text-left transition ${selected ? "border-primary bg-primary/10" : "bg-background/50"}`}
                      >
                        {selected ? "✓ " : ""}
                        {localizeQuestionOption(questionnaireQuestion, option, language)}
                      </button>
                    );
                  })}
                </div>
              )}

              {questionnaireQuestion.kind === "scale" && (
                <div className="mt-6">
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                    {Array.from(
                      {
                        length:
                          (questionnaireQuestion.max ?? 10) - (questionnaireQuestion.min ?? 1) + 1,
                      },
                      (_, index) => (questionnaireQuestion.min ?? 1) + index,
                    ).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={questionnaireAnswer === value}
                        onClick={() => setQuestionnaireAnswer(questionnaireQuestion.id, value)}
                        className={`rounded-xl border py-3 font-semibold ${questionnaireAnswer === value ? "border-primary bg-primary/10 text-primary" : "bg-background/50"}`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>{t.questionnaireLow}</span>
                    <span>{t.questionnaireHigh}</span>
                  </div>
                </div>
              )}

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  disabled={questionnaire.step === 0}
                  onClick={() => moveQuestionnaire(-1)}
                  className="flex-1 rounded-xl border py-3 font-semibold disabled:opacity-40"
                >
                  {t.questionnaireBack}
                </button>
                {questionnaire.step < QUESTIONNAIRE_QUESTIONS.length - 1 ? (
                  <button
                    type="button"
                    disabled={!questionnaireAnswered}
                    onClick={() => moveQuestionnaire(1)}
                    className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    {questionnaireAnswered ? t.questionnaireNext : t.questionnaireSkip}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!questionnaireAnswered}
                    onClick={finishQuestionnaire}
                    className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    {t.questionnaireFinish}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {section === "friends" && (
          <section className="space-y-4">
            <div className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-full bg-primary/10 font-bold text-primary">
                  M
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Luca</p>
                  <p className="text-sm text-muted-foreground">{t.levelStreak}</p>
                </div>
                <span className="rounded-full bg-checkpoint/15 px-2 py-1 text-xs text-checkpoint">
                  {t.pinnedBadge}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setFriendAdded((value) => !value);
                    playDemoSound(soundEnabled);
                  }}
                  className="flex-1 rounded-xl border py-2 text-sm font-semibold"
                >
                  {friendAdded ? t.friendAdded : t.addFriend}
                </button>
                <button
                  onClick={() => {
                    setCheered((value) => !value);
                    playDemoSound(soundEnabled, true);
                  }}
                  className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold"
                >
                  <Heart className={`size-4 ${cheered ? "fill-current text-rose-500" : ""}`} />{" "}
                  {cheered ? t.cheered : t.cheer}
                </button>
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Small Steps Club</h2>
                  <p className="text-sm text-muted-foreground">{t.groupStreak}</p>
                </div>
                <Users className="size-5 text-primary" />
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {["Luca", t.youPreview, "Bence"].map((name, index) => (
                  <div key={name} className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <span>
                      {index + 1}. {name}
                    </span>
                    <span className="text-muted-foreground">{t.streak([8, 4, 2][index] ?? 0)}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  setGroupJoined((value) => !value);
                  playDemoSound(soundEnabled);
                }}
                className="mt-4 w-full rounded-xl border py-2 text-sm font-semibold"
              >
                {groupJoined ? t.joinedGroup : t.joinGroup}
              </button>
            </div>
            <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              {t.friendsNote}
            </p>
          </section>
        )}

        {section === "duels" && (
          <section className="space-y-4">
            <div className="rounded-2xl border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-600">
                  <Swords className="size-5" />
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold">{t.friendlyChallenge}</h2>
                  <p className="text-sm text-muted-foreground">{t.duelDetails}</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">{t.yourChallenge}</p>
                <p className="font-medium">
                  {language === "hu"
                    ? "Tarts egy tudatos, ötperces szünetet"
                    : "Take a mindful five-minute pause"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{t.opponentProgress}</p>
                <p className="font-medium">{t.inProgress}</p>
              </div>
              <button
                onClick={() => {
                  setDuelAccepted((value) => !value);
                  playDemoSound(soundEnabled, true);
                }}
                className="mt-4 w-full rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground"
              >
                {duelAccepted ? t.acceptedChallenge : t.acceptChallenge}
              </button>
            </div>
            <div className="flex gap-3 rounded-2xl border bg-card p-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-checkpoint/15 text-checkpoint">
                <ShieldCheck className="size-5" />
              </div>
              <p className="text-sm text-muted-foreground">{t.virtualSzikra}</p>
            </div>
          </section>
        )}

        {section === "settings" && (
          <section className="space-y-4">
            <div className="rounded-2xl border bg-card p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-full bg-muted">
                  <LockKeyhole className="size-5" />
                </div>
                <div>
                  <h2 className="font-semibold">{t.previewProfile}</h2>
                  <p className="text-sm text-muted-foreground">{t.notSignedIn}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSettingSaved((value) => !value);
                  playDemoSound(soundEnabled);
                }}
                className="w-full rounded-xl border py-2.5 text-sm font-semibold"
              >
                {settingSaved ? t.reminderSaved : t.saveReminder}
              </button>
            </div>
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">{t.privacyTitle}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t.privacyDescription}</p>
              <button
                onClick={resetDemo}
                className="mt-4 w-full rounded-xl border border-destructive/40 py-2.5 text-sm font-semibold text-destructive"
              >
                {t.clearData}
              </button>
            </div>
          </section>
        )}

        <footer className="mt-8 border-t pt-5 text-center text-sm text-muted-foreground">
          <p>{t.realAccount}</p>
          <Link to="/auth" className="mt-2 inline-block font-semibold text-primary underline">
            {t.signIn}
          </Link>
        </footer>
      </div>
      {showCheckpoint && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkpoint-title"
        >
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border bg-card p-8 text-center shadow-2xl animate-in zoom-in-95 duration-300">
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden"
              aria-hidden="true"
            >
              {Array.from({ length: 18 }, (_, index) => (
                <span
                  key={index}
                  className="absolute top-0 h-3 w-2 animate-bounce rounded-sm bg-primary/70 motion-reduce:animate-none"
                  style={{
                    left: `${(index * 37) % 100}%`,
                    animationDelay: `${(index % 6) * 80}ms`,
                    transform: `translateY(${(index % 3) * 24}px) rotate(${index * 23}deg)`,
                  }}
                />
              ))}
            </div>
            <div className="relative mx-auto grid size-20 place-items-center rounded-full bg-checkpoint/15 text-4xl animate-pulse motion-reduce:animate-none">
              🏆
            </div>
            <h2 id="checkpoint-title" className="relative mt-5 text-2xl font-bold">
              {t.celebrateTitle}
            </h2>
            <p className="relative mt-2 text-sm text-muted-foreground">{t.celebrateMessage}</p>
            <button
              type="button"
              autoFocus
              onClick={() => setShowCheckpoint(false)}
              className="relative mt-6 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none"
            >
              {t.celebrateClose}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
