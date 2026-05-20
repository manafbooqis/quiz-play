import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {
  calculateLeaderboard,
  getScoreDistributionBuckets,
} from "../../utils/leaderboard";

function getQuestionId(question) {
  return question?.id || question?.question_id || question?.qid || "";
}

function normalizeAnswerValue(value) {
  return String(value ?? "").trim();
}

function normalizeDifficulty(value) {
  return String(value || "").trim().toLowerCase();
}

function getQuestionDifficulty(question, fallbackDifficulty = "") {
  return (
    question?.difficulty ||
    question?.level ||
    question?.current_difficulty ||
    question?.difficulty_level ||
    fallbackDifficulty ||
    "unknown"
  );
}

function getQuestionText(question, questionId) {
  return (
    question?.question ||
    question?.q ||
    question?.question_text ||
    question?.topic ||
    `Question ID: ${questionId}`
  );
}

function getQuestionOptions(question) {
  const options =
    question?.options ||
    question?.answers ||
    question?.choices ||
    [
      question?.optionA,
      question?.optionB,
      question?.optionC,
      question?.optionD,
      question?.option_a,
      question?.option_b,
      question?.option_c,
      question?.option_d,
    ];

  return Array.isArray(options)
    ? options.filter((option) => option !== undefined && option !== null && option !== "")
    : [];
}

function getOptionIndex(value) {
  const text = normalizeAnswerValue(value);
  if (!text) return -1;

  if (/^[0-3]$/.test(text)) {
    return Number(text);
  }

  if (/^[A-D]$/i.test(text)) {
    return text.toUpperCase().charCodeAt(0) - 65;
  }

  const namedOptionMatch = text.match(/^option[\s_-]*([A-D])$/i);
  if (namedOptionMatch) {
    return namedOptionMatch[1].toUpperCase().charCodeAt(0) - 65;
  }

  return -1;
}

function mapAnswerToText(value, question) {
  const text = normalizeAnswerValue(value);
  const options = getQuestionOptions(question);
  const optionIndex = getOptionIndex(value);

  if (optionIndex >= 0 && options[optionIndex]) {
    return options[optionIndex];
  }

  return text || "Answer unavailable";
}

function getCorrectAnswerText(question) {
  if (!question) return "Correct answer unavailable";

  const correctAnswer =
    question.correct_answer ??
    question.correctAnswer ??
    question.answer ??
    question.correct ??
    question.correct_option;

  return mapAnswerToText(correctAnswer, question);
}

function getFlattenedQuestionsById(questionsByDifficulty = {}) {
  const questions = Object.entries(questionsByDifficulty || {}).flatMap(
    ([difficulty, questionsForDifficulty]) =>
      Array.isArray(questionsForDifficulty)
        ? questionsForDifficulty.map((question, index) => ({
            ...question,
            __difficulty: getQuestionDifficulty(question, difficulty),
            __questionNumber: question?.question_number || question?.number || index + 1,
          }))
        : []
  );

  return questions.reduce((acc, question, index) => {
    const id = getQuestionId(question);
    if (id) {
      acc[String(id)] = {
        ...question,
        __questionNumber: question.__questionNumber || index + 1,
      };
    }
    return acc;
  }, {});
}

function getMostCommonWrongAnswer(incorrectResponses, question) {
  const counts = incorrectResponses.reduce((acc, response) => {
    const answerKey = normalizeAnswerValue(response.selected_answer);
    if (!answerKey) return acc;
    acc[answerKey] = (acc[answerKey] || 0) + 1;
    return acc;
  }, {});

  const mostCommonAnswer = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!mostCommonAnswer) return "";

  return mapAnswerToText(mostCommonAnswer[0], question);
}

