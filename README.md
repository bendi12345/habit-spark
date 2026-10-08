# Habit Spark

Extend the existing app. Use Lovable AI / Lovable Cloud AI gateway through edge functions. ## AI path generator Replace the hardcoded template: the user describes a habit and goal, the AI generates the first 40 fields with the sawtooth pattern (blocks of 5, checkpoint every 5th field), editable before saving. It generates more fields automatically when the user nears the end. ## Personal difficulty rating - Every challenge has a personal difficulty rating 1-10 FOR THAT USER. 10 = the hardest thing for this specific person. - After each challenge the user answers "how hard was it?" (1-10). - An edge function recalibrates upcoming ratings using success/failure history, time taken, attempts, user feedback, and time-of-day patterns. - The AI reorders and rewrites upcoming fields so each 5-field block stays sawtooth-shaped according to the user's personal ratings. - Show the rating with a short AI explanation (e.g. "Ez neked 8/10, mert az esti órákban eddig kétszer buktál"). ## Proof of completion (layered) Each challenge has a proof type: - Daily check-in with a short written reflection (AI may ask a follow-up if vague). - Photo proof stored in Supabase storage (AI vision gives a plausibility/confidence level; user can contest). - Honor system only for personal difficulty 1-3. Higher personal difficulty requires stronger proof. Add a gentle per-user "honesty score" that only affects how often photo proof is requested, never punishes harshly. ## Tech Add tables: proofs, difficulty_history. Keep the AI prompts in separate edge functions: generate_path, rate_difficulty, review_proof. Extend the existing app. ## AI Coach chat - A chat screen where the AI coach knows the user's habits, streak, failures, current field and personal ratings. - Daily motivational message on the dashboard. - A prominent "Mindjárt visszaesem" (I'm about to slip) button: a calm, empathetic flow with a breathing exercise, urge-delay ideas, a reminder of progress made, and an option to chat with the coach. Never shame the user. Do not suggest pain-based or shock-based substitutes. - Streak breaks are handled kindly: the coach acknowledges it and helps restart. ## Periodic assessments - Short check-in survey every ~7 days and at every checkpoint: mood, cravings, stress, confidence, what was hardest, what helped. - An edge function analyses results, adjusts upcoming difficulty ratings and coaching tone, and shows the user a short "what changed" summary. ## Weekly AI summary A weekly screen: what went well, patterns noticed, one suggestion for next week. ## Safety If the user's messages suggest a crisis or self-harm, the coach responds supportively and encourages seeking professional help or contacting local emergency services (in Hungary: 112), instead of continuing normal coaching. ## Tech Tables: chat_messages, assessments, weekly_summaries.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/87a04e36-15d8-4159-9a35-1e55e09b635b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
