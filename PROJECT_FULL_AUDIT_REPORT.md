# Project Full Audit Report

Audit date: 2026-05-14  
Project: `quiz-play`  
Scope: React/Vite frontend, student flow, instructor flow, scoring, leaderboard, Score Distribution, AI question generation, Supabase schema/RLS, routing, localStorage, security, build/lint, UI/UX, and old files.

## 1. Executive Summary

The current `quiz-play` codebase reflects most of the recent fixes. The scoring model is now centralized around Easy = `10`, Medium = `25`, Hard = `50` in `src/utils/leaderboard.js`, and final scores are calculated by summing `responses.points_awarded` for correct responses in `calculateLeaderboard(...)`. Student final results, instructor live rankings, student round status, and instructor Score Distribution now use the shared leaderboard helper.

Player identity is significantly safer than before. New student joins store `session_players.id` as `playerId`/`sessionPlayerId`, answer submission writes that stable ID to `responses.player_id`, leaderboard matching prefers player ID, and "You" highlighting uses player ID where available. `src/pages/student/JoinGame.jsx` also blocks duplicate display names within the same session using trimmed, case-insensitive comparison and shows the clear message: `This name is already used in this game. Please choose another name.`

Instructor End Quiz now writes `sessions.status = "finished"` in `src/pages/instructor/InstructorLiveQuiz.jsx`. Student pages have final-status routing in Lobby, Difficulty, Question, WaitingForOthers, and RoundResults. The important recent bug where students on `Difficulty.jsx` did not immediately move to Final Results has been fixed with a session-row watcher plus polling fallback.

AI question generation now supports PDF, TXT, CSV, JSON, MD, DOCX, and PPTX in `api/generate-questions.js`. DOCX/PPTX support extracts plain text from Office Open XML files without adding a new dependency.

The remaining highest risks are:

- `npm run lint` completes with 0 warnings and 0 errors.
- `src/pages/student/RoundResults.jsx` can still mark the whole session `finished` from a student client through `markSessionFinished(...)`.
- Supabase migrations and `supabase-rls-policies.sql` do not fully match the tables/columns and identity model used by current code.
- Existing old sessions with name-based `responses.player_id` remain best-effort only when duplicate display names existed.
- UI text contains widespread mojibake/encoding artifacts.
- The production build passes, but the JS bundle remains larger than 500 kB after minification.

## 2. Detailed Change History / What Was Already Implemented

Confirmed implemented:

- `src/utils/leaderboard.js`
  - Defines `DIFFICULTY_POINTS` as `easy: 10`, `medium: 25`, `hard: 50`.
  - Exports `getDifficultyPoints(...)`.
  - `calculateLeaderboard(...)` groups responses by `response.player_id`.
  - Matches by `session_players.id` first and only falls back to name keys for old data.
  - Sums score from correct `points_awarded` values.
  - Keeps deterministic tie-breaking by score, completion time, join time, and name.
  - Provides `getMaxPossibleScore(...)` and `getScoreDistributionBuckets(...)` for Score Distribution.

- `src/pages/student/JoinGame.jsx`
  - Creates or reuses a `session_players` row.
  - Stores `session_players.id` as `playerId` and `sessionPlayerId` in route state and localStorage.
  - Keeps `studentName` for display.
  - Allows same-browser rejoin when a stored player ID matches an existing player.
  - Blocks new duplicate display names in the same session after trim/lowercase normalization.

- `src/pages/student/Difficulty.jsx`
  - Uses `getDifficultyPoints(...)` for displayed difficulty values.
  - Timeout response path prefers stable `session_players.id`.
  - Watches the shared `sessions` row for `status === "finished"` or `current_phase === "final_results"`.
  - Redirects immediately to `/student/final-results` with `replace: true` and preserves `sessionId`, `gameCode`, `studentName`, `playerId`, and `sessionPlayerId`.
  - Previous `handleDifficultyTimeout` hook dependency warning is fixed.

