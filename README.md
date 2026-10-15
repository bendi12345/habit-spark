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

### Two environments: authenticated app and development preview

This is one codebase with two distinct ways to explore it:

- **Production / real app:** users sign in through Supabase. Authenticated routes,
  server functions, database access, and RLS continue to require real
  authentication. Questionnaire answers are saved to the signed-in user's
  profile; post-attempt difficulty feedback is private to that user and field.
  Guest preview is not an account and cannot access them.
- **Vite development preview:** the sign-in page links to `/demo`, a clearly
  labeled local preview of the app's Path, New habit, Friends/groups, Duels, and
  Settings and personal questionnaire screens. It uses sample data and
  simulated interactions only; questionnaire answers and difficulty feedback
  remain in this browser's local storage. It
  does not call Supabase, AI, or server functions, and does not create an
  anonymous Supabase user. Local progress is stored in this browser and can be
  reset from the preview.

The `/demo` route and persistent development-preview banner are gated by
Vite's `import.meta.env.DEV` flag. The production build redirects `/demo` to
sign-in; the regular authenticated route guard and server-function
authorization are unchanged. Supabase anonymous sign-in remains disabled.

Production also exposes an installable PWA manifest. Its service worker caches
only same-origin build assets and a static offline notice; it never caches
authenticated pages, API responses, or personal data. Offline use is limited
to the reconnect notice rather than exposing stale account information.

Personal photo proofs use a private owner-scoped storage bucket. Honor-system
proof for difficulty 1–3 can be accepted directly; written reflections and
photos remain private and pending until a dedicated personal-proof review
function is deployed. Completion is server-gated on accepted proof, so
difficulty 4–10 fields cannot currently be completed through production until
that reviewer is available. The development preview stores simulated proof
locally and never represents it as reviewed.

To open the preview during development, run `npm run dev` and visit
`http://localhost:5173/auth`, then choose the development demo link. On a
machine where binding to all interfaces is undesirable, run
`npm run dev -- --host 127.0.0.1` and use the local URL Vite prints instead.

## Database and Edge Function deployment

Deployment is intentionally manual; no migration or function has been deployed
from this worktree. Confirm that the target is the intended Lovable/Supabase
project and that its database is backed up before applying anything.

The SQL migrations are in `drizzle/migrations/` (not `supabase/migrations/`),
and `drizzle.config.ts` reads the direct migration connection string from
`LOVABLE_DB_MIGRATION_URL`. Set that secret in your local shell without adding
it to a file or committing it, then run from the repository root:

```sh
bunx drizzle-kit migrate
```

Drizzle applies the journaled migrations in order and records which ones have
run. Review the target and migration history first; do not replay SQL manually
or reset a database containing user data.

The duel actions and duel text-proof reviewer are Supabase Edge Functions. Link
the Supabase CLI to the project configured in `supabase/config.toml`, then
deploy the functions and configure the server-side Lovable AI key:

```sh
supabase link --project-ref oqgthmwvdcmgrfkocfrx
supabase functions deploy duel-action
supabase functions deploy review-duel-proof
supabase secrets set LOVABLE_API_KEY=YOUR_SERVER_SIDE_KEY
```

Replace `YOUR_SERVER_SIDE_KEY` with the Lovable AI key before running the last
command; do not commit the value. The path-generation and Coach server functions
also read `LOVABLE_API_KEY` from the app server environment. Configure that key
in Lovable Cloud's server-side environment separately; the Supabase Edge
Function secret does not configure the app server.

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. The service-role key
must remain server-side; never place it in browser configuration. The
`review-duel-proof` function reviews duel text submissions only. It is **not**
the missing personal field-proof reviewer described below.

Personal photo proofs use a private owner-scoped storage bucket. Honor-system
proof for difficulty 1–3 can be accepted directly. Reflection/photo submissions
for difficulty 4–10 remain private and pending because there is no personal
field-proof review function in this repository; completion remains server-gated
on accepted proof, so those fields cannot currently be completed in production.
Do not mark these proofs accepted manually or treat the duel reviewer as a
substitute. A secure personal reviewer, including private photo review, is a
release blocker.

No periodic-assessment implementation has been started: assessment persistence,
analysis, and weekly AI summaries are not implemented. Upcoming-field
recalibration from attempt timing, difficulty feedback, and assessment history
remains incomplete. The development preview does not provide production AI or
backend behavior.
