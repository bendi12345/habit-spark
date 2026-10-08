export type QuestionnaireAnswer = string | string[] | number;
export type QuestionnaireAnswers = Record<string, QuestionnaireAnswer>;
export type QuestionnaireLanguage = "en" | "hu";
export type QuestionnaireProgress = {
  answers: QuestionnaireAnswers;
  step: number;
  completed: boolean;
};

export type QuestionnaireQuestion = {
  id: string;
  prompt: string;
  kind: "text" | "single" | "multiple" | "scale" | "mood";
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
};

export const QUESTIONNAIRE_QUESTIONS: QuestionnaireQuestion[] = [
  {
    id: "habit",
    prompt: "Milyen szokáson vagy helyzeten szeretnél változtatni?",
    kind: "text",
    required: true,
  },
  {
    id: "duration",
    prompt: "Mióta van jelen ez a szokás?",
    kind: "single",
    options: ["Néhány hete", "Néhány hónapja", "Több mint egy éve", "Régóta, pontosan nem tudom"],
  },
  {
    id: "frequency",
    prompt: "Milyen gyakran fordul elő?",
    kind: "single",
    options: ["Naponta többször", "Naponta", "Hetente többször", "Hetente egyszer vagy ritkábban"],
  },
  {
    id: "impact",
    prompt: "Mely területekre van hatással?",
    kind: "multiple",
    options: ["Alvás", "Hangulat", "Egészség", "Tanulás vagy munka", "Kapcsolatok", "Szabadidő"],
  },
  {
    id: "triggers",
    prompt: "Mi szokta kiváltani vagy erősíteni?",
    kind: "multiple",
    options: [
      "Stressz",
      "Unalom",
      "Fáradtság",
      "Magány",
      "Bizonyos emberek",
      "Napszak vagy rutin",
      "Nem tudom még",
    ],
  },
  {
    id: "time",
    prompt: "Mikor a legjellemzőbb?",
    kind: "multiple",
    options: ["Reggel", "Napközben", "Este", "Éjszaka", "Változó"],
  },
  {
    id: "feelings",
    prompt: "Milyen érzések előzik meg leggyakrabban?",
    kind: "multiple",
    options: ["Feszültség", "Szorongás", "Szomorúság", "Unalom", "Düh", "Kimerültség", "Nem tudom"],
  },
  {
    id: "places",
    prompt: "Hol fordul elő leginkább?",
    kind: "multiple",
    options: [
      "Otthon",
      "Munkahelyen vagy iskolában",
      "Útközben",
      "Társaságban",
      "Egyedül",
      "Változó",
    ],
  },
  {
    id: "attempts",
    prompt: "Próbáltál már változtatni rajta?",
    kind: "single",
    options: ["Még nem", "Igen, egyszer", "Igen, többször", "Most is próbálkozom"],
  },
  {
    id: "support",
    prompt: "Mi segített akár egy kicsit is?",
    kind: "multiple",
    options: [
      "Egy támogató ember",
      "Kisebb célok",
      "A kiváltó okok kerülése",
      "Más tevékenység",
      "Emlékeztető",
      "Még nem találtam ilyet",
    ],
  },
  { id: "motivation", prompt: "Miért fontos neked ez a változás?", kind: "text" },
  {
    id: "difficulty",
    prompt: "Mennyire nehéz most változtatni ezen?",
    kind: "scale",
    min: 1,
    max: 10,
  },
  {
    id: "confidence",
    prompt: "Mennyire hiszed, hogy képes vagy apró lépéseket tenni?",
    kind: "scale",
    min: 1,
    max: 10,
  },
  {
    id: "sleep",
    prompt: "Hogyan értékelnéd mostanában az alvásodat?",
    kind: "mood",
    options: ["😴", "😕", "😐", "🙂", "😄"],
  },
  {
    id: "energy",
    prompt: "Mennyi energiád van általában a változtatásra?",
    kind: "scale",
    min: 1,
    max: 10,
  },
  {
    id: "stress",
    prompt: "Mennyire érzed most stresszesnek a mindennapjaidat?",
    kind: "scale",
    min: 1,
    max: 10,
  },
  {
    id: "daily_time",
    prompt: "Mennyi idő férne bele egy apró napi lépésre?",
    kind: "single",
    options: ["1–5 perc", "6–15 perc", "16–30 perc", "Változó"],
  },
  {
    id: "best_time",
    prompt: "Mikor lenne a legkönnyebb egy lépést beiktatni?",
    kind: "single",
    options: ["Reggel", "Napközben", "Este", "Nincs állandó időpont"],
  },
  {
    id: "people",
    prompt: "Szeretnéd, hogy valaki támogasson a folyamatban?",
    kind: "single",
    options: [
      "Igen, egy barát vagy családtag",
      "Igen, szakember",
      "Talán később",
      "Most inkább egyedül haladok",
    ],
  },
  {
    id: "celebration",
    prompt: "Milyen elismerés motiválna?",
    kind: "multiple",
    options: [
      "Bátorító üzenet",
      "Látható haladás",
      "Kitűző",
      "Közös ünneplés",
      "Csendes személyes siker",
    ],
  },
  {
    id: "coach_tone",
    prompt: "Milyen hangnemben szóljon hozzád a coach?",
    kind: "single",
    options: [
      "Gyengéd és megértő",
      "Rövid és lényegre törő",
      "Játékos és vidám",
      "Határozott, de támogató",
    ],
  },
  {
    id: "context",
    prompt: "Van még valami, amit fontos tudnunk ahhoz, hogy kíméletesen támogassunk?",
    kind: "text",
  },
];