function buildAutoReviewQueue(questionsByDifficulty, responses) {
  const questionById = getFlattenedQuestionsById(questionsByDifficulty);

  const grouped = responses
    .filter((response) => response.question_id)
    .reduce((acc, response) => {
      const questionId = String(response.question_id);
      if (!acc[questionId]) acc[questionId] = [];
      acc[questionId].push(response);
      return acc;
    }, {});

  return Object.entries(grouped)
    .map(([questionId, questionResponses], index) => {
      const question = questionById[questionId];
      const incorrectResponses = questionResponses.filter(
        (response) => response.is_correct !== true
      );
      const totalResponses = questionResponses.length;
      const incorrectCount = incorrectResponses.length;
      const incorrectRate = totalResponses > 0 ? incorrectCount / totalResponses : 0;
      const difficulty = getQuestionDifficulty(question);
      const normalizedDifficulty = normalizeDifficulty(difficulty);
      const threshold = normalizedDifficulty === "easy" ? 0.3 : 0.5;

      return {
        questionId,
        questionNumber:
          question?.__questionNumber ||
          question?.round_number ||
          questionResponses[0]?.round_number ||
          index + 1,
        difficulty,
        questionText: getQuestionText(question, questionId),
        correctAnswer: getCorrectAnswerText(question),
        incorrectRate,
        incorrectRatePercent: Math.round(incorrectRate * 100),
        incorrectCount,
        totalResponses,
        mostCommonWrongAnswer: getMostCommonWrongAnswer(incorrectResponses, question),
        needsReview: totalResponses > 0 && incorrectRate >= threshold,
      };
    })
    .filter((item) => item.needsReview)
    .sort((a, b) => {
      if (b.incorrectRate !== a.incorrectRate) return b.incorrectRate - a.incorrectRate;
      if (b.incorrectCount !== a.incorrectCount) return b.incorrectCount - a.incorrectCount;
      return Number(a.questionNumber) - Number(b.questionNumber);
    });
}

