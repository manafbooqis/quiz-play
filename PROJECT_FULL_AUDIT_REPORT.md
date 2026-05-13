# Project Full Audit Report

Audit date: 2026-05-13  
Project: `quiz-play`  
Scope: React/Vite frontend, student flow, instructor flow, Supabase usage, AI API route, scoring, leaderboard, routing, localStorage, security, build/lint, and recent implementation history.

## 1. Executive Summary

`quiz-play` is a React + Vite quiz application with student and instructor flows backed mainly by Supabase. The app builds successfully, but lint currently fails across multiple files because of unused variables, Node globals not configured for server files, one malformed legacy file, and React hook rule violations.

The most important functional area is quiz state synchronization. Recent changes moved scoring and final-result navigation closer to shared Supabase state, which is the right direction. However, there are still material risks:

- Final scoring is still not fully correct for mixed difficulty scoring. If easy/medium/hard questions are worth different points, the final score should be `sum(points_awarded for correct responses)`, not `correctAnswers * pointsPerQuestion`.
- `src/utils/leaderboard.js` currently infers a single `pointsPerQuestion` from correct `responses.points_awarded`. That may work only for sessions where every question has the same point value.
- `RoundResults.jsx` and some instructor live ranking/status panels still display `total_score` or `points_awarded` in places, which can be acceptable for per-round display but risky if interpreted as final ranking.
- Some student pages still use `localStorage` and route state for progress/timers. These are useful as UX helpers but should not be authoritative for final navigation or scoring.
- Supabase RLS policies appear incomplete for the actual student flow. Student reads/writes may require policies not shown in the migrations, and some policies only allow viewing sessions in `active` or `waiting`, which can break refreshes during `round_results` or `finished`.

## 2. Project Overview

Main stack:

- React `19.2.0`
- Vite `7.3.1`
- React Router `7.13.1`
- Supabase JS `2.104.1`
- Tailwind CSS via `@tailwindcss/vite`
- Vercel-style serverless route in `api/generate-questions.js`
- Legacy Firebase function in `functions/index.js`

Routes are defined in `src/App.jsx`:

- Student:
  - `/student/join` -> `JoinGame.jsx`
  - `/student/lobby` -> `Lobby.jsx`
  - `/student/difficulty` -> `Difficulty.jsx`
  - `/student/question` -> `Question.jsx`
  - `/student/result` -> `Result.jsx`
  - `/student/waiting-for-others` -> `WaitingForOthers.jsx`
  - `/student/round-results` -> `RoundResults.jsx`
  - `/student/final-results` -> `FinalResults.jsx`
- Instructor:
  - `/instructor/login`
  - `/instructor/register`
  - `/instructor/dashboard-official`
  - `/instructor/session-official`
  - `/instructor/questions-preview`
  - `/instructor/create-session`
  - `/instructor/live-quiz`
  - `/instructor/final-results`
  - `/instructor/score-distribution`

Supabase client:

- `src/lib/supabase.js` requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Helper functions include `getSessionById`, `getSessionsByOwner`, `createSession`, `getSessionPlayers`, and `insertSessionPlayer`.
- `updateSessionQuestions` currently logs that questions are stored in another table and returns no-op data. This should be reviewed because much of the app actually stores question banks on `sessions.questions_by_difficulty`.

## 3. Detailed Change History / What Was Already Implemented

### 3.1 Final Results leaderboard scoring fix

Files changed:

- `src/pages/student/FinalResults.jsx`
- `src/utils/leaderboard.js`

What changed:

- Final Results stopped calculating each player's score locally in the component using ad hoc `scoreMap` logic.
- A shared helper, `calculateLeaderboard`, was introduced in `src/utils/leaderboard.js`.
- Final Results now calls `calculateLeaderboard(players, responses, sessionQuestionCount, sessionScoringConfig)`.

Why:

- Different students previously saw different scores/rankings because current-user local state, route state, or stale stored score fields could influence the displayed result.

Appears correct:

- The move to one shared helper is correct architecturally.
- The helper uses shared `responses` and `sessions.question_count`, which is the right source for consistent ordering.

Remaining risk:

- The latest helper still does not fully support mixed difficulty scoring. It infers a single `pointsPerQuestion` from correct `responses.points_awarded`, then calculates `correctAnswers * pointsPerQuestion`. If students answer a mix of easy/medium/hard questions, the correct final score should be `sum(points_awarded for correct responses)`.