export const QUESTIONNAIRE_PROMPT_VARIANTS = [
  "Nincs jó vagy rossz válasz.",
  "Válaszolj a saját tempódban.",
  "Annyit ossz meg, amennyi most kényelmes.",
] as const;

export function questionnairePrompt(
  question: QuestionnaireQuestion,
  variantIndex: number,
  language: QuestionnaireLanguage = "hu",
) {
  const variants =
    language === "hu"
      ? QUESTIONNAIRE_PROMPT_VARIANTS
      : [
          "There are no right or wrong answers.",
          "Take your time answering.",
          "Share only what feels comfortable.",
        ];
  const prefix = variants[variantIndex % variants.length];
  return `${prefix} ${question.prompt}`;
}

const englishCopy: Record<string, { prompt: string; options?: Record<string, string> }> = {
  habit: { prompt: "What habit or situation would you like to change?" },
  duration: {
    prompt: "How long has this habit been part of your life?",
    options: {
      "Néhány hete": "A few weeks",
      "Néhány hónapja": "A few months",
      "Több mint egy éve": "More than a year",
      "Régóta, pontosan nem tudom": "A long time; I'm not sure exactly",
    },
  },
  frequency: {
    prompt: "How often does it happen?",
    options: {
      "Naponta többször": "Several times a day",
      Naponta: "Daily",
      "Hetente többször": "Several times a week",
      "Hetente egyszer vagy ritkábban": "Weekly or less",
    },
  },
  impact: {
    prompt: "Which areas of your life does it affect?",
    options: {
      Alvás: "Sleep",
      Hangulat: "Mood",
      Egészség: "Health",
      "Tanulás vagy munka": "Study or work",
      Kapcsolatok: "Relationships",
      Szabadidő: "Free time",
    },
  },
  triggers: {
    prompt: "What tends to trigger or intensify it?",
    options: {
      Stressz: "Stress",
      Unalom: "Boredom",
      Fáradtság: "Tiredness",
      Magány: "Loneliness",
      "Bizonyos emberek": "Certain people",
      "Napszak vagy rutin": "Time of day or routine",
      "Nem tudom még": "I'm not sure yet",
    },
  },
  time: {
    prompt: "When does it usually happen?",
    options: {
      Reggel: "Morning",
      Napközben: "During the day",
      Este: "Evening",
      Éjszaka: "Night",
      Változó: "It varies",
    },
  },
  feelings: {
    prompt: "What do you often feel beforehand?",
    options: {
      Feszültség: "Tension",
      Szorongás: "Anxiety",
      Szomorúság: "Sadness",
      Unalom: "Boredom",
      Düh: "Anger",
      Kimerültség: "Exhaustion",
      "Nem tudom": "I'm not sure",
    },
  },
  places: {
    prompt: "Where does it happen most often?",
    options: {
      Otthon: "At home",
      "Munkahelyen vagy iskolában": "At work or school",
      Útközben: "On the go",
      Társaságban: "With other people",
      Egyedül: "Alone",
      Változó: "It varies",
    },
  },
  attempts: {
    prompt: "Have you tried changing it before?",
    options: {
      "Még nem": "Not yet",
      "Igen, egyszer": "Yes, once",
      "Igen, többször": "Yes, several times",
      "Most is próbálkozom": "I'm trying now",
    },
  },
  support: {
    prompt: "What has helped, even a little?",
    options: {
      "Egy támogató ember": "A supportive person",
      "Kisebb célok": "Smaller goals",
      "A kiváltó okok kerülése": "Avoiding triggers",
      "Más tevékenység": "A different activity",
      Emlékeztető: "A reminder",
      "Még nem találtam ilyet": "I haven't found anything yet",
    },
  },
  motivation: { prompt: "Why is this change important to you?" },
  difficulty: { prompt: "How difficult does changing this feel right now?" },
  confidence: { prompt: "How confident are you that you can take small steps?" },
  sleep: {
    prompt: "How would you rate your sleep lately?",
    options: { "😴": "😴", "😕": "😕", "😐": "😐", "🙂": "🙂", "😄": "😄" },
  },
  energy: { prompt: "How much energy do you usually have for making a change?" },
  stress: { prompt: "How stressful does everyday life feel right now?" },
  daily_time: {
    prompt: "How much time could you make for a small daily step?",
    options: {
      "1–5 perc": "1–5 minutes",
      "6–15 perc": "6–15 minutes",
      "16–30 perc": "16–30 minutes",
      Változó: "It varies",
    },
  },
  best_time: {
    prompt: "When would it be easiest to fit in a small step?",
    options: {
      Reggel: "Morning",
      Napközben: "During the day",
      Este: "Evening",
      "Nincs állandó időpont": "No regular time",
    },
  },
  people: {
    prompt: "Would you like someone to support you?",
    options: {
      "Igen, egy barát vagy családtag": "Yes, a friend or family member",
      "Igen, szakember": "Yes, a professional",
      "Talán később": "Maybe later",
      "Most inkább egyedül haladok": "I'd rather go at it alone for now",
    },
  },
  celebration: {
    prompt: "What kind of recognition would motivate you?",
    options: {
      "Bátorító üzenet": "An encouraging message",
      "Látható haladás": "Visible progress",
      Kitűző: "A badge",
      "Közös ünneplés": "Celebrating with others",
      "Csendes személyes siker": "A quiet personal win",
    },
  },
  coach_tone: {
    prompt: "What tone should your coach use?",
    options: {
      "Gyengéd és megértő": "Gentle and understanding",
      "Rövid és lényegre törő": "Brief and direct",
      "Játékos és vidám": "Playful and upbeat",
      "Határozott, de támogató": "Confident but supportive",
    },
  },
  context: { prompt: "Anything else we should know to support you thoughtfully?" },
};

