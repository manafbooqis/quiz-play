# Quiz Play Full Audit Report

Audit date: 2026-05-20

Scope: current local `quiz-play` project state, including Git state, student flow, instructor flow, AI question generation, scoring, leaderboard, Round Results, Final Results, Score Distribution, Supabase schema/RLS, routing, storage usage, UI/UX, security, build/lint, and old or unused files.

## 1. Executive Summary

The project is on `main` at commit `74422bb Remove Vercel configuration`, one commit after `bf8a78c Fix instructor live quiz hook warnings`. The branch reports as up to date with `origin/main`, but the working tree is not clean.

Current local modifications exist in:

- `PROJECT_FULL_AUDIT_REPORT.md`
- `src/pages/student/Question.jsx`
- `src/pages/student/RoundResults.jsx`

The local source modifications mean the streak bonus feature currently exists in the working tree, even though it is not committed in `HEAD`. `vercel.json` is removed and is not tracked. `netlify.toml` is also not tracked.

`npm run lint` passes. `npm run build` fails inside the sandbox with an access-denied Vite/esbuild config-load error, but passes when rerun outside the sandbox. The production build still emits the existing chunk-size warning for a JavaScript chunk larger than 500 kB.

## 2. Current Git State

Commands run:

```text
git status
git log --oneline -10
git diff --name-only
git diff --stat
git ls-files vercel.json
git ls-files netlify.toml
```

Current branch:

- `main`

Remote status:

- `main` is up to date with `origin/main`.

Working tree:

- Not clean.
- No changes are staged.

Latest commits:

```text
74422bb Remove Vercel configuration
bf8a78c Fix instructor live quiz hook warnings
64154cb Fix student question hook warnings and update audit report
c0f8001 Resolve lint errors and refresh audit report
eb130f8 add the corruect answer
2791b8d  player identity, AI uploads, and quiz flow stability
f9da739 Implemented the compact layout and End Quiz sync changes.
b37fc22 Fix point and fix the button of back to QA
2460467 Fix scoring consistency,leaderboard sync,and final results transition
c12546a ix live quiz progression and round results flow
```

Changed files:

- Modified: `PROJECT_FULL_AUDIT_REPORT.md`
- Modified: `src/pages/student/Question.jsx`
- Modified: `src/pages/student/RoundResults.jsx`

Deleted files:

- None in the working tree.

Added files:

- None in the working tree.

Untracked files:

- None reported by `git status`.

Tracked deployment files:

- `git ls-files vercel.json`: no output. `vercel.json` is not tracked.
- `git ls-files netlify.toml`: no output. `netlify.toml` is not tracked.

Current diff stat before this report update:

```text
PROJECT_FULL_AUDIT_REPORT.md       | 35 ++++++++++++++------
src/pages/student/Question.jsx     | 66 ++++++++++++++++++++++++++++++++++++--
src/pages/student/RoundResults.jsx |  7 ++++
3 files changed, 97 insertions(+), 11 deletions(-)
```

## 3. What Was Already Implemented

Scoring and leaderboard:

- `src/utils/leaderboard.js` defines `DIFFICULTY_POINTS` as Easy = `10`, Medium = `25`, Hard = `50`.
- `getDifficultyPoints(difficulty)` centralizes difficulty point lookup.
- `calculateLeaderboard(players, responses, sessionQuestionCount, scoringConfig)` groups responses by `response.player_id`.
- Final score is calculated by summing correct `responses.points_awarded`.
- `calculateLeaderboard(...)` is used by:
  - `src/pages/student/FinalResults.jsx`
  - `src/pages/student/RoundResults.jsx`
  - `src/pages/instructor/InstructorLiveQuiz.jsx`
  - `src/pages/instructor/InstructorScoreDistribution.jsx`

Student identity:

- `src/pages/student/JoinGame.jsx` stores `session_players.id` as `playerId` / `sessionPlayerId`.
- Student pages prefer `playerId` / `sessionPlayerId` and fall back to `studentName` for older rows.
- Duplicate display-name blocking exists in `JoinGame.jsx`; the user-facing message is `This name is already used in this game. Please choose another name.`

Quiz flow:

- `src/pages/instructor/InstructorLiveQuiz.jsx` has `finishQuiz()` and writes `sessions.status = "finished"`.
- `nextRound()` calls `finishQuiz()` when the next round exceeds `question_count`.
- Student pages including Lobby, Difficulty, Question, RoundResults, WaitingForOthers, and FinalResults preserve or recover `playerId` / `sessionPlayerId`.
- `src/pages/student/Question.jsx` now keeps students on the Question page after answer submission, disables choices, and shows a neutral waiting message.
- Result details are revealed only after the shared session transitions to `round_results` and the student reaches `RoundResults.jsx`.
- `Question.jsx` and `WaitingForOthers.jsx` now detect `round_results` through realtime session updates plus a polling fallback.
- Student navigation treats `status === "round_results"`, `current_phase === "round_results"`, or `show_round_results === true` as the Round Results phase.
- `src/pages/student/WaitingForOthers.jsx` preserves `playerId` / `sessionPlayerId` when navigating.
- `src/pages/student/RoundResults.jsx` displays the selected answer and correct answer using `getOptionLetter(...)` and `getCorrectOptionLetter(...)`.

AI generation:

- `src/pages/instructor/DashboardOfficial.jsx` calls `/api/generate-questions`.
- Upload UI accepts `.txt,.md,.doc,.docx,.pdf,.csv,.json,.html`.
- `api/generate-questions.js` supports extraction for PDF, TXT, CSV, JSON, MD, DOCX, and PPTX at the API layer.
- API validation rejects invalid question structures and filters low-quality generated questions.

Database/migrations:

- `supabase/migrations/20260514190000_add_unique_response_constraint.sql` adds `responses_unique_player_question` on `(session_id, question_id, player_id)`.
- `supabase/migrations/20250508195100_add_time_taken_seconds_to_responses.sql` exists for response timing.
- `supabase/migrations/20240426060000_add_quiz_flow.sql` creates the `responses` table and basic quiz-flow session columns.

## 4. What Was Removed or Is Currently Missing

Removed:

- `vercel.json` was removed by commit `74422bb Remove Vercel configuration`.
- `vercel.json` does not exist as a tracked file.
- `netlify.toml` is not tracked.
- Render deployment preparation has been added with a Node/Express web service entrypoint at `server.js`.

Currently missing or incomplete:

- No deployment config file is tracked for Vercel or Netlify.
- Supabase migrations do not fully represent all columns used by the current app, including `session_players`, `sessions.questions_by_difficulty`, `sessions.question_count`, `sessions.time_per_question`, `sessions.current_phase`, `responses.round_results_seen_at`, `responses.difficulty`, and `responses.points_possible`.
- `DashboardOfficial.jsx` upload input does not list `.pptx` in its `accept` attribute, although `api/generate-questions.js` supports PPTX extraction.
- Normal answer submissions do not store `responses.difficulty` or `responses.points_possible`.
- Current `HEAD` does not include the local streak bonus source changes; the feature exists only in the uncommitted working tree.

Old or likely unused files:

- `src/pages/student/Result.jsx` is routed but appears superseded by `RoundResults.jsx` and `FinalResults.jsx`.
- `src/pages/student/Leaderboard.jsx` exists but is not part of the main current result path.
- `src/pages/CreateSession.jsx` is routed under `/instructor/create-session`, while the main instructor flow appears to use `DashboardOfficial.jsx`, `SessionOfficial.jsx`, and `questions-preview.jsx`.
- `clear_loop.js` and `clear_session.js` are local utility scripts and should be documented or removed later if not used.
- `functions/index.js` and `functions/package.json` exist separately from the current Vite/API route approach and need deployment-context clarification.

## 5. Critical Bugs / High-Risk Issues

1. Working tree is not clean.
   - Current source files `src/pages/student/Question.jsx` and `src/pages/student/RoundResults.jsx` contain uncommitted local changes.
   - This matters because the branch matches `origin/main`, but local behavior differs from committed behavior.

2. Supabase RLS mismatch for new player IDs.
   - `supabase/migrations/20240426060000_add_quiz_flow.sql` allows response inserts when `session_players.student_name = responses.player_id`.
   - Current app writes stable `session_players.id` into `responses.player_id`.
   - If the target Supabase project uses this policy unchanged, student response inserts can fail or require broader policies outside the repo.