- `src/pages/student/Question.jsx`
  - Uses `getDifficultyPoints(...)`.
  - Writes `responses.points_awarded`.
  - Uses stable `session_players.id` for new `responses.player_id` when available.
  - Checks legacy player-name response IDs for backward compatibility.
  - Listens for final session status and routes to Final Results.
  - Previous React Hook dependency warnings are fixed.

- `src/pages/student/Lobby.jsx`
  - Previous React Hooks conditional-order issue is fixed.
  - Uses final-status routing to Final Results.
  - Carries `playerId`/`sessionPlayerId` forward.
  - Current-player display/highlight prefers player ID.
  - Compact lobby layout is present.

- `src/pages/student/RoundResults.jsx`
  - Uses `calculateLeaderboard(...)` for student status scoring.
  - Uses `playerId` for current-student matching, with name fallback.
  - Redirects to Final Results on final session status.
  - Marks `responses.round_results_seen_at` using player ID/name fallback.
  - Shows the selected answer and correct answer as option letters only.

- `src/pages/student/FinalResults.jsx`
  - Uses `calculateLeaderboard(...)`.
  - Looks up current student by `playerId` first, `studentName` second.
  - Highlights "You" by player ID when available.
  - Reads responses by player ID first and falls back to name-based rows for old data.

- `src/pages/student/WaitingForOthers.jsx`
  - Has compact layout.
  - Redirects to Round Results on `round_results`.
  - Redirects to Final Results on `finished` or `current_phase === "final_results"`.
  - Recovers `playerId`/`sessionPlayerId` from route state, `quizplay_session_${gameCode}`, or `quizplay_player_${gameCode}_${studentName}`.
  - Preserves `studentName`, `gameCode`, `sessionId`, `playerId`, and `sessionPlayerId` when navigating to Round Results or Final Results.

- `src/pages/instructor/InstructorLiveQuiz.jsx`
  - Uses `calculateLeaderboard(...)`.
  - End Quiz sets `sessions.status = "finished"`, `quiz_finished_at`, `show_round_results: false`, and `current_question_ends_at`.
  - Instructor navigates to `/instructor/final-results`.
  - Previous React Hook dependency warnings are fixed.

- `src/pages/instructor/InstructorFinalResults.jsx`
  - Previous `gameCode` hook dependency warning is fixed.
  - Questions Analysis and Score Distribution navigation remain present.

- `src/pages/instructor/InstructorScoreDistribution.jsx`
  - Uses `calculateLeaderboard(...)`.
  - Uses `getScoreDistributionBuckets(...)`.
  - Includes `handleShowMostMissedQuestion(...)`.
  - Back to Questions Analysis button navigates to `/instructor/final-results` with state.

- `src/pages/instructor/SessionOfficial.jsx`
  - Previous unused `getStudentJoinedTime` issue is fixed.
  - Previous `fallbackSession` hook dependency warning is fixed.

- `api/generate-questions.js`
  - Keeps existing PDF/text extraction.
  - Adds DOCX/PPTX plain-text extraction from Office Open XML files.
  - Unsupported type message now lists all supported formats.
  - No-readable Office files return: `No readable text found in this Word/PowerPoint file. Please upload a text-based file or PDF.`
  - Previous unused variables such as `fileContent` and `bodySessionId` are fixed.

- `eslint.config.js`
  - Treats `functions/**/*.js`, `api/**/*.js`, and `vite.config.js` as Node files.
  - Previous `process` and `Buffer` undefined errors for Node/server files no longer appear.

- `supabase/migrations/20260514190000_add_unique_response_constraint.sql`
  - Adds `responses_unique_player_question`.
  - Constraint: `UNIQUE (session_id, question_id, player_id)`.
  - Duplicate responses were checked with a grouped query before migration creation, and no duplicates were found.

- Removed legacy files:
  - `original_InstructorLiveQuiz.jsx` is not present.
  - `original_InstructorLiveQuiz_utf8.jsx` is not present.

## 3. Critical Bugs

