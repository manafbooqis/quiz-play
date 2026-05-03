import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

const DIFFICULTY_TABS = [
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
];

function normalizeQuestionsByDifficulty(value) {
  return {
    easy: Array.isArray(value?.easy) ? value.easy : [],
    medium: Array.isArray(value?.medium) ? value.medium : [],
    hard: Array.isArray(value?.hard) ? value.hard : [],
  };
}

function getQuestionId(question, difficulty, index) {
  return (
    question?.id ||
    question?.question_id ||
    question?.qid ||
    `${difficulty}-${index + 1}`
  );
}

function getQuestionText(question) {
  return question?.question || question?.q || question?.question_text || "Unknown Question";
}

function getQuestionOptions(question) {
  return question?.options || question?.choices || ["", "", "", ""];
}

function getCorrectOptionIndex(question) {
  return Number(
    question?.correctAnswer ??
      question?.correctIndex ??
      question?.correct_answer ??
      question?.correct_option ??
      0
  );
}

function getSelectedAnswerIndex(response) {
  const value =
    response?.selected_answer ??
    response?.selectedAnswer ??
    response?.answer_index ??
    response?.answerIndex ??
    response?.selected_option ??
    response?.selectedOption;

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const text = value.trim().toUpperCase();

    if (text === "A") return 0;
    if (text === "B") return 1;
    if (text === "C") return 2;
    if (text === "D") return 3;

    const numberValue = Number(value);

    if (!Number.isNaN(numberValue)) {
      return numberValue;
    }
  }

  return null;
}