3. Student client can finish the session.
   - `src/pages/student/RoundResults.jsx` contains `markSessionFinished(...)`, which updates `sessions.status = "finished"`.
   - Instructor-owned finalization already exists in `InstructorLiveQuiz.jsx`.
   - Student-side finalization should be moved to instructor/server authority or guarded by validated RPC/RLS.

4. `responses.round_results_seen_at` is used but not created by current migrations.
   - `RoundResults.jsx` updates and reads `responses.round_results_seen_at`.
   - Missing DB column would break readiness tracking.

5. Build behavior depends on execution context.
   - `npm run build` fails inside the sandbox with `Cannot read directory "../../../..": Access is denied` and cannot resolve `vite.config.js`.
   - The same build passes outside the sandbox.

6. AI generation depends on serverless routing after Vercel removal.
   - Frontend calls `/api/generate-questions`.
   - With `vercel.json` removed, deployment must still route `api/generate-questions.js` correctly or AI upload generation will fail in production.

## 6. Scoring and Leaderboard Review

Current base scoring:

- Easy = `10`
- Medium = `25`
- Hard = `50`

Primary files:

- `src/utils/leaderboard.js`
- `src/pages/student/Difficulty.jsx`
- `src/pages/student/Question.jsx`
- `src/pages/student/FinalResults.jsx`
- `src/pages/student/RoundResults.jsx`
- `src/pages/instructor/InstructorLiveQuiz.jsx`
- `src/pages/instructor/InstructorScoreDistribution.jsx`

Current score formula:

```js
score = correctResponses.reduce(
  (sum, response) => sum + Number(response.points_awarded || 0),
  0
)
```

Streak bonus current state:

- Search terms found current local matches for `STREAK_BONUS_POINTS`, `streakBonus`, and `Streak Bonus`.
- `src/pages/student/Question.jsx` currently defines `STREAK_BONUS_POINTS = 5`.
- `src/pages/student/Question.jsx` currently calculates `streakBonus`.
- `src/pages/student/RoundResults.jsx` currently displays `Streak Bonus +{streakBonus}` when a positive bonus exists.
- Search for `consecutive correct answers` only matched this report text, not source code.
- Important: these are uncommitted local changes, not committed in `HEAD`.

Strengths:

- Shared leaderboard helper prevents most scoring surfaces from diverging.
- Leaderboard matching prefers stable player IDs and keeps name fallback for old rows.
- Score Distribution uses `getScoreDistributionBuckets(...)` and leaderboard-derived max possible score.

Risks:

- Streak bonus is stored only as part of `points_awarded`; there is no separate persisted `streak_bonus` column.
- Score Distribution may treat bonus-included `points_awarded` as possible points unless question metadata is available.
- Normal responses do not write `difficulty` or `points_possible`, which weakens analytics and max-score derivation.

## 7. Student Flow Review

Main files:

- `src/pages/student/JoinGame.jsx`
- `src/pages/student/Lobby.jsx`
- `src/pages/student/Difficulty.jsx`
- `src/pages/student/Question.jsx`
- `src/pages/student/RoundResults.jsx`
- `src/pages/student/WaitingForOthers.jsx`
- `src/pages/student/FinalResults.jsx`

Implemented:

- Join flow stores session/player state in `localStorage`.
- Duplicate student names are blocked in `JoinGame.jsx`.
- Lobby listens for session status and navigates to Difficulty, Final Results, or other states.
- Difficulty selection uses `getDifficultyPoints(...)` for display.
- Question submission writes `responses.points_awarded`.
- After a student answers, `Question.jsx` saves the response but does not navigate directly to Round Results.
- `Question.jsx` disables the answer buttons and shows `Answer submitted! Waiting for other students...` without revealing correctness, correct answer, points, or streak bonus.
- `Question.jsx` preserves submitted result state and uses the shared session `round_results` status to navigate to `RoundResults.jsx`.
- `Question.jsx` polls the shared session row every 1.5 seconds as a fallback when Supabase realtime does not deliver the phase-change event.
- `WaitingForOthers.jsx` also uses realtime plus a 1.5 second polling fallback for `round_results` and `final_results`.
- `WaitingForOthers.jsx` no longer navigates to Round Results solely because the local timer reaches zero; it waits for the shared session phase.
- `WaitingForOthers.jsx` is still imported and routed in `src/App.jsx`, but no current student page navigates to `/student/waiting-for-others`.
- The current after-answer flow uses `Question.jsx` as the waiting page, so `WaitingForOthers.jsx` is not used for the main answer-submission path.
- Timeout handling writes a zero-point incorrect response when no prior response exists.
- Round Results marks `round_results_seen_at` and waits for all players.
- Final Results loads real players/responses and calculates leaderboard from `calculateLeaderboard(...)`.