1. `src/pages/student/RoundResults.jsx` still lets a student client finish the whole session.
   - Function: `markSessionFinished(...)`.
   - It updates the shared `sessions` row with `status: "finished"` and `quiz_finished_at: new Date().toISOString()`, then calls `goToFinalResults(...)` for that student.
   - It is called only from the Round Results countdown/navigation effect after `targetTime` has passed and `Number(currentRound) >= maxRounds`, where `maxRounds` comes from `sessionData.question_count`, route `questionCount`, or a fallback of `1`.
   - `targetTime` is set only after the polling loop sees every joined `session_players` row represented in current-round responses with `round_results_seen_at !== null`, so the intended path is "all students reached/saw Round Results for the last round."
   - This is intentional as a natural final-results transition for the end of the quiz, but it is still risky because any student client that reaches this state can write global session finalization if RLS permits the update.
   - `src/pages/instructor/InstructorLiveQuiz.jsx` already has instructor-owned finalization: manual `finishQuiz()` from End Quiz, `nextRound()` calling `finishQuiz()` when the next round exceeds `question_count`, and a polling auto-finish when every joined student has `questionCount` responses.
   - Removing `markSessionFinished(...)` without replacing the authority could break the natural student-driven final transition if the instructor page is closed, disconnected, or not advancing past the last round.
   - Recommended next action: keep the current behavior only until a safer authority exists, then move or restrict finalization to instructor/server code. Students should preferably listen for `sessions.status === "finished"` or `current_phase === "final_results"` and navigate, not decide or write the shared final status themselves.

2. Supabase RLS still appears incompatible with the current stable-player-ID identity model.
   - `supabase/migrations/20240426060000_add_quiz_flow.sql` has a response insert policy that checks `session_players.student_name = responses.player_id`.
   - New code writes `responses.player_id = session_players.id`.
   - If this policy is active as written, new stable-ID response inserts may be blocked unless production policies differ.

3. Current migrations do not define all columns/tables used by the app.
   - Used but not fully represented: `session_players`, `sessions.questions_by_difficulty`, `sessions.question_count`, `sessions.time_per_question`, `sessions.current_phase`, `responses.round_results_seen_at`, `responses.difficulty`, and `responses.points_possible`.

4. Old name-based response data remains ambiguous.
   - The app supports old rows where `responses.player_id` equals `studentName`.
   - If an old session had duplicate names, exact ownership cannot be reconstructed from the response rows.

## 4. Scoring and Leaderboard Review

Primary file: `src/utils/leaderboard.js`

Current scoring rule:

```js
score = correctResponses.reduce(
  (sum, response) => sum + Number(response.points_awarded || 0),
  0
)
```

Current strengths:

- Shared helper is used across the major scoring surfaces:
  - `src/pages/student/FinalResults.jsx`
  - `src/pages/student/RoundResults.jsx`
  - `src/pages/instructor/InstructorLiveQuiz.jsx`
  - `src/pages/instructor/InstructorScoreDistribution.jsx`
- Scores now reflect difficulty because they sum stored awarded points.
- Player matching prefers `session_players.id`.
- Name fallback preserves old sessions where responses stored display names.
- Duplicate display names no longer merge new sessions when player IDs are present.

Remaining risks:

- `getMaxPossibleScore(...)` can only infer possible score when question metadata or response possible-point data is available.
- Normal responses do not store `points_possible`, so Score Distribution may fall back to inferred or hard-point scaling.
- `src/pages/instructor/InstructorLiveQuiz.jsx` maps leaderboard rows to `{ studentName, totalScore }`; later answered-status logic checks `student.id`, which is likely undefined in that mapped structure.

## 5. Difficulty-Based Scoring Review

Confirmed difficulty values:

- Easy = `10`
- Medium = `25`
- Hard = `50`

Files:

- `src/utils/leaderboard.js`
- `src/pages/student/Difficulty.jsx`
- `src/pages/student/Question.jsx`

Current behavior:

- Difficulty cards in `Difficulty.jsx` read values from `getDifficultyPoints(...)`.
- `Question.jsx` awards the selected/current difficulty value only when correct.
- Final leaderboard score sums `points_awarded` for correct responses.