### 3.2 Removing localStorage / route-state scoring from student FinalResults

Files changed:

- `src/pages/student/FinalResults.jsx`

What changed:

- Final Results now resolves the session from Supabase by `gameCode` or `sessionId`.
- It fetches `session_players` and `responses` from Supabase.
- It no longer uses route-state score values for leaderboard scoring.

Why:

- Route state and localStorage are per-browser and caused inconsistent leaderboard views.

Appears correct:

- Yes, for consistency. Final score display should be based on shared Supabase data.

Remaining risk:

- `answersStatus` in Final Results still filters responses by `r.player_id === studentName`, so the visual question summary may fail if `player_id` is stored as a UUID rather than `student_name`.

### 3.3 Making the current user only highlighted with "You"

Files changed:

- `src/pages/student/FinalResults.jsx`

What changed:

- The current user is found from the leaderboard row and highlighted in the list.
- The `"You"` badge does not change ordering or score.

Why:

- Previously current-user-specific logic could make the active viewer see a different score/order.

Appears correct:

- Yes. Highlighting should be a presentational concern only.

Remaining risk:

- Current-user matching is still based on `player.name === studentName`. If duplicate names exist, the wrong row may be highlighted.

### 3.4 Shared final-results transition using Supabase session status

Files changed:

- `src/pages/student/RoundResults.jsx`
- `src/pages/student/Question.jsx`
- `src/pages/student/WaitingForOthers.jsx`

What changed:

- `RoundResults.jsx` now treats `session.status === "finished"` or `session.current_phase === "final_results"` as final.
- `RoundResults.jsx` subscribes to the shared Supabase session row and redirects all students when final state appears.
- `Question.jsx` was changed so a student reaching their local answer limit goes to Round Results instead of jumping directly to Final Results.

Why:

- Some students moved to Final Results while others stayed on Round Results because each browser made local navigation decisions.

Appears correct:

- Directionally correct: final navigation must follow shared session state.

Remaining risk:

- The schema migration only declares `status` values `waiting`, `active`, `round_results`, and `finished`. There is no migration for `current_phase`, so checking `current_phase` is harmless but not currently backed by schema.
- Any client can potentially call `markSessionFinished` from `RoundResults.jsx` if RLS allows session updates. This should ideally be instructor/server-owned or protected by policy.

### 3.5 RoundResults redirecting to FinalResults based on shared session status

Files changed:

- `src/pages/student/RoundResults.jsx`

What changed:

- Added `isFinalSessionStatus(session)`.
- Added `goToFinalResults`.
- Added a Supabase realtime subscription for the session row.
- Added immediate redirect if the loaded session is already finished.

Why:

- Refreshing or landing on Round Results after the quiz is complete should not trap the student.

Appears correct:

- Yes as a defensive redirect.

Remaining risk:

- `goToFinalResults` depends on route-state `studentName`. Refreshing `/student/round-results` without state can still lose user identity unless there is a persistent student identity strategy.

### 3.6 WaitingForOthers safe redirect after session finished

Files changed:

- `src/pages/student/WaitingForOthers.jsx`

What changed:

- On initial session load, if status is `finished` or phase is `final_results`, it navigates to Final Results.
- Existing realtime status handling already also navigates when updated status is `finished`.

Why:

- A student waiting for others should not stay on that page after completion.

Appears correct:

- Yes.

Remaining risk:

- The page still uses route `sessionId` for response subscriptions. If route state is missing, subscriptions may not work as intended.

### 3.7 Adding shared leaderboard helper

File added:

- `src/utils/leaderboard.js`

What changed:

- Added:
  - `getTotalQuestions`
  - `getPointsPerQuestion`
  - `getMaxPossibleScore`
  - `getScoreDistributionBuckets`
  - `calculateLeaderboard`

Why:

- Student and instructor views needed the same scoring and sorting logic.

Appears correct:

- Good architectural move.

Remaining risk:

- The helper still models score as `correctAnswers * one pointsPerQuestion`. That is not correct for difficulty-based sessions where each correct response can have different point values.
- It should likely calculate `score` as `playerResponses.filter(is_correct).reduce((sum, r) => sum + Number(r.points_awarded || inferredQuestionPoints), 0)`.