WaitingForOthers usage review:

- `git grep -n "WaitingForOthers"` found only `src/App.jsx`, `src/pages/student/WaitingForOthers.jsx`, and this audit report.
- `git grep -n "waiting-for-others"` found only the route in `src/App.jsx` and this audit report.
- `git grep -n "/student/waiting"` found only the route in `src/App.jsx` and this audit report.
- `src/App.jsx` still imports `WaitingForOthers` and routes `/student/waiting-for-others`.
- No current app code calls `navigate("/student/waiting-for-others")`.
- Current student pages checked: `Question.jsx`, `Difficulty.jsx`, `RoundResults.jsx`, `Lobby.jsx`, and `FinalResults.jsx`.
- No current main-flow path navigates to `WaitingForOthers.jsx`.
- Current role: old/dead route or direct-URL fallback only.
- Recommendation: Option B for now: keep the file but stop using it in the after-answer flow. This is already the current behavior.
- Do not delete it yet unless `src/App.jsx` import/route and any external bookmarks/docs are intentionally removed in the same cleanup. Deleting the file now while the route remains would break the app build.
- If removed later, first remove the import and route from `src/App.jsx`, then run lint/build and manually verify no direct URL or deployment fallback depends on it.

Risks:

- Student pages rely heavily on route state plus `localStorage`; reloads are partially handled but still fragile.
- `Question.jsx` has substantial timer, subscription, answer submission, timeout, and navigation logic in one component.
- Local `quizplay_answered_questions_${gameCode}_${playerId}` can diverge from database responses.
- Student-side session updates in Difficulty and RoundResults are high-risk if RLS is broad.

## 8. Instructor Flow Review

Main files:

- `src/pages/instructor/DashboardOfficial.jsx`
- `src/pages/instructor/SessionOfficial.jsx`
- `src/pages/instructor/questions-preview.jsx`
- `src/pages/instructor/InstructorLiveQuiz.jsx`
- `src/pages/instructor/InstructorFinalResults.jsx`
- `src/pages/instructor/InstructorScoreDistribution.jsx`

Implemented:

- Dashboard supports manual, bank, and upload/AI question sources.
- Instructor session/live quiz flow uses Supabase sessions and responses.
- `InstructorLiveQuiz.jsx` includes `finishQuiz()` and updates `sessions.status = "finished"`.
- `nextRound()` finalizes when the next round exceeds configured question count.
- Live rankings use `calculateLeaderboard(...)`.
- Instructor final results and Score Distribution load database state rather than relying only on navigation state.

Risks:

- `InstructorLiveQuiz.jsx` contains complex status, response, timer, navigation, and ranking logic in one file.
- Student-side finish fallback duplicates instructor-owned finalization.
- Dashboard upload UI accepts `.doc` but API support is for DOCX/PPTX, not legacy DOC.
- The removed Vercel config may affect API routing depending on deployment provider.

## 9. AI Question Generation Review

Main files:

- `src/pages/instructor/DashboardOfficial.jsx`
- `api/generate-questions.js`
- `server.js`
- `package.json`

Current support:

- PDF: supported via `pdf-parse`.
- TXT: supported as text.
- CSV: supported as text.
- JSON: supported as JSON/text extraction.
- MD: supported as text.
- DOCX: supported by Office extraction helpers in `api/generate-questions.js`.
- PPTX: supported by Office extraction helpers in `api/generate-questions.js`.

Mismatch:

- Upload input in `DashboardOfficial.jsx` accepts `.txt,.md,.doc,.docx,.pdf,.csv,.json,.html`.
- `.pptx` is supported by the API but not accepted by the UI file picker.
- `.doc` is accepted by the UI but not listed in the API-supported formats.

Environment dependencies:

- `OPENROUTER_API_KEY`
- Supabase service configuration for `supabaseAdmin`
- Optional `APP_URL` for OpenRouter headers.

Render deployment preparation:

- `server.js` uses Express and listens on `process.env.PORT || 3000`.
- `server.js` serves the built Vite frontend from `dist`.
- `server.js` serves Vite's `/quiz-play/` base path by mounting `dist` at `/quiz-play`, including `/quiz-play/assets/*`.
- `server.js` exposes `POST /api/generate-questions`.
- The Express route reuses the existing default handler from `api/generate-questions.js`, preserving the request body and response JSON shape expected by `DashboardOfficial.jsx`.
- Non-API routes fall back to `dist/index.html`, so React Router deep links continue to work.
- The SPA fallback now avoids asset-like URLs, preventing `/quiz-play/assets/*.js` requests from receiving `index.html` with `text/html`.
- Correct local Render-style preview URL: `http://localhost:3000/quiz-play/`.
- `package.json` now includes `"start": "node server.js"`.
- `express` is installed as a production dependency.
- `dotenv` is installed so local `npm start` can load server-side values from `.env`.

Risks:

- On Render, `/api/generate-questions` is served by the Express web service instead of relying on Vercel serverless routing.
- Render must run `npm run build` before `npm start` so `dist/index.html` exists.
- Render environment variables must include `VITE_SUPABASE_URL` or `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENROUTER_API_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` and `OPENROUTER_API_KEY` remain server-side because they are read by `api/generate-questions.js` through the Node/Express route.
- Previous Express static routing could return `dist/index.html` for `/quiz-play/assets/*.js`, causing the browser MIME error: expected module script but received `text/html`. The `/quiz-play` static mount fixes real built assets, and the asset 404 guard prevents fallback HTML for missing assets.
- Text is truncated to 15,000 characters, which may omit important content from long files.
- AI validation is stronger than before, but still depends on model output quality.

## 10. Supabase Schema / RLS Review

Migrations present:

- `supabase/migrations/20240426060000_add_quiz_flow.sql`
- `supabase/migrations/20250508195100_add_time_taken_seconds_to_responses.sql`
- `supabase/migrations/20260514190000_add_unique_response_constraint.sql`

Confirmed:

- `responses_unique_player_question` exists in migration SQL.
- `responses.time_taken_seconds` migration exists.
- `responses` base table is defined in `20240426060000_add_quiz_flow.sql`.

Missing or mismatched:

- No migration found for `session_players` table, although app uses it extensively.
- No migration found for `responses.round_results_seen_at`.
- No migration found for `responses.difficulty`.
- No migration found for `responses.points_possible`.
- No migration found for some session fields used by app, including `questions_by_difficulty`, `question_count`, `time_per_question`, and `current_phase`.
- RLS insert policy in `20240426060000_add_quiz_flow.sql` validates `student_name = responses.player_id`, while app now writes `session_players.id`.
- `supabase-rls-policies.sql` allows anyone to view sessions with status `active` or `waiting`, but student flow also needs `choosing_difficulty`, `round_results`, and `finished`.

Recommended direction:

- Add migrations for all app-used columns.
- Update response insert RLS to support stable `session_players.id`.
- Move session finalization to instructor/server authority.
- Add validated RPCs for answer submission and student readiness if possible.

## 11. Routing and Navigation Review

Main router:

- `src/App.jsx`

Routes currently include:

- `/student/join`
- `/student/lobby`
- `/student/difficulty`
- `/student/question`
- `/student/result`
- `/student/final-results`
- `/student/waiting-for-others`
- `/student/round-results`
- `/instructor/login`
- `/instructor/register`
- `/instructor/dashboard-official`
- `/instructor/session-official`
- `/instructor/questions-preview`
- `/instructor/create-session`
- `/instructor/live-quiz`
- `/instructor/final-results`
- `/instructor/score-distribution`

Strengths:

- Final-status routing exists across major student pages.
- `playerId` / `sessionPlayerId` is passed through most navigation state.
- Final Results can recover using `gameCode` or `sessionId`.

Risks:

- Route state is required for many transitions and may be missing after reload or direct navigation.
- `/student/result` and `/student/leaderboard` style older pages are not clearly part of the current flow.
- Many pages duplicate final-status and session-status navigation checks.

## 12. UI / UX Issues

Known issues:

- Mojibake/encoding artifacts are still visible in multiple files, including `Lobby.jsx`, `Question.jsx`, `RoundResults.jsx`, and instructor pages.
- Several screens use very large glowing backgrounds and heavy visual effects, which can affect readability and mobile performance.
- The UI uses nested rounded cards and dense gradients in many places.
- Long generated question/answer text could still overflow in some compact panels.
- `RoundResults.jsx` mixes result display, readiness status, countdown, leaderboard, and navigation in one screen.
- Upload UI does not expose PPTX even though the API supports it.

Positive current UX:

- Student Round Results shows selected answer and correct answer.
- Difficulty cards display point values.
- Final Results shows leaderboard ranking and per-student score state.
- Duplicate student-name error is clear.

## 13. Code Quality Issues

Current status:

- ESLint passes.
- Build passes outside sandbox.

Structural issues:

- `Question.jsx` is very large and combines data loading, realtime subscription, timer logic, timeout handling, answer submission, scoring, and UI.
- `RoundResults.jsx` is very large and combines result display, readiness tracking, countdown, finalization, polling, leaderboard, and UI.
- `DashboardOfficial.jsx` is very large and handles upload, manual questions, bank management, AI generation, session creation, and UI.
- Several flow rules are duplicated across student pages.
- Old utility and legacy pages are still present without clear ownership.
- Console logging is extensive in production-facing paths.

## 14. Security and Environment Review

Environment variables and services:

- Frontend uses Supabase client configuration in `src/lib/supabase.js`.
- API generation requires Supabase service configuration and `OPENROUTER_API_KEY`.
- Render deployment uses `server.js` to serve both the frontend and the AI API from one Node Web Service.
- `.env` is open in the IDE but was not inspected in this audit report output.

Risks:

- Student clients directly update some global session state.
- RLS policies in the repo appear incomplete for the current stable-player-ID model.
- API route uses server-side service credentials and must only run server-side.
- Removing Vercel config means deployment must be revalidated, but Render now has an Express route for `/api/generate-questions`.
- Render must not expose `SUPABASE_SERVICE_ROLE_KEY` or `OPENROUTER_API_KEY` to the Vite client; keep them only as server environment variables.
- `localStorage` stores session/player identity and can be edited by a user; DB/RLS must be the source of truth.

## 15. Build and Lint Status

Commands run:

```text
npm run lint
npm run build
```

Lint:

- `npm run lint` passed.

Build:

- Sandboxed `npm run build` failed with:

```text
X [ERROR] Cannot read directory "../../../..": Access is denied.
X [ERROR] Could not resolve "C:\Users\imm26\OneDrive - Umm Al-Qura University\Desktop\GraduationProject\quiz-play\vite.config.js"
failed to load config from C:\Users\imm26\OneDrive - Umm Al-Qura University\Desktop\GraduationProject\quiz-play\vite.config.js
```

Likely cause:

- Sandbox filesystem restriction while Vite/esbuild resolves the config path from a OneDrive-backed workspace.

Escalated/outside-sandbox build:

- Passed.
- Output included:

```text
dist/index.html                 0.49 kB
dist/assets/index-CO7YIPBv.css  157.86 kB
dist/assets/index-Cm_3nihd.js   758.27 kB
```

Remaining build warning:

```text
Some chunks are larger than 500 kB after minification.
```

## 16. Recommended Fix Plan

1. Stabilize Git state.
   - Decide whether to keep or discard the current uncommitted source changes in `Question.jsx` and `RoundResults.jsx`.
   - If keeping streak bonus, commit it separately from this audit report.

2. Fix schema/RLS drift.
   - Add missing migrations for all app-used columns and `session_players`.
   - Update response insert policy to allow `responses.player_id = session_players.id`.
   - Add or validate `responses.round_results_seen_at`.

3. Move finalization authority.
   - Remove or replace student-side `markSessionFinished(...)` in `RoundResults.jsx`.
   - Keep session finalization in instructor/server-controlled paths.

4. Persist scoring metadata.
   - Add `responses.difficulty`.
   - Add `responses.points_possible`.
   - Keep `responses.points_awarded` as the final score source.

5. Clarify deployment.
   - Render Node Web Service deployment is now prepared through `server.js`.
   - Verify Render build command `npm run build` and start command `npm start`.
   - Verify `/api/generate-questions` works on Render with server-side env vars.

6. Align AI upload support.
   - Add PPTX to the upload accept list if PPTX should be user-selectable.
   - Remove DOC from accept list unless DOC support is added.