function InstructorFinalResults() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const sessionId = state?.sessionId ?? "";

  const [loading, setLoading] = useState(
    !state?.responses || !state?.questionsByDifficulty
  );

  const [gameCode, setGameCode] = useState(state?.gameCode ?? "");
  const [students, setStudents] = useState(state?.students ?? []);
  const [responses, setResponses] = useState(state?.responses ?? []);
  const [questionsByDifficulty, setQuestionsByDifficulty] = useState(
    normalizeQuestionsByDifficulty(state?.questionsByDifficulty ?? {})
  );

  const [difficulty, setDifficulty] = useState("easy");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    if (state?.responses && state?.questionsByDifficulty) {
      setLoading(false);
      return;
    }

    async function loadStudents() {
      try {
        const { data: playersData } = await supabase
          .from("session_players")
          .select("*")
          .eq("session_id", sessionId);

        if (playersData) {
          setStudents(playersData);
        }
      } catch (err) {
        console.error("Error loading students fallback:", err);
      }
    }

    async function loadFallbackData() {
      try {
        const { data: sessionData } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (sessionData) {
          setQuestionsByDifficulty(
            normalizeQuestionsByDifficulty(
              sessionData.questions_by_difficulty || {}
            )
          );

          if (!gameCode) {
            setGameCode(sessionData.game_code);
          }
        }

        const { data: responsesData } = await supabase
          .from("responses")
          .select("*")
          .eq("session_id", sessionId);

        if (responsesData) {
          setResponses(responsesData);
        }
      } catch (err) {
        console.error("Error loading fallback results data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadStudents();
    loadFallbackData();
  }, [sessionId, state, gameCode]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [difficulty]);

  const list = questionsByDifficulty[difficulty] ?? [];

  const safeSelectedIndex = useMemo(() => {
    if (!list.length) return 0;
    return Math.min(selectedIndex, list.length - 1);
  }, [list.length, selectedIndex]);

  const selectedQuestion = list[safeSelectedIndex];

  const totalQuestions = DIFFICULTY_TABS.reduce(
    (sum, tab) => sum + (questionsByDifficulty[tab.key]?.length ?? 0),
    0
  );

  const selectedQuestionId = selectedQuestion
    ? getQuestionId(selectedQuestion, difficulty, safeSelectedIndex)
    : "";

  const questionResponses = useMemo(() => {
    if (!selectedQuestionId) return [];

    return responses.filter((response) => {
      const responseQuestionId =
        response.question_id ||
        response.questionId ||
        response.current_question_id;

      return String(responseQuestionId) === String(selectedQuestionId);
    });
  }, [responses, selectedQuestionId]);

  const analytics = useMemo(() => {
    if (!selectedQuestion) return null;

    const total = questionResponses.length;

    const correctCount = questionResponses.filter(
      (response) => response.is_correct === true
    ).length;

    const correctPercent =
      total > 0 ? Math.round((correctCount / total) * 100) : 0;

    let avgTime = "N/A";

    const timeResponses = questionResponses.filter(
      (response) =>
        response.response_time !== undefined &&
        response.response_time !== null
    );

    if (timeResponses.length > 0) {
      const sum = timeResponses.reduce(
        (acc, response) => acc + Number(response.response_time || 0),
        0
      );

      avgTime = `${(sum / timeResponses.length).toFixed(1)}s`;
    }

    const options = getQuestionOptions(selectedQuestion);

    const distribution = options.map((optionText, index) => {
      const count = questionResponses.filter(
        (response) => getSelectedAnswerIndex(response) === index
      ).length;

      const percentage =
        total > 0 ? Math.round((count / total) * 100) : 0;

      return {
        index,
        optionText,
        count,
        percentage,
      };
    });

    return {
      total,
      correctCount,
      correctPercent,
      avgTime,
      distribution,
    };
  }, [selectedQuestion, questionResponses]);

  const correctIndex = selectedQuestion
    ? getCorrectOptionIndex(selectedQuestion)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="text-slate-700 text-xl font-semibold">
          Loading analysis...
        </div>
      </div>
    );
  }

  if (!totalQuestions) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            No questions found
          </h1>

          <p className="text-slate-500 mb-6">
            There are no questions available for this session.
          </p>

          <button
            onClick={() => navigate("/instructor/dashboard-official")}
            className="w-full px-5 py-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 transition font-bold"
          >
            Exit to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Question Analysis</h1>

            <p className="text-slate-500 mt-1">
              Game Code:{" "}
              <span className="font-semibold">{gameCode}</span>
            </p>

            <p className="text-slate-500 text-sm mt-1">
              Review each question and see how students answered.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() =>
                navigate("/instructor/score-distribution", {
                  state: {
                    sessionId,
                    gameCode,
                    students,
                    responses,
                    questionsByDifficulty,
                  },
                })
              }
              className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition font-semibold"
            >
              Score Distribution
            </button>

            <button
              onClick={() => navigate("/instructor/dashboard-official")}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition font-semibold"
            >
              Exit to Dashboard
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {DIFFICULTY_TABS.map((tab) => (
            <div
              key={tab.key}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs uppercase tracking-widest text-slate-500">
                {tab.label}
              </p>

              <p className="mt-2 text-3xl font-bold text-slate-900">
                {questionsByDifficulty[tab.key]?.length ?? 0}
              </p>
            </div>
          ))}

          <div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-cyan-700">
              Total Questions
            </p>

            <p className="mt-2 text-3xl font-bold text-cyan-950">
              {totalQuestions}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {DIFFICULTY_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setDifficulty(tab.key)}
              className={[
                "px-4 py-2 rounded-2xl border transition font-semibold",
                difficulty === tab.key
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-4 h-[620px] overflow-y-auto">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">
              {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}{" "}
              Questions ({list.length})
            </p>

            <div className="space-y-2">
              {list.map((question, index) => {
                const questionId = getQuestionId(question, difficulty, index);

                const answerCount = responses.filter((response) => {
                  const responseQuestionId =
                    response.question_id ||
                    response.questionId ||
                    response.current_question_id;

                  return String(responseQuestionId) === String(questionId);
                }).length;

                return (
                  <button
                    key={questionId}
                    onClick={() => setSelectedIndex(index)}
                    className={[
                      "w-full text-left px-4 py-3 rounded-2xl border transition",
                      safeSelectedIndex === index
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">Q{index + 1}</div>

                      <div className="text-xs opacity-80">
                        {answerCount} answers
                      </div>
                    </div>

                    <div className="text-sm opacity-80 truncate mt-1">
                      {getQuestionText(question)}
                    </div>
                  </button>
                );
              })}
            </div>

            {list.length === 0 && (
              <div className="text-slate-500 text-sm mt-3">
                No questions in this difficulty.
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6">
            {!selectedQuestion || !analytics ? (
              <div className="text-slate-500">
                Select a question to view its analysis.
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">
                      {difficulty.toUpperCase()} - Question{" "}
                      {safeSelectedIndex + 1}
                    </p>

                    <p className="text-sm text-slate-500 mt-1">
                      {analytics.total} student answers
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-emerald-700">
                      Correct Rate
                    </p>

                    <p className="text-2xl font-bold text-emerald-900">
                      {analytics.correctPercent}%
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm font-semibold text-slate-500 mb-2">
                      Question
                    </p>

                    <p className="text-lg font-bold text-slate-900">
                      {getQuestionText(selectedQuestion)}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analytics.distribution.map((dist) => {
                      const isCorrect = dist.index === correctIndex;

                      return (
                        <div
                          key={`${selectedQuestionId}-choice-${dist.index}`}
                          className={[
                            "rounded-2xl border px-4 py-4",
                            isCorrect
                              ? "border-emerald-400 bg-emerald-50"
                              : "border-slate-200 bg-slate-50",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <span className="font-semibold text-slate-700">
                              Choice {String.fromCharCode(65 + dist.index)}
                            </span>

                            {isCorrect && (
                              <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-bold">
                                Correct Answer
                              </span>
                            )}
                          </div>

                          <p className="font-medium text-slate-900 min-h-[48px]">
                            {dist.optionText || "Empty choice"}
                          </p>

                          <div className="mt-4">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="text-slate-500">
                                {dist.count} students
                              </span>

                              <span className="font-bold text-slate-900">
                                {dist.percentage}%
                              </span>
                            </div>

                            <div className="h-3 rounded-full bg-white border border-slate-200 overflow-hidden">
                              <div
                                className={[
                                  "h-full rounded-full transition-all",
                                  isCorrect
                                    ? "bg-emerald-400"
                                    : "bg-slate-300",
                                ].join(" ")}
                                style={{ width: `${dist.percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Total Answers
                      </p>

                      <p className="text-3xl font-bold text-slate-900 mt-2">
                        {analytics.total}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Average Time
                      </p>

                      <p className="text-3xl font-bold text-slate-900 mt-2">
                        {analytics.avgTime}
                      </p>
                    </div>
                  </div>

                  {analytics.total === 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800">
                      No answers recorded for this question.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default InstructorFinalResults;