### 3.8 Updating Student FinalResults to use shared helper

File changed:

- `src/pages/student/FinalResults.jsx`

What changed:

- It imports `calculateLeaderboard`.
- It passes fetched session data as scoring config.

Why:

- To keep student final results consistent with instructor views.

Appears correct:

- Mostly correct, except for the single-points-per-question limitation.

Remaining risk:

- If no correct response exists, `getPointsPerQuestion` returns `0`, so all scores can show `0` even if configured session/question points exist only in question metadata.

### 3.9 Updating InstructorScoreDistribution to use shared helper

File changed:

- `src/pages/instructor/InstructorScoreDistribution.jsx`

What changed:

- Uses `calculateLeaderboard`.
- Removed reliance on `points_awarded` and `session_players.total_score` for ranking scores.
- Added "Most Incorrect Question" feature in place of old CSV export.
- Fetches full session data for scoring config.

Why:

- Instructor score distribution previously displayed stale/incorrect scores such as 4/5 = 1000.

Appears correct:

- Correct direction.

Remaining risk:

- If the helper remains single-point based, mixed difficulty scoring is still wrong.
- The large diff suggests line endings or encoding changed in this file; review before committing to avoid noisy history.

### 3.10 Updating InstructorLiveQuiz rankings to use shared helper

File changed:

- `src/pages/instructor/InstructorLiveQuiz.jsx`

What changed:

- Live rankings now call `calculateLeaderboard`.
- It maps helper output into `{ studentName, totalScore }` to preserve UI.

Why:

- Live rankings used `session_players.total_score` and `responses.points_awarded` ad hoc.

Appears correct:

- Better consistency with final rankings.

Remaining risk:

- The file still contains old `studentScores` logic that uses `points_awarded`, but it is currently unused.
- Lint warnings remain for hook dependencies.

### 3.11 Updating score distribution buckets

File changed:

- `src/pages/instructor/InstructorScoreDistribution.jsx`
- `src/utils/leaderboard.js`

What changed:

- Buckets no longer hardcode the 0-1000 scale.
- `getScoreDistributionBuckets` generates buckets from `maxPossibleScore`.

Why:

- Custom points can create max scores like 1500.

Appears correct:

- Directionally correct.

Remaining risk:

- If `maxPossibleScore` is wrong because `pointsPerQuestion` inference is wrong, buckets will also be wrong.

### 3.12 Updating scoring from fixed 1000 scale to custom points per question

File changed:

- `src/utils/leaderboard.js`
- Consumers in `FinalResults.jsx`, `InstructorScoreDistribution.jsx`, and `InstructorLiveQuiz.jsx`

What changed:

- Removed fixed `1000 / totalQuestions`.
- Added `getPointsPerQuestion` to use session config fields if present.
- Falls back to inferring points from correct `responses.points_awarded`.

Why:

- A 5-question quiz with 300 points each should max at 1500, not 1000.

Appears correct:

- Correct only when every question has the same point value.

Remaining risk:

- For difficulty-based points, final score should be `sum(points for each correctly answered question)`, not `correctAnswers * pointsPerQuestion`.
- The current implementation can overcount or undercount mixed-difficulty sessions.

### 3.13 Remaining issue: difficulty-based points

Files involved:

- `src/pages/student/Difficulty.jsx`
- `src/pages/student/Question.jsx`
- `src/utils/leaderboard.js`

Current behavior:

- `Difficulty.jsx` assigns:
  - Easy = 100
  - Medium = 200
  - Hard = 300
- `Question.jsx` writes `points_awarded = pointsPerQuestion` only when the response is correct.
- `leaderboard.js` infers one points value from correct rows and multiplies it by `correctAnswers`.

Correct behavior:

- Final score should be:
  - `sum(Number(response.points_awarded || 0) for correct responses)`
- Accuracy should remain:
  - `Math.round((correctAnswers / totalQuestions) * 100)`

Risk:

- This is currently the highest-priority scoring correctness issue.

### 3.14 Student compact layout and instructor final-state sync update

Files changed:

- `src/pages/student/Question.jsx`
- `src/pages/student/WaitingForOthers.jsx`
- `src/pages/student/Lobby.jsx`
- `src/pages/instructor/InstructorLiveQuiz.jsx`