7. Reduce component complexity.
   - Extract shared student session/player recovery helpers.
   - Extract scoring/answer-submission logic.
   - Extract Round Results readiness logic.

## 17. Manual Test Cases

Git/deployment:

1. Confirm `git status` reports only expected local files.
2. Confirm `git ls-files vercel.json` returns no output.
3. Confirm production deployment serves `/api/generate-questions` after Vercel config removal.

Scoring:

4. Easy correct answer stores `points_awarded = 10`.
5. Medium correct answer stores `points_awarded = 25`.
6. Hard correct answer stores `points_awarded = 50`.
7. Incorrect answer stores `points_awarded = 0`.
8. Final Results, Instructor Live Rankings, and Score Distribution show the same order.

Streak bonus, current local working tree only:

9. Q1 correct stores base points only.
10. Q2 correct after Q1 correct stores base points only.
11. Q3 correct after Q1 and Q2 correct stores base points + `5`.
12. Q4 correct after Q1-Q3 correct stores base points only.
13. Q5 correct after Q1-Q4 correct stores base points only.
14. Q6 correct after Q1-Q5 correct stores base points + `5`.
15. Correct, Correct, Wrong, Correct, Correct, Correct gives `+5` only on the final correct answer.
16. Re-submitting/upserting the same question does not count itself toward the streak.

Identity:

17. Student joins and `session_players.id` is stored as `playerId` / `sessionPlayerId`.
18. Same browser can rejoin same game/name with stored player ID.
19. Duplicate display names are blocked case-insensitively.
20. Old sessions with `responses.player_id = studentName` still display scores.

Flow:

21. Instructor clicks End Quiz while students are in Lobby; students reach Final Results.
22. Instructor clicks End Quiz while students are in Difficulty; students reach Final Results.
23. Instructor clicks End Quiz while students are in Question; students reach Final Results.
24. Instructor clicks End Quiz while students are in Round Results; students reach Final Results.
25. Last round completion moves all students to Final Results.
26. Timeout creates exactly one zero-point response.
27. Student selects an answer and remains on `Question.jsx`.
28. After answering, all answer choices are disabled.
29. After answering, Question page shows only the neutral waiting message.
30. After answering, Question page does not show correct/wrong status, correct answer, points, or streak bonus.
31. When the shared session status becomes `round_results`, the student navigates to `RoundResults.jsx`.
32. `RoundResults.jsx` reveals selected answer, correct answer, correct/wrong status, points earned, and streak bonus if awarded.
33. Instructor End Quiz still sends students from Question page to Final Results.
34. Disable or miss a Supabase realtime event, then verify `Question.jsx` still navigates to Round Results through the polling fallback within a few seconds.
35. Verify `Question.jsx` navigates to Round Results when `show_round_results = true` even if `status` is not refreshed locally.
36. Verify `Question.jsx` navigates to Round Results when `current_phase = "round_results"` if that convention is used.
37. Verify `WaitingForOthers.jsx` navigates to Final Results when `status = "finished"` or `current_phase = "final_results"`.

AI generation:

38. Upload TXT and generate valid easy/medium/hard banks.
39. Upload PDF with extractable text and generate valid banks.
40. Upload CSV and generate valid banks.
41. Upload JSON and generate valid banks.
42. Upload MD and generate valid banks.
43. Upload DOCX and generate valid banks.
44. Upload PPTX directly if UI support is added, or verify API behavior separately.

RLS/schema:

45. Student response insert succeeds when `responses.player_id` is a `session_players.id`.
46. `round_results_seen_at` update succeeds.
47. Students can read sessions in `waiting`, `choosing_difficulty`, `active`, `round_results`, and `finished`.

## 18. Quick Wins

1. Decide and clean up the current uncommitted source changes.
2. Add `.pptx` to the upload accept list or remove PPTX from documented UI support.
3. Add migrations for `responses.round_results_seen_at`, `responses.difficulty`, and `responses.points_possible`.
4. Update response insert RLS for stable `session_players.id`.
5. Document the deployment/API routing strategy after `vercel.json` removal.
6. Remove or mark legacy pages and scripts that are no longer used.
7. Reduce production console logging in `Question.jsx`, `RoundResults.jsx`, `InstructorLiveQuiz.jsx`, and `api/generate-questions.js`.
8. Split large student/instructor components into hooks and smaller view components.