Remaining issues:

- `responses.difficulty` is not written for normal answer submissions.
- `responses.points_possible` is not written for normal answer submissions.
- Timeout rows write `points_awarded: 0` but do not preserve the possible point value.
- Analytics must infer possible score from session question banks or response history.

## 6. Student Flow Review

`src/pages/student/JoinGame.jsx`

- Looks up a session by game code.
- Reads existing players.
- Allows stored-player rejoin for the same browser/name/game.
- Blocks duplicate display names for new joins.
- Stores session/player details in localStorage under `quizplay_session_${gameCode}` and `quizplay_player_${gameCode}_${studentName}`.
- Risk: duplicate-name enforcement is client-side only; a database constraint or RPC would be stronger.

`src/pages/student/Lobby.jsx`

- Loads lobby state from Supabase/localStorage.
- Redirects to Difficulty when the quiz starts.
- Redirects to Final Results when the session is final.
- Preserves `playerId`/`sessionPlayerId`.
- Previous hook error is fixed.
- Risk: timer cleanup still uses a student-name-based key in one place: `quizplay_round_timer_${gameCode}_${studentName}`.

`src/pages/student/Difficulty.jsx`

- Uses shared difficulty values.
- Creates timeout responses when no difficulty is selected.
- Detects instructor End Quiz immediately.
- Risk: student clients still update global session state to `active` when selecting difficulty.
- Risk: duplicated session update block exists in `handleDifficultySelect(...)`, though behavior appears guarded by `.eq("status", "choosing_difficulty")`.

`src/pages/student/Question.jsx`

- Handles session loading, answer submission, timeout, already-answered checks, and final routing.
- New responses use stable player ID.
- Route state/localStorage remain central to recovery.
- Previous hook dependency warnings for `currentQuestionId`, `sessionData.questionsByDifficulty`, `handleTimeout`, and `checkIfAlreadyAnswered` are fixed.

`src/pages/student/WaitingForOthers.jsx`

- Shows answered count and timer.
- Redirects to Round Results or Final Results.
- Preserves `playerId`/`sessionPlayerId` in both final-results and round-results navigation state.
- Recovers missing player identity from the same localStorage keys used by the student join/rejoin flow.

`src/pages/student/RoundResults.jsx`

- Shows per-round result, round leaderboard, answered/waiting lists, and countdown.
- Uses shared leaderboard for total status score.
- Displays "Your Answer" and "Correct Answer" as option letters only, without full answer text.
- Correct-answer display checks `correct_answer`, `correctAnswer`, `answer`, `correct_option`, and `correctOption`.
- If no correct option can be resolved from the question payload, the page shows `Correct answer is not available`.
- `markSessionFinished(...)` is the student-side finalization path: after all students have seen the last round's results and the countdown target is reached, it writes `sessions.status = "finished"` and `quiz_finished_at`, then navigates the current student to Final Results.
- The behavior appears intentional for a natural end-of-quiz transition, especially if the instructor page is not driving the last transition, but it duplicates authority already present in `InstructorLiveQuiz.jsx`.
- Recommendation: restrict or move this finalization to instructor/server authority. Keep students as listeners where possible; if student-side fallback is retained, guard it with stricter RLS/RPC validation that verifies session membership, final round, and all required responses/readiness.
- Risk: uses `responses.round_results_seen_at`, which is not present in current migrations.
- Risk: question data that lacks a correct option field, and also lacks an exact option-text match, cannot show the correct option letter.

`src/pages/student/FinalResults.jsx`

- Loads results by `sessionId` or `gameCode`.
- Uses shared leaderboard and stable player identity.
- Falls back to name-based response matching for old sessions.
- Risk: direct refresh without stored player ID can degrade "You" highlighting to display-name matching.

`src/pages/student/Result.jsx` and `src/pages/student/Leaderboard.jsx`

- Still present and `/student/result` remains routed.
- They appear older than the current Round Results/Final Results flow.
- Review before removal because routes still exist.