What changed:

- `Question.jsx` spacing was compacted by reducing the main panel padding, header gap, timer card padding, question-card padding, answer-grid gap, and answer-button padding.
- `Question.jsx` still uses a responsive answer grid: one column on small screens and two columns on medium/large screens.
- `WaitingForOthers.jsx` spacing was compacted by reducing outer padding, icon size, card padding, grid gaps, progress spacing, and the tip panel spacing.
- `Lobby.jsx` spacing was compacted further in a later lobby-only pass by reducing the outer vertical padding, hero margins/type size, main card padding, header gap, game-code card padding, waiting-panel height, player-grid gap, player-chip height, and Back to Home button height. On medium and larger screens, the waiting panel and players list now sit in a two-column layout to reduce vertical scrolling.
- `Lobby.jsx`, `Question.jsx`, and `WaitingForOthers.jsx` now treat `session.status === "finished"` or `session.current_phase === "final_results"` as final and navigate students to Final Results with `replace: true`.
- `RoundResults.jsx` already had shared final-state detection, so no additional layout or flow change was needed there.
- `InstructorLiveQuiz.jsx` End Quiz now writes the shared session row to `status: "finished"`, clears `show_round_results`, and sets `current_question_ends_at` to the finish time so students listening to the session row leave their current page.

Remaining risk:

- `current_phase` is still checked defensively by student pages, but the documented schema primarily uses `sessions.status`.
- Refresh recovery still depends on route state/localStorage for some student identity details.
- Hook dependency warnings remain in `Question.jsx` and `InstructorLiveQuiz.jsx`; they were not changed in this compactness/final-sync pass.

## 4. Critical Bugs

1. Mixed difficulty scoring is still conceptually wrong in `src/utils/leaderboard.js`.
   - Current helper calculates `correctAnswers * pointsPerQuestion`.
   - If a player answers 1 easy and 1 hard correctly, score should be `100 + 300 = 400`, not `2 * inferredPointValue`.

2. Student flow still depends heavily on route state and localStorage.
   - `Difficulty.jsx`, `Question.jsx`, `Lobby.jsx`, `RoundResults.jsx`, and `SessionOfficial.jsx` store or read session/question state from localStorage.
   - This is acceptable for cache/UX only, not as source of truth.

3. `src/pages/student/Lobby.jsx` has React hook rule violations.
   - ESLint reports conditional `useEffect` calls at lines 83 and 228.
   - This can cause runtime bugs that are hard to reproduce.

4. Supabase RLS policies may block necessary reads after status changes.
   - `supabase-rls-policies.sql` only allows anyone to view sessions with status `active` or `waiting`.
   - Students need read access during `choosing_difficulty`, `round_results`, and `finished`.

5. Legacy/original instructor backup files were removed after confirming they were unused.
   - `original_InstructorLiveQuiz.jsx` and `original_InstructorLiveQuiz_utf8.jsx` were only referenced by this audit report.
   - They were deleted instead of ignored so ESLint no longer scans stale backup code.
   - Remaining lint issues are in active files, especially Node globals for server/config files and unused variables/hook dependency warnings elsewhere.

## 5. Scoring and Leaderboard Review

Primary shared scoring file:

- `src/utils/leaderboard.js`

Current helper strengths:

- Normalizes player names/IDs.
- Merges response groups by player keys.
- Uses `responses.is_correct` for correctness.
- Uses `sessions.question_count`, with fallback to distinct `responses.question_id`.
- Sorts by score descending, completion time, join time, then name.

Current helper risks:

- Uses one inferred `pointsPerQuestion`.
- Does not sum per-response `points_awarded` for correct answers.
- Does not know question-level point values if no correct answer exists.
- Duplicate student names can collapse in `playersByName`.

Recommended final scoring model:

```js
correctResponses = playerResponses.filter((r) => r.is_correct === true)
score = correctResponses.reduce((sum, r) => sum + Number(r.points_awarded || 0), 0)
correctAnswers = correctResponses.length
accuracy = Math.round((correctAnswers / totalQuestions) * 100)
```

If `points_awarded` is unavailable, fallback should be explicit and documented:

- Session-level `points_per_question`, if schema is added.
- Question-level `points`, if stored.
- Difficulty-derived point map, if `response.difficulty` or question difficulty can be resolved reliably.

## 6. Difficulty-Based Scoring Review

Difficulty points are currently assigned in `src/pages/student/Difficulty.jsx`:

- Easy: `100`
- Medium: `200`
- Hard: `300`

Submission occurs in `src/pages/student/Question.jsx`:

- `pointsPerQuestion` comes from route state.
- `pointsAwarded = isCorrect ? pointsPerQuestion : 0`.
- Response row includes `points_awarded`.

Major issue:

- Final scoring should not multiply correct answer count by a single inferred points value if students can choose different difficulties per round.

Practical fix:

- Keep `responses.points_awarded` as the source for final score totals, but only sum it for rows with `is_correct === true`.
- Do not use `session_players.total_score`; it is stale/cache data.
- Preserve `correctAnswers` from `is_correct`.
- Preserve `accuracy` from `correctAnswers / totalQuestions`.

Schema improvement:

- Add `difficulty` and/or `points_possible` to `responses` so analytics can reliably explain scoring later.

## 7. Student Flow Review

### JoinGame

File: `src/pages/student/JoinGame.jsx`

Observations:

- Looks up session by game code.
- Writes session config to `localStorage`.
- Navigates to Lobby with session state.

Risks:

- localStorage can become stale across sessions.
- Joining logic should ensure duplicate names are handled.

### Lobby

File: `src/pages/student/Lobby.jsx`

Observations:

- Uses Supabase status and localStorage session cache.
- Subscribes/polls session status.
- Layout compactness was improved without changing colors, style identity, content, routing, or Supabase behavior.

Risks:

- ESLint reports conditional hook calls. This is a real React bug risk.
- It navigates to Difficulty for `active` and `choosing_difficulty`, which may be correct, but careful handling is needed if a question is already active.
- Remaining UI/UX risk: large player counts can still require scrolling because the page intentionally shows joined players.

### Difficulty

File: `src/pages/student/Difficulty.jsx`

Observations:

- Lets students choose easy/medium/hard.
- Has fixed difficulty points.
- Starts/continues shared round timer using localStorage.
- Updates session status to `active` with first-write-wins.

Risks:

- It contains duplicated session update code.
- It declares an unused `bank` variable.
- Difficulty selection is partly client-driven. Any student can attempt to set session `status: active` if RLS permits.

### Question

File: `src/pages/student/Question.jsx`

Observations:

- Loads session and current question from Supabase.
- Subscribes to session updates.
- Inserts/upserts responses.
- Calculates `points_awarded`.
- Updates `session_players.total_score`.
- Layout was compacted so the question card and answer choices fit better on laptop screens.
- Redirects to Final Results when the shared session reaches `finished` or `final_results`.

Risks:

- `session_players.total_score` is stale/cache data and should not drive final scoring.
- `pointsPerQuestion` is route-state-based.
- Several hook dependency warnings remain.

### RoundResults

File: `src/pages/student/RoundResults.jsx`

Observations:

- Marks `round_results_seen_at`.
- Polls players/responses for readiness.
- Redirects to Final Results if shared session is final.

Risks:

- Uses `total_score` in student status display.
- Sorts round results by `points_awarded`.
- Student client can update session to `finished`.

### WaitingForOthers

File: `src/pages/student/WaitingForOthers.jsx`

Observations:

- Loads session, student count, and current round response count.
- Redirects to Round Results or Final Results on session status changes.
- Layout was compacted so the waiting status, progress, round, game code, and tip panels fit better on laptop screens.

Risks:

- Response subscription filter uses route `sessionId`; missing route state can break realtime answer count.

### FinalResults

File: `src/pages/student/FinalResults.jsx`

Observations:

- Fetches session, players, and responses.
- Uses shared leaderboard helper.

Risks:

- Question summary still matches `player_id === studentName` only.
- Missing route state on refresh can lose `studentName`; final page can load session data but cannot identify the current user.

## 8. Instructor Flow Review

### DashboardOfficial

File: `src/pages/instructor/DashboardOfficial.jsx`

Observations:

- Handles auth/session creation, AI question generation, saved banks, manual questions, and navigation.
- Very large file with many responsibilities.

Risks:

- Many unused variables and dead functions.
- localStorage is used heavily.
- Error handling is verbose but not centralized.