export function localizeQuestion(
  question: QuestionnaireQuestion,
  language: QuestionnaireLanguage,
): QuestionnaireQuestion {
  if (language === "hu") return question;
  const translation = englishCopy[question.id];
  if (!translation) return question;
  return {
    ...question,
    prompt: translation.prompt,
    ...(question.options
      ? { options: question.options.map((option) => translation.options?.[option] ?? option) }
      : {}),
  };
}

export function localizeQuestionOption(
  question: QuestionnaireQuestion,
  option: string,
  language: QuestionnaireLanguage,
) {
  if (language === "hu") return option;
  const translated = localizeQuestion(question, language).options;
  const originalOptions = question.options ?? [];
  const index = originalOptions.indexOf(option);
  return translated?.[index] ?? option;
}

const DEMO_QUESTIONNAIRE_STORAGE_KEY = "habit-shift-dev-demo-questionnaire";

export function readDemoQuestionnaire(storage: Storage): QuestionnaireProgress {
  const saved = storage.getItem(DEMO_QUESTIONNAIRE_STORAGE_KEY);
  if (!saved) return parseQuestionnaire(null);
  try {
    return parseQuestionnaire(JSON.parse(saved));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  storage.removeItem(DEMO_QUESTIONNAIRE_STORAGE_KEY);
  return parseQuestionnaire(null);
}

export function writeDemoQuestionnaire(storage: Storage, progress: QuestionnaireProgress): void {
  storage.setItem(DEMO_QUESTIONNAIRE_STORAGE_KEY, JSON.stringify(progress));
}

export function clearDemoQuestionnaire(storage: Storage): void {
  storage.removeItem(DEMO_QUESTIONNAIRE_STORAGE_KEY);
}

export function isQuestionAnswered(
  question: QuestionnaireQuestion,
  answer: QuestionnaireAnswer | undefined,
) {
  if (answer === undefined || (typeof answer === "string" && answer.trim() === ""))
    return !question.required;
  if (Array.isArray(answer)) return answer.length > 0 || !question.required;
  return true;
}

export function parseQuestionnaire(value: unknown): {
  answers: QuestionnaireAnswers;
  step: number;
  completed: boolean;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { answers: {}, step: 0, completed: false };
  }

  const record = value as Record<string, unknown>;
  const rawAnswers = record["answers"];
  const answers: QuestionnaireAnswers = {};
  if (rawAnswers && typeof rawAnswers === "object" && !Array.isArray(rawAnswers)) {
    for (const [key, answer] of Object.entries(rawAnswers)) {
      if (
        typeof answer === "string" ||
        typeof answer === "number" ||
        (Array.isArray(answer) && answer.every((item) => typeof item === "string"))
      ) {
        answers[key] = answer as QuestionnaireAnswer;
      }
    }
  }

  const rawStep =
    typeof record["step"] === "number" && Number.isInteger(record["step"]) ? record["step"] : 0;
  return {
    answers,
    step: Math.min(QUESTIONNAIRE_QUESTIONS.length - 1, Math.max(0, rawStep)),
    completed: record["completed"] === true,
  };
}