## 7. Instructor Flow Review

`src/pages/instructor/DashboardOfficial.jsx`

- Large page handling auth/session creation/uploads/question banks/navigation.
- Previous 13 unused-variable lint errors are fixed.
- Uses localStorage heavily.
- Remaining risk: the file is still large and handles many workflows in one component, so future changes should stay tightly scoped or split responsibilities carefully.

`src/pages/instructor/SessionOfficial.jsx`

- Session preparation page.
- Recent lint issues are fixed.
- Still depends on route state and localStorage fallback for session/question-bank recovery.

`src/pages/instructor/questions-preview.jsx`

- Question-bank preview/edit page.
- No active lint errors from the latest full lint run.

`src/pages/instructor/InstructorLiveQuiz.jsx`

- Owns live quiz control, phase changes, timers, rankings, End Quiz, and final navigation.
- Uses shared leaderboard helper.
- End Quiz sync with student final redirects is implemented.
- Previous hook dependency warnings for `questionsByDifficulty`, `endRound`, and `nextRound` are fixed.
- Risk: multiple realtime/polling effects plus auto-finish logic make this page fragile.

`src/pages/instructor/InstructorFinalResults.jsx`

- Questions Analysis view.
- Score Distribution navigation is present.
- Recent `gameCode` hook dependency warning is fixed.

`src/pages/instructor/InstructorScoreDistribution.jsx`

- Score distribution and most-incorrect-question analytics.
- Back button to Questions Analysis is implemented.
- Risk: question analytics depend on response `question_id` matching question-bank IDs.

## 8. Supabase and Data Review

Current migrations define:

- `sessions.status`
- `sessions.current_question_id`
- `sessions.current_question_index`
- `sessions.current_difficulty`
- `sessions.current_round`
- `sessions.current_question_started_at`
- `sessions.current_question_ends_at`
- `sessions.show_round_results`
- `sessions.quiz_finished_at`
- `responses.session_id`
- `responses.question_id`
- `responses.player_id`
- `responses.round_number`
- `responses.selected_answer`
- `responses.is_correct`
- `responses.points_awarded`
- `responses.answered_at`
- `responses.created_at`
- `responses.time_taken_seconds`
- `responses_unique_player_question`

Used by code but not fully represented in the current migrations:

- `session_players`
- `sessions.questions_by_difficulty`
- `sessions.question_count`
- `sessions.time_per_question`
- `sessions.current_phase`
- `responses.round_results_seen_at`
- `responses.difficulty`
- `responses.points_possible`

Duplicate response status:

- Checked query:
  `SELECT session_id, question_id, player_id, COUNT(*) FROM responses GROUP BY session_id, question_id, player_id HAVING COUNT(*) > 1;`
- Reported result: no duplicate rows found.
- Migration added: `supabase/migrations/20260514190000_add_unique_response_constraint.sql`.
- Constraint name: `responses_unique_player_question`.

RLS risks:

- `supabase-rls-policies.sql` only allows anyone to view sessions with `status IN ('active', 'waiting')`; current student flow also needs `choosing_difficulty`, `round_results`, and `finished`.
- Response insert policy in `20240426060000_add_quiz_flow.sql` still assumes `responses.player_id` is a student display name.
- Student updates to `sessions` should be tightly restricted or moved server-side.

## 9. Score Distribution Review

File: `src/pages/instructor/InstructorScoreDistribution.jsx`

Current strengths:

- Uses `calculateLeaderboard(...)`.
- Uses `getScoreDistributionBuckets(...)`.
- Shows average, highest, lowest, ranked students, and Most Incorrect Question.
- Back to Questions Analysis passes `sessionId`, `gameCode`, `students`, `responses`, `questionsByDifficulty`, `questionCount`, and `session`.

Remaining risks:

- `maxPossibleScore` can be approximate without `points_possible`.
- Bucket labels can look odd for small quizzes because ranges are mechanical.
- Most Incorrect Question only works well when response question IDs match the stored question-bank IDs.
- Button label source contains mojibake before `Back to Questions Analysis`.