### SessionOfficial

File: `src/pages/instructor/SessionOfficial.jsx`

Observations:

- Prepares session and starts live quiz.
- Writes session config to localStorage.
- Updates sessions with `status: active`, question info, and `current_round`.

Risks:

- Unused helper `getStudentJoinedTime`.
- localStorage fallback can conflict with fresh session state.

### questions-preview

File: `src/pages/instructor/questions-preview.jsx`

Observations:

- Edits generated/manual questions.
- Saves question banks in session/localStorage.

Risks:

- localStorage priority is documented, but still a state consistency risk.

### InstructorLiveQuiz

File: `src/pages/instructor/InstructorLiveQuiz.jsx`

Observations:

- Controls live quiz, session status, round endings, next round, final results.
- Uses realtime responses and polling.
- Live rankings now use shared helper.
- End Quiz writes the shared session status to `finished`, allowing student session listeners to navigate to Final Results.

Risks:

- File has many unused variables/functions.
- Hook dependency warnings remain.
- Old `studentScores` still uses `points_awarded` but is unused.
- Automatic progression and student-driven `RoundResults` finalization overlap.

### InstructorFinalResults

File: `src/pages/instructor/InstructorFinalResults.jsx`

Observations:

- Shows question analytics, response distribution, correct answer percentage, average time.

Risks:

- Uses question ID matching; if ID formats diverge, analytics can be empty.
- Has hook dependency warning for `gameCode`.

### InstructorScoreDistribution

File: `src/pages/instructor/InstructorScoreDistribution.jsx`

Observations:

- Shows summary cards, dynamic score distribution chart, student rankings, and most missed question.
- Uses shared helper for ranking.

Risks:

- Bucket correctness depends on helper max score correctness.
- The "Most Missed Question" card uses `is_correct`, which is good, but answer text resolution can fail if question bank does not include the question ID.

## 9. Supabase and Data Review

Known schema from migrations:

- `sessions.status`: `waiting`, `active`, `round_results`, `finished`
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
- `responses.time_taken_seconds`

Data model gaps:

- No migration for `sessions.questions_by_difficulty`, though code uses it heavily.
- No migration for `sessions.question_count`, though code uses it heavily.
- No migration for `sessions.time_per_question`, though code uses it heavily.
- No migration for `session_players`, though code uses it heavily.
- No migration for `responses.round_results_seen_at`, though `RoundResults.jsx` updates it.
- No migration for session-level `points_per_question`.
- No `responses.difficulty` or `responses.points_possible`.

Recommended data additions:

- Add `responses.difficulty`.
- Add `responses.points_possible`.
- Add unique constraint on `(session_id, question_id, player_id)` if not already present.
- Add full documented migration for `sessions.question_count`, `sessions.time_per_question`, `sessions.questions_by_difficulty`, `session_players`, and `responses.round_results_seen_at`.

## 10. Score Distribution Review

Current implementation:

- `InstructorScoreDistribution.jsx` uses `calculateLeaderboard`.
- Summary cards use ranked scores.
- Buckets use `getScoreDistributionBuckets`.

Good:

- No direct use of `session_players.total_score` for final ranking.
- No fixed 1000 bucket scale after recent changes.

Remaining concern:

- Dynamic bucket max depends on `maxPossibleScore` from helper.
- If helper's points-per-question inference is wrong, bucket ranges are wrong.
- For difficulty-based scoring, the distribution max might be better derived from known selected-question points or from total possible points per played round.

## 11. Routing and Navigation Issues

Major navigation dependencies:

- Student pages often require `studentName`, `gameCode`, and/or `sessionId` in route state.
- Refreshing pages can lose route state.
- Some pages can recover from Supabase by `sessionId` or `gameCode`; others cannot.

Risks:

- Refreshing Final Results with no route state can load session data but cannot know which student to highlight.
- Lobby hook rule violations can cause unstable navigation behavior.
- Multiple mechanisms can advance quiz state: instructor polling, student difficulty selection, student round result finalization.

Recommendation:

- Store a non-secret student identity/session membership key in localStorage and validate against Supabase.
- Make session phase transitions server/instructor-owned where possible.
- Keep students as listeners, not writers, for global session phases.

## 12. UI / UX Issues

