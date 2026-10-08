import { describe, expect, it } from "vitest";
import {
  isQuestionAnswered,
  clearDemoQuestionnaire,
  localizeQuestion,
  localizeQuestionOption,
  parseQuestionnaire,
  QUESTIONNAIRE_QUESTIONS,
  questionnairePrompt,
  readDemoQuestionnaire,
  writeDemoQuestionnaire,
} from "./questionnaire";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("personal questionnaire", () => {
  it("contains 20 to 25 questions with varied prompt wording", () => {
    expect(QUESTIONNAIRE_QUESTIONS.length).toBeGreaterThanOrEqual(20);
    expect(QUESTIONNAIRE_QUESTIONS.length).toBeLessThanOrEqual(25);
    const question = QUESTIONNAIRE_QUESTIONS[0]!;
    expect(new Set([0, 1, 2].map((variant) => questionnairePrompt(question, variant))).size).toBe(
      3,
    );
  });

  it("allows optional answers to be skipped but requires the target habit", () => {
    expect(isQuestionAnswered(QUESTIONNAIRE_QUESTIONS[0]!, undefined)).toBe(false);
    expect(isQuestionAnswered(QUESTIONNAIRE_QUESTIONS[0]!, "  ")).toBe(false);
    expect(isQuestionAnswered(QUESTIONNAIRE_QUESTIONS[1]!, undefined)).toBe(true);
  });

  it("localizes the questionnaire prompts and answer choices for the bilingual preview", () => {
    const frequency = QUESTIONNAIRE_QUESTIONS.find((question) => question.id === "frequency")!;
    expect(localizeQuestion(frequency, "en").prompt).toBe("How often does it happen?");
    expect(localizeQuestionOption(frequency, "Naponta", "en")).toBe("Daily");
    expect(localizeQuestion(frequency, "hu").prompt).toBe(frequency.prompt);
    for (const question of QUESTIONNAIRE_QUESTIONS) {
      expect(localizeQuestion(question, "en").prompt).not.toBe(question.prompt);
      if (question.id !== "sleep") {
        for (const option of question.options ?? []) {
          expect(localizeQuestionOption(question, option, "en")).not.toBe(option);
        }
      }
    }
  });

  it("restores valid drafts and clamps invalid progress", () => {
    expect(
      parseQuestionnaire({
        answers: { habit: "Késői telefonozás", impact: ["Alvás"], invalid: { secret: true } },
        step: 99,
        completed: true,
      }),
    ).toEqual({
      answers: { habit: "Késői telefonozás", impact: ["Alvás"] },
      step: QUESTIONNAIRE_QUESTIONS.length - 1,
      completed: true,
    });
  });

  it("stores and resumes the demo questionnaire using only local storage", () => {
    const storage = createStorage();
    const progress = {
      answers: { habit: "Késő esti telefonozás", impact: ["Alvás"] },
      step: 3,
      completed: false,
    };
    writeDemoQuestionnaire(storage, progress);
    expect(readDemoQuestionnaire(storage)).toEqual(progress);
    clearDemoQuestionnaire(storage);
    expect(readDemoQuestionnaire(storage)).toEqual({ answers: {}, step: 0, completed: false });
  });

  it("discards malformed local demo questionnaire data", () => {
    const storage = createStorage();
    storage.setItem("habit-shift-dev-demo-questionnaire", "{malformed");
    expect(readDemoQuestionnaire(storage)).toEqual({ answers: {}, step: 0, completed: false });
    expect(storage.getItem("habit-shift-dev-demo-questionnaire")).toBeNull();
  });
});