## 10. AI Question Generation Review

File: `api/generate-questions.js`

Supported uploads:

- PDF
- TXT
- CSV
- JSON
- MD
- DOCX
- PPTX

Current implementation:

- PDF uses `pdf-parse`.
- Text files are decoded as UTF-8.
- DOCX/PPTX are parsed as Office Open XML zip containers using Node `zlib` inflation.
- DOCX extraction reads Word XML entries such as document/header/footer/footnote/endnote files.
- PPTX extraction reads slide XML entries in slide-number order.
- Extracted text is passed into the same AI generation prompt path as PDF/text input.

Limitations:

- No OCR for scanned PDFs or image-only Office files.
- Does not extract text from images, charts, SmartArt, embedded media, speaker notes, comments, or legacy binary `.doc`/`.ppt`.
- Plain-text extraction does not preserve formatting.
- No explicit upload size/rate limit is visible in this API route.
- Uses OpenRouter models; free model availability and reliability can vary.

Fixed lint/API issues:

- `api/**/*.js` is treated as Node by ESLint.
- `process`/`Buffer` undefined errors no longer appear.
- `api/generate-questions.js` currently has no lint errors or warnings in the full lint output.

## 11. Routing and Navigation Issues

Routes are defined in `src/App.jsx`.

Current improvements:

- End Quiz writes shared final status.
- Lobby, Difficulty, Question, WaitingForOthers, and RoundResults respond to final status.
- Score Distribution back navigation to Questions Analysis works.

Remaining concerns:

- Most student pages still depend on route state for `studentName`, `gameCode`, `sessionId`, and `playerId`.
- localStorage recovery is partial and inconsistent across pages.
- Several clients can still drive global phase transitions:
  - Instructor Live Quiz.
  - Student Difficulty.
  - Student Round Results.
- `/student/result` and `/student/leaderboard`-style older pages should be reviewed against the current flow before being kept long term.

## 12. UI / UX Issues

Current strengths:

- Lobby, Question, and WaitingForOthers have compact layout changes.
- Student flow has a consistent racing/game visual style.
- Score Distribution provides practical instructor analytics.

Issues:

- Mojibake/encoding artifacts are widespread, including `Lobby.jsx`, `Difficulty.jsx`, `Question.jsx`, `RoundResults.jsx`, `FinalResults.jsx`, and `InstructorScoreDistribution.jsx`.
- Decorative background content is very large in several pages and makes files difficult to maintain.
- Some pages may still feel crowded on smaller laptop screens.
- Round Results mixes round-only result data with total-score status; labels should be checked manually.
- Error/loading states are inconsistent.
- Duplicate-name blocking improves clarity but may surprise students who expect same first names to be allowed.

## 13. Code Quality Issues

Active quality concerns:

- `src/pages/instructor/DashboardOfficial.jsx` is very large and handles many responsibilities, though its previous unused-variable lint errors are fixed.
- `src/pages/instructor/InstructorLiveQuiz.jsx` mixes live control, timers, polling, realtime, ranking, and navigation, though its previous hook dependency warnings are fixed.
- `src/pages/student/Question.jsx` has several responsibilities, though its previous hook dependency warnings are fixed.
- `src/pages/student/RoundResults.jsx` mixes readiness tracking, countdown, finalization, leaderboard, and UI.
- `src/lib/supabase.js` still has a no-op `updateSessionQuestions(...)`, but its previous unused-variable lint errors are fixed.
- `clear_loop.js` and `clear_session.js` remain in the project root and appear to be ad hoc cleanup/debug scripts.
- `public/vite.svg` and `src/assets/react.svg` remain from the Vite starter and appear unused.
- `functions/` remains even though the current AI route is `api/generate-questions.js`; confirm whether Firebase Functions are still deployed.

Already fixed and no longer active:

- Lobby hook-rule issue.
- Node globals lint errors in API/Vite files.
- `SessionOfficial.jsx` unused helper and fallback dependency warning.
- `Difficulty.jsx` `handleDifficultyTimeout` dependency warning.
- `InstructorFinalResults.jsx` `gameCode` dependency warning.
- `api/generate-questions.js` unused-variable errors.
- `DashboardOfficial.jsx` unused-variable errors for `fileContent`, `fileMimeType`, `uploadedFileId`, `isReadingFile`, `selectedSession`, `setSelectedSession`, `deleteSessionRecord`, `deleteSelectedSessions`, `deleteSelectedBanks`, `handleCreateManualSession`, `fromUploadFile`, `difficulty`, and `fromBankOnly`.
- `src/lib/supabase.js` unused-variable errors for the omitted `id` in `createSession(...)` and unused `gameCode`/`questionsByDifficulty` parameters in `updateSessionQuestions(...)`.
- `Question.jsx` hook dependency warnings for `currentQuestionId`, `sessionData.questionsByDifficulty`, `handleTimeout`, and `checkIfAlreadyAnswered`.
- `InstructorLiveQuiz.jsx` hook dependency warnings for `questionsByDifficulty`, `endRound`, and `nextRound`.
- Legacy original instructor files.

## 14. Security and Environment Review

Environment variables used:

- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- API/server: `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, optional `SUPABASE_URL`, optional `APP_URL`

Risks:

- `.env` exists locally; ensure it is never committed and does not contain production secrets in source control.
- `api/generate-questions.js` uses Supabase service role and must remain server-only.
- Upload generation endpoint lacks visible rate limiting and upload size enforcement.
- Client-side session status updates remain a security risk if RLS permits them broadly.
- Current response RLS policies may not match stable `session_players.id` player identity.
- Duplicate display-name blocking is client-side; a database-backed normalized uniqueness rule would be stronger.

## 15. Build and Lint Status

`npm run build`

- First sandboxed run failed with:
  - `Cannot read directory "../../../..": Access is denied.`
  - `Could not resolve "...\\quiz-play\\vite.config.js"`
- Approved rerun outside the sandbox passed.
- Vite transformed 102 modules.
- Output:
  - `dist/index.html`
  - `dist/assets/index-CO7YIPBv.css`
  - `dist/assets/index-BjEE3BXP.js`
- Warning remains: some chunks are larger than 500 kB after minification.

`npm run lint`

- Status: passed.
- Current total: 0 problems.
- Current errors: 0.
- Current warnings: 0.

Active lint errors grouped by file:

- None.

Active lint warnings grouped by file:

- None.

Issues already fixed and no longer appearing:

- No `process` or `Buffer` undefined errors from `api/generate-questions.js`.
- No active lint errors from `vite.config.js`.
- No active lint errors or warnings from `api/generate-questions.js`.
- No active lint errors or warnings from `src/pages/student/JoinGame.jsx`.
- No active lint errors or warnings from `src/pages/student/Difficulty.jsx`.
- No active lint errors or warnings from `src/pages/student/Lobby.jsx`.
- No active lint errors or warnings from `src/pages/student/Question.jsx`.
- No active lint errors or warnings from `src/pages/instructor/DashboardOfficial.jsx`.
- No active lint errors or warnings from `src/pages/instructor/InstructorLiveQuiz.jsx`.
- No active lint errors or warnings from `src/lib/supabase.js`.
- No active lint errors or warnings from `src/pages/instructor/SessionOfficial.jsx`.
- No active lint errors or warnings from `src/pages/instructor/InstructorFinalResults.jsx`.
- No legacy `original_InstructorLiveQuiz*` lint/parsing errors.

## 16. Recommended Fix Plan

1. Align Supabase schema and RLS with current code.
   - Add migrations for missing fields/tables used by the app.
   - Update response insert policy to allow `responses.player_id = session_players.id`.
   - Apply and verify `responses_unique_player_question` in the target Supabase project.

2. Move global session authority away from student clients.
   - Move `markSessionFinished(...)` out of `RoundResults.jsx` into instructor/server authority, or restrict it behind a validated RPC/RLS rule.
   - Preserve the natural final-results flow by having students listen for instructor/server final status rather than removing the transition without replacement.
   - Restrict student updates to `sessions.status` unless intentionally allowed.
   - Prefer instructor/server-controlled phase transitions.

3. Persist possible scoring metadata.
   - Add and write `responses.difficulty`.
   - Add and write `responses.points_possible`.
   - Keep `responses.points_awarded` as the score source.

4. Finish player identity propagation.
   - Use player ID for timer/localStorage keys consistently.
   - Add a database-backed duplicate display-name guard if schema changes are allowed.

5. Clean UI text encoding and old files.
   - Replace mojibake with valid text/icons.
   - Review `Result.jsx`, `Leaderboard.jsx`, `clear_loop.js`, `clear_session.js`, `functions/`, and starter assets.

## 17. Manual Test Cases

Scoring:

1. Easy correct answer produces `10` points.
2. Medium correct answer produces `25` points.
3. Hard correct answer produces `50` points.
4. Easy + Hard correct answers produce `60`.
5. Easy + Medium + Hard correct answers produce `85`.
6. Incorrect answer writes `points_awarded = 0`.
7. Student Final Results, Instructor Live Rankings, and Score Distribution show the same score/order.

Player identity:

8. Student joins and `session_players.id` is stored as `playerId`/`sessionPlayerId`.
9. Answer submission writes `responses.player_id = session_players.id`.
10. Same browser can rejoin the same game/name with stored player ID.
11. A new browser joining as `Ahmed`, ` ahmed `, or `AHMED` when that name exists gets the clear duplicate-name error.
12. "You" highlighting follows `playerId`.
13. Old sessions where `responses.player_id = studentName` still display using fallback.

Final flow:

14. Instructor clicks End Quiz while students are in Lobby; students reach Final Results.
15. Instructor clicks End Quiz while students are in Difficulty; students immediately reach Final Results without selecting difficulty.
16. Instructor clicks End Quiz while students are in Question; students reach Final Results.
17. Instructor clicks End Quiz while students are in WaitingForOthers; students reach Final Results.
18. Instructor clicks End Quiz while students are in RoundResults; students reach Final Results.

Score Distribution:

19. Score Distribution uses the same rankings as Final Results.
20. Back to Questions Analysis returns to `InstructorFinalResults.jsx` with session state.
21. Most Incorrect Question works when question IDs match.
22. Score buckets remain reasonable for short and long quizzes.

AI generation:

23. Upload PDF and generate questions.
24. Upload TXT, CSV, JSON, and MD and verify existing support.
25. Upload DOCX with headings/paragraphs/bullets and verify text-based generation.
26. Upload PPTX with slide titles/bullets/text boxes and verify slide text extraction.
27. Upload image-only DOCX/PPTX and expect the no-readable-text Office error.
28. Upload unsupported file and expect the all-format unsupported-file message.

Data/RLS:

29. Apply the unique response migration and verify duplicate inserts/upserts do not create duplicate rows.
30. Verify response insert RLS works with `session_players.id`.
31. Verify students can read session status in `waiting`, `choosing_difficulty`, `active`, `round_results`, and `finished`.
32. Verify students cannot arbitrarily finish sessions unless that is intentionally allowed.

## 18. Quick Wins

1. Update response RLS to match stable `session_players.id` identity.
2. Add missing migrations for `session_players`, `questions_by_difficulty`, `question_count`, `time_per_question`, `current_phase`, and `round_results_seen_at`.
3. Add `responses.difficulty` and `responses.points_possible`.
4. Remove or document `clear_loop.js` and `clear_session.js`.
5. Remove unused Vite starter assets if confirmed unused: `public/vite.svg`, `src/assets/react.svg`.
6. Add unit tests for `calculateLeaderboard(...)` covering mixed difficulty scores and duplicate display names.
7. Add small fixtures for AI extraction: TXT, DOCX, PPTX, unsupported file, and no-readable-text Office file.