Strengths:

- Pages are visually polished and game-themed.
- Student Final Results has a clear leaderboard and summary.
- Instructor Score Distribution has useful summary cards and "Most Incorrect Question".

Issues:

- Some strings show mojibake/encoding artifacts in source/output, such as corrupted symbols.
- Some files are very large and hard to maintain.
- Round Results still shows rankings based on per-round `points_awarded`, while final pages use shared helper. This can look inconsistent if not labeled clearly.
- Loading/error states are inconsistent across pages.
- Refresh recovery is partial.
- Question, WaitingForOthers, and Lobby were compacted to reduce laptop-screen scrolling while keeping the same visual style. Very large player counts can still require scrolling, but the Lobby now uses denser spacing and a two-column md+ layout for the main waiting/player content.

## 13. Code Quality Issues

High-level issues:

- Several files have many responsibilities:
  - `DashboardOfficial.jsx`
  - `InstructorLiveQuiz.jsx`
  - `Question.jsx`
  - `RoundResults.jsx`
- Many unused variables/functions.
- React hook dependency warnings in key flow files.
- Conditional hooks in `Lobby.jsx`.
- Legacy/original instructor backup files were removed from the project root after confirming they were unused.
- Encoding issues may still exist in some UI strings.

Recommended structure:

- Move quiz state transition logic into helpers/services.
- Move leaderboard/scoring into tested utility functions.
- Add a `src/utils/sessionFlow.js`.
- Add a `src/utils/question.js` for question ID/text/correct-answer normalization.
- Add tests for `calculateLeaderboard`.

## 14. Security and Environment Review

Environment variables:

- Frontend requires:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- API route requires:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENROUTER_API_KEY`
  - `APP_URL` optional

Risks:

- `api/generate-questions.js` uses `SUPABASE_SERVICE_ROLE_KEY`; it must never be exposed to the client.
- API route logs whether sensitive env vars are set. It does not print values, which is good.
- ESLint does not configure Node globals for `api/**/*.js`, so `process` and `Buffer` are lint errors.
- RLS policies shown are incomplete for the student flow and may either block required actions or require overly permissive policies elsewhere.
- Client-side student code updates global session state (`Difficulty.jsx`, `RoundResults.jsx`). That is risky if RLS allows broad update access.

Recommended security improvements:

- Define exact RLS policies for students:
  - join by game code
  - insert own response
  - read session phases needed for their session
  - never update global session state except controlled fields, if at all
- Move phase updates to instructor/server authority.
- Add rate limiting / file size limits for AI route.

## 15. Build and Lint Status

### `npm run build`

Status: Passed.

Output summary:

- Vite transformed 102 modules.
- Build completed successfully.
- Warning: bundle chunk is larger than 500 kB.

### `npm run lint`

Status: Failed.

Post-removal total: 45 problems, 33 errors, 12 warnings.

Recent update:

- Removed `original_InstructorLiveQuiz.jsx` and `original_InstructorLiveQuiz_utf8.jsx` after confirming they were unused.
- The legacy backup parsing/unused-variable/hook-dependency failures no longer appear in `npm run lint`.

Grouped errors/warnings:

- `api/generate-questions.js`
  - `process` not defined.
  - `Buffer` not defined.
  - Unused variables: `error`, `innerError`, `requiredCount`, `buildGeminiParts`, `fileContent`, `bodySessionId`.
  - Likely cause: ESLint config treats `api/**/*.js` as browser code instead of Node/server code; some unused code is real cleanup work.

- `original_InstructorLiveQuiz.jsx`
  - Removed after confirming it was unused.
  - This eliminates the parsing error from lint.

- `original_InstructorLiveQuiz_utf8.jsx`
  - Removed after confirming it was unused.
  - This eliminates its unused-variable and hook-dependency lint failures.

- `src/lib/supabase.js`
  - Unused destructured `id` in `createSession`.
  - Unused parameters in `updateSessionQuestions`.
  - Pre-existing utility cleanup.

- `src/pages/instructor/DashboardOfficial.jsx`
  - Multiple unused state variables and functions.
  - Pre-existing code quality issue.

- `src/pages/instructor/InstructorFinalResults.jsx`
  - Hook dependency warning for `gameCode`.

- `src/pages/instructor/InstructorLiveQuiz.jsx`
  - Hook dependency warnings only after recent unused-variable suppression.
  - Existing warnings should be reviewed carefully before changing because effects drive quiz flow.

- `src/pages/instructor/SessionOfficial.jsx`
  - Hook dependency warning.
  - Unused `getStudentJoinedTime`.

- `src/pages/student/Difficulty.jsx`
  - Hook dependency warning.

- `src/pages/student/Question.jsx`
  - Hook dependency warnings.

- `vite.config.js`
  - `process` not defined.
  - Unused `err`.
  - Cause: ESLint config does not mark Vite config as Node environment.

## 16. Recommended Fix Plan

Priority 1: Correct final scoring for difficulty-based points.

- Change `calculateLeaderboard` to sum correct `responses.points_awarded`.
- Keep `correctAnswers` from `is_correct`.
- Keep `accuracy` from `correctAnswers / totalQuestions`.
- Add tests for mixed difficulty examples.

Priority 2: Fix React hook rule violations in `Lobby.jsx`.

- Move all hooks before early returns.
- Ensure no conditional hook calls.

Priority 3: Clean lint scope/config.

- Add Node globals for:
  - `api/**/*.js`
  - `vite.config.js`
- Exclude legacy backup files or move them outside lint scope.

Priority 4: Formalize Supabase schema.

- Add migrations for fields used by code but absent from migrations.
- Add unique constraints and indexes.
- Add `responses.difficulty` and `responses.points_possible`.

Priority 5: Clarify authority over session transitions.

- Students should not finalize global sessions unless explicitly intended.
- Prefer instructor/server state updates.
- Recent update: instructor End Quiz now finalizes via shared `sessions.status = "finished"` so student pages can react consistently.
- Next step: move any remaining student-owned finalization in `RoundResults.jsx` to instructor/server-owned logic.

Priority 6: Reduce localStorage dependence.

- Keep localStorage for cache/timer resilience.
- Never use it for authoritative quiz progress, score, or final navigation.

## 17. Manual Test Cases

### Scoring

1. Five questions, all worth 300:
   - 5/5 -> 1500
   - 4/5 -> 1200
   - 3/5 -> 900
   - 2/5 -> 600
   - 1/5 -> 300
   - 0/5 -> 0

2. Mixed difficulty scoring:
   - Student answers one easy and one hard correctly.
   - Expected score: 100 + 300 = 400.
   - This is the key test likely to expose current helper risk.

3. All students view Final Results from different devices:
   - Same scores.
   - Same order.
   - Only current viewer row has "You".

### Navigation

4. Five students finish last question:
   - All land on Round Results.
   - Shared session becomes `finished`.
   - All navigate to Final Results.

5. Refresh on Round Results after session is finished:
   - Student redirects to Final Results.

6. Refresh on WaitingForOthers after session is finished:
   - Student redirects to Final Results.

### Instructor views

7. Instructor Score Distribution:
   - Summary cards match Final Results leaderboard.
   - Chart buckets match actual score ranges.

8. Instructor Live Quiz:
   - Live rankings match shared helper output.

### Data integrity

9. Duplicate student names:
   - Verify whether rows collapse or highlight incorrectly.

10. Missing route state:
   - Direct open Final Results with only `sessionId`.
   - Verify data loads and UI handles missing student identity gracefully.

## 18. Quick Wins

1. Fix `calculateLeaderboard` to sum `points_awarded` for correct responses.
2. Removed unused legacy files `original_InstructorLiveQuiz.jsx` and `original_InstructorLiveQuiz_utf8.jsx`.
3. Next recommended fix: add ESLint Node globals for `api/**/*.js` and `vite.config.js`.
4. Fix conditional hooks in `Lobby.jsx`.
5. Add migration for `responses.round_results_seen_at`.
6. Add migration for `responses.difficulty` and `responses.points_possible`.
7. Remove or clearly label stale `session_players.total_score` displays.
8. Add unit tests for `src/utils/leaderboard.js`.
9. Add a small session-state helper so every student page checks final/round/active status consistently.
10. Document which fields are authoritative:
    - Score: `responses`
    - Correctness: `responses.is_correct`
    - Phase: `sessions.status`
    - Question count: `sessions.question_count`
    - Timer: `sessions.current_question_ends_at`