function InstructorScoreDistribution() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const sessionId = state?.sessionId ?? "";
  const initialGameCode = state?.gameCode ?? "";
  const [loading, setLoading] = useState(true);
  const [resolvedSessionId, setResolvedSessionId] = useState("");
  const [gameCode, setGameCode] = useState(initialGameCode);
  const [students, setStudents] = useState([]);
  const [responses, setResponses] = useState([]);
  const [questionsByDifficulty, setQuestionsByDifficulty] = useState({});
  const [sessionQuestionCount, setSessionQuestionCount] = useState(0);
  const [sessionScoringConfig, setSessionScoringConfig] = useState({});
  const [mostMissedResult, setMostMissedResult] = useState(null);

  // Always fetch fresh data from database
  useEffect(() => {
    async function load() {
      setLoading(true);
      
      try {
        let currentSessionId = sessionId;
        let currentGameCode = initialGameCode;

        // If we have gameCode but no sessionId, fetch session by game_code
        if (!currentSessionId && currentGameCode) {
          const { data: sessionData } = await supabase
            .from("sessions")
            .select("*")
            .eq("game_code", currentGameCode)
            .single();
          
          if (sessionData) {
            currentSessionId = sessionData.id;
            setResolvedSessionId(sessionData.id);
            setGameCode(sessionData.game_code || "");
            setQuestionsByDifficulty(sessionData.questions_by_difficulty || {});
            setSessionQuestionCount(Number(sessionData.question_count) || 0);
            setSessionScoringConfig(sessionData || {});
          }
        } else if (currentSessionId) {
          // If we have sessionId, fetch session details
          const { data: sessionData } = await supabase
            .from("sessions")
            .select("*")
            .eq("id", currentSessionId)
            .single();
          
          if (sessionData) {
            currentGameCode = sessionData.game_code || "";
            setResolvedSessionId(sessionData.id);
            setGameCode(sessionData.game_code || "");
            setQuestionsByDifficulty(sessionData.questions_by_difficulty || {});
            setSessionQuestionCount(Number(sessionData.question_count) || 0);
            setSessionScoringConfig(sessionData || {});
          }
        }

        // If we still don't have a session ID, stop loading
        if (!currentSessionId) {
          setLoading(false);
          return;
        }

        // Fetch fresh session_players data
        const { data: playersData } = await supabase
          .from("session_players")
          .select("*")
          .eq("session_id", currentSessionId)
          .order("joined_at");
        
        if (playersData) {
          setStudents(playersData);
        }

        // Fetch fresh responses data
        const { data: responsesData } = await supabase
          .from("responses")
          .select("*")
          .eq("session_id", currentSessionId)
          .order("answered_at");
        
        if (responsesData) {
          setResponses(responsesData);
        }

      } catch (err) {
        console.error("Error loading score distribution data:", err);
      } finally {
        setLoading(false);
      }
    }
    
    load();
  }, [sessionId, initialGameCode]);

  const ranked = useMemo(
    () => calculateLeaderboard(
      students,
      responses,
      sessionQuestionCount,
      sessionScoringConfig
    ),
    [students, responses, sessionQuestionCount, sessionScoringConfig]
  );

  const scores = ranked.map((s) => s.score);
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

  const maxPossibleScore = ranked[0]?.maxPossibleScore || highestScore || 0;

  // Build score-distribution buckets using the actual maximum possible score.
  const buckets = useMemo(() => {
    return getScoreDistributionBuckets(scores, maxPossibleScore);
  }, [scores, maxPossibleScore]);

  const maxBucketCount = Math.max(...buckets.counts, 1);
  const autoReviewQueue = useMemo(
    () => buildAutoReviewQueue(questionsByDifficulty, responses),
    [questionsByDifficulty, responses]
  );

  useEffect(() => {
    console.log("[Auto Review Queue] items count", autoReviewQueue.length);
  }, [autoReviewQueue.length]);

  const handleShowMostMissedQuestion = () => {
    const responsesWithQuestion = responses.filter((response) => response.question_id);

    if (responsesWithQuestion.length === 0) {
      setMostMissedResult({
        message: "No question-level answer data is available yet.",
      });
      return;
    }

    const questions = Object.values(questionsByDifficulty || {})
      .flat()
      .filter(Boolean);
    const questionById = questions.reduce((acc, question) => {
      const id = getQuestionId(question);
      if (id) acc[String(id)] = question;
      return acc;
    }, {});

    const grouped = responsesWithQuestion.reduce((acc, response) => {
      const questionId = String(response.question_id);
      const question = questionById[questionId];
      const selectedAnswer = Number(response.selected_answer);
      const correctAnswer = Number(
        question?.correctAnswer ??
          question?.correct_answer ??
          question?.correct_option
      );
      const canCompareAnswers =
        question &&
        Number.isFinite(selectedAnswer) &&
        Number.isFinite(correctAnswer);
      const isCorrect =
        typeof response.is_correct === "boolean"
          ? response.is_correct
          : canCompareAnswers
          ? selectedAnswer === correctAnswer
          : null;

      if (!acc[questionId]) {
        acc[questionId] = {
          questionId,
          total: 0,
          incorrect: 0,
          question,
        };
      }

      acc[questionId].total += 1;
      if (isCorrect === false) acc[questionId].incorrect += 1;
      return acc;
    }, {});

    const mostMissed = Object.values(grouped)
      .filter((item) => item.total > 0)
      .sort((a, b) => {
        if (b.incorrect !== a.incorrect) return b.incorrect - a.incorrect;
        const bRate = b.incorrect / b.total;
        const aRate = a.incorrect / a.total;
        return bRate - aRate;
      })[0];

    if (!mostMissed || mostMissed.incorrect === 0) {
      setMostMissedResult({
        message: "No missed questions found yet.",
      });
      return;
    }

    setMostMissedResult({
      questionText: getQuestionText(mostMissed.question, mostMissed.questionId),
      correctAnswer: getCorrectAnswerText(mostMissed.question),
      incorrect: mostMissed.incorrect,
      total: mostMissed.total,
      incorrectRate: Math.round((mostMissed.incorrect / mostMissed.total) * 100),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-700 text-xl font-semibold">Loading score distribution...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Score Distribution</h1>
          <p className="text-sm text-slate-500">Game Code: {gameCode || "—"}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleShowMostMissedQuestion}
            className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-sm shadow-sm transition"
          >
            Most Incorrect Question
          </button>
          <button
            onClick={() =>
              navigate("/instructor/final-results", {
                state: { 
                  sessionId: resolvedSessionId || sessionId, 
                  gameCode, 
                  students, 
                  responses, 
                  questionsByDifficulty,
                  questionCount: sessionQuestionCount,
                  session: sessionScoringConfig,
                },
              })
            }
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition font-semibold text-sm shadow-sm"
          >
            ← Back to Questions Analysis
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Average Score", value: avgScore, icon: "📊", color: "blue" },
              { label: "Highest Score", value: highestScore, icon: "🏆", color: "emerald" },
              { label: "Lowest Score", value: lowestScore, icon: "📉", color: "amber" },
            ].map(({ label, value, icon, color }) => (
              <div
                key={label}
                className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex items-center gap-4 relative overflow-hidden group"
              >
                <div
                  className={`absolute -right-4 -top-4 w-24 h-24 rounded-full transition-transform group-hover:scale-110 ${
                    color === "blue" ? "bg-blue-50" :
                    color === "emerald" ? "bg-emerald-50" : "bg-amber-50"
                  }`}
                />
                <div
                  className={`relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${
                    color === "blue" ? "bg-blue-100" :
                    color === "emerald" ? "bg-emerald-100" : "bg-amber-100"
                  }`}
                >
                  {icon}
                </div>
                <div className="relative z-10">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-4xl font-bold text-slate-800">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {mostMissedResult && (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-xs font-bold text-cyan-600 uppercase tracking-widest mb-2">
                    Most Missed Question
                  </p>
                  {mostMissedResult.message ? (
                    <p className="text-slate-600 font-medium">
                      {mostMissedResult.message}
                    </p>
                  ) : (
                    <h2 className="text-2xl font-bold text-slate-800 leading-snug">
                      {mostMissedResult.questionText}
                    </h2>
                  )}
                </div>

                {!mostMissedResult.message && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                        Correct Answer
                      </p>
                      <p className="text-slate-800 font-semibold">
                        {mostMissedResult.correctAnswer}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4">
                      <p className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-2">
                        Incorrect Answers
                      </p>
                      <p className="text-rose-700 font-bold text-2xl">
                        {mostMissedResult.incorrect} / {mostMissedResult.total}
                      </p>
                      <p className="text-xs text-rose-500 mt-1">students</p>
                    </div>
                    <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                      <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">
                        Incorrect Rate
                      </p>
                      <p className="text-amber-700 font-bold text-2xl">
                        {mostMissedResult.incorrectRate}%
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Auto Review Queue */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-bold text-cyan-600 uppercase tracking-widest mb-2">
                  Auto Review Queue
                </p>
                <h2 className="text-2xl font-bold text-slate-800">
                  Questions that may need reteaching
                </h2>
              </div>
              <div className="rounded-2xl bg-cyan-50 border border-cyan-100 px-4 py-3 text-center">
                <p className="text-2xl font-bold text-cyan-700">{autoReviewQueue.length}</p>
                <p className="text-xs font-semibold text-cyan-600">items</p>
              </div>
            </div>

            {autoReviewQueue.length === 0 ? (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5">
                <p className="font-semibold text-emerald-800">
                  No review needed. Students performed well.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {autoReviewQueue.map((item) => (
                  <div
                    key={item.questionId}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                            Question {item.questionNumber}
                          </span>
                          <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold capitalize text-cyan-700">
                            {item.difficulty}
                          </span>
                          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
                            {item.incorrectRatePercent}% incorrect
                          </span>
                        </div>
                        <p className="text-lg font-bold text-slate-800 leading-snug">
                          {item.questionText}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-center md:min-w-48">
                        <div className="rounded-xl bg-white border border-slate-100 p-3">
                          <p className="text-xl font-bold text-rose-700">
                            {item.incorrectCount}
                          </p>
                          <p className="text-xs text-slate-500">incorrect</p>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-100 p-3">
                          <p className="text-xl font-bold text-slate-800">
                            {item.totalResponses}
                          </p>
                          <p className="text-xs text-slate-500">responses</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white border border-slate-100 p-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                          Correct Answer
                        </p>
                        <p className="font-semibold text-slate-800">{item.correctAnswer}</p>
                      </div>
                      {item.mostCommonWrongAnswer && (
                        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                          <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">
                            Most Common Wrong Answer
                          </p>
                          <p className="font-semibold text-amber-800">
                            {item.mostCommonWrongAnswer}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bar Chart */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Score Distribution Chart</h2>
            {scores.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No student data available.</p>
            ) : (
              <div className="flex items-end gap-4 h-48">
                {buckets.labels.map((label, i) => {
                  const count = buckets.counts[i];
                  const heightPct = Math.round((count / maxBucketCount) * 100);
                  return (
                    <div key={label} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-sm font-bold text-slate-600">{count}</span>
                      <div className="w-full flex items-end" style={{ height: "160px" }}>
                        <div
                          className="w-full rounded-t-xl bg-gradient-to-t from-cyan-600 to-cyan-400 transition-all duration-700"
                          style={{ height: `${Math.max(heightPct, count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 font-medium">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ranked Student List */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Student Rankings</h2>
            {ranked.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No students found.</p>
            ) : (
              <div className="space-y-3">
                {ranked.map((student, index) => {
                  const medal =
                    index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;
                  const isTop = index < 3;
                  return (
                    <div
                      key={student.id || index}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        isTop
                          ? "border-cyan-100 bg-cyan-50/60"
                          : "border-slate-100 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                          {medal || index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{student.name}</p>
                          <p className="text-xs text-slate-400">
                            {student.correct}/{student.total} correct
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-800">{student.score}</p>
                        <p className="text-xs text-slate-400">points</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

export default InstructorScoreDistribution;
