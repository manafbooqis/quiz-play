import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function InstructorFinalResults() {
  const navigate = useNavigate();
  const { state } = useLocation();
  
  const sessionId = state?.sessionId ?? "";
  
  const [loading, setLoading] = useState(!state?.responses || !state?.questionsByDifficulty);
  const [gameCode, setGameCode] = useState(state?.gameCode ?? "");
  const [students, setStudents] = useState(state?.students ?? []);
  const [responses, setResponses] = useState(state?.responses ?? []);
  const [questionsByDifficulty, setQuestionsByDifficulty] = useState(state?.questionsByDifficulty ?? {});
  const [quizRoundCap, setQuizRoundCap] = useState(
    () => Number(state?.questionCount) || 0
  );

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    
    if (state?.responses && state?.questionsByDifficulty) {
      setLoading(false);
      return;
    }

    // Also load students if missing
    async function loadStudents() {
      try {
        const { data: playersData } = await supabase
          .from("session_players")
          .select("*")
          .eq("session_id", sessionId);
        if (playersData) setStudents(playersData);
      } catch (err) {
        console.error("Error loading students fallback:", err);
      }
    }
    loadStudents();

    async function loadFallbackData() {
      try {
        const { data: sessionData } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (sessionData) {
          setQuestionsByDifficulty(sessionData.questions_by_difficulty || {});
          setGameCode((currentGameCode) =>
            currentGameCode || sessionData.game_code || ""
          );
          if (sessionData.question_count != null) {
            setQuizRoundCap(Number(sessionData.question_count));
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

    loadFallbackData();
  }, [sessionId, state]);
  

  const quizN = useMemo(
    () => Math.max(0, Number(state?.questionCount) || quizRoundCap || 0),
    [state?.questionCount, quizRoundCap]
  );

  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [analysisDifficulty, setAnalysisDifficulty] = useState("easy");

  useEffect(() => {
    setSelectedQuestionIndex((i) =>
      quizN > 0 ? Math.min(Math.max(0, i), quizN - 1) : 0
    );
  }, [quizN]);

  const selectedQuestion = useMemo(() => {
    if (quizN <= 0) return null;
    const bank = questionsByDifficulty[analysisDifficulty] || [];
    return bank[selectedQuestionIndex] ?? null;
  }, [questionsByDifficulty, analysisDifficulty, selectedQuestionIndex, quizN]);

  const analytics = useMemo(() => {
    if (!selectedQuestion) {
      const emptyDist = [0, 1, 2, 3].map((index) => ({
        index,
        optionText: "—",
        count: 0,
        percentage: 0,
      }));
      return {
        total: 0,
        correctCount: 0,
        correctPercent: 0,
        avgTime: "N/A",
        distribution: emptyDist,
      };
    }

    const qId = selectedQuestion.id || selectedQuestion.question_id || selectedQuestion.qid;
    const qResponses = responses.filter((r) => r.question_id === qId);

    const total = qResponses.length;
    const correctCount = qResponses.filter((r) => r.is_correct).length;
    const correctPercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    let avgTime = "N/A";
    const timeResponses = qResponses.filter(
      (r) => r.time_taken_seconds !== undefined && r.time_taken_seconds !== null
    );
    if (timeResponses.length > 0) {
      const sum = timeResponses.reduce(
        (acc, r) => acc + Number(r.time_taken_seconds),
        0
      );
      avgTime = (sum / timeResponses.length).toFixed(1) + "s";
    }

    const options = selectedQuestion.options || selectedQuestion.choices || [];

    const distribution =
      options.length > 0
        ? options.map((opt, index) => {
            const count = qResponses.filter(
              (r) => Number(r.selected_answer) === index
            ).length;
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            return { index, optionText: opt, count, percentage };
          })
        : [0, 1, 2, 3].map((index) => ({
            index,
            optionText: "—",
            count: 0,
            percentage: 0,
          }));

    return {
      total,
      correctCount,
      correctPercent,
      avgTime,
      distribution,
    };
  }, [selectedQuestion, responses]);

  const getQuestionText = (q) => {
    return q.question || q.q || q.question_text || "Unknown Question";
  };

  const getCorrectOptionIndex = (q) => {
    return Number(q.correctAnswer ?? q.correct_answer ?? q.correct_option ?? 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-700 text-xl font-semibold">Loading analysis...</div>
      </div>
    );
  }

  if (!quizN) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-700 text-xl font-semibold">
          No quiz question count found for analysis.
        </div>
      </div>
    );
  }

  const correctIndex = selectedQuestion ? getCorrectOptionIndex(selectedQuestion) : null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Questions Analysis</h1>
          <p className="text-sm text-slate-500">Game Code: {gameCode}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              navigate("/instructor/score-distribution", {
                state: { sessionId, gameCode, students, responses, questionsByDifficulty },
              })
            }
            className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-sm shadow-sm transition"
          >
            View Score Distribution
          </button>
          <button
            onClick={() => navigate("/instructor/dashboard-official")}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition font-semibold text-sm shadow-sm"
          >
            Exit to Dashboard
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-1/3 max-w-sm bg-white border-r border-slate-200 overflow-y-auto custom-scrollbar">
          <div className="p-4 border-b border-slate-100 bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-cyan-100 text-cyan-600 flex items-center justify-center text-xs">
                {quizN}
              </span>
              Question numbers
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Pick a number, then choose Easy / Medium / Hard above the chart.
            </p>
          </div>
          <div className="p-3 space-y-1">
            {Array.from({ length: quizN }, (_, idx) => {
              const isSelected = selectedQuestionIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedQuestionIndex(idx)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${
                    isSelected
                      ? "bg-cyan-50 border border-cyan-200 shadow-[0_2px_10px_-4px_rgba(6,182,212,0.3)]"
                      : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <span
                    className={`text-sm font-semibold ${
                      isSelected ? "text-cyan-700" : "text-slate-600"
                    }`}
                  >
                    Question {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Main Area */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          {analytics && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Difficulty selector */}
              <div className="flex flex-wrap items-center gap-3">
                {["easy", "medium", "hard"].map((diff) => {
                  const isActive = analysisDifficulty === diff;
                  return (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setAnalysisDifficulty(diff)}
                      className={`px-5 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider border-2 transition-all ${
                        isActive
                          ? diff === "easy"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                            : diff === "medium"
                            ? "border-amber-500 bg-amber-50 text-amber-700 shadow-sm"
                            : "border-red-500 bg-red-50 text-red-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {diff}
                    </button>
                  );
                })}
              </div>

              {!selectedQuestion && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
                  No question in the bank for{" "}
                  <span className="font-semibold capitalize">
                    {analysisDifficulty}
                  </span>{" "}
                  at slot {selectedQuestionIndex + 1}. Stats below are empty.
                </div>
              )}

              {/* Question Text */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <h2 className="text-2xl font-medium text-slate-800 leading-relaxed">
                  {selectedQuestion
                    ? getQuestionText(selectedQuestion)
                    : "—"}
                </h2>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-center relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full transition-transform group-hover:scale-110" />
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Correct Answers</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-slate-800">{analytics.correctPercent}%</span>
                        <span className="text-sm font-medium text-slate-400">({analytics.correctCount}/{analytics.total})</span>
                      </div>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl shadow-inner">
                      ✓
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-center relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full transition-transform group-hover:scale-110" />
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Average Time</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-slate-800">{analytics.avgTime}</span>
                      </div>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 text-2xl shadow-inner">
                      ⏱
                    </div>
                  </div>
                </div>
              </div>

              {/* Response Distribution */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-slate-800">Response Distribution</h3>
                  <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {analytics.total} total responses
                  </span>
                </div>
                
                <div className="space-y-6">
                  {analytics.distribution.map((dist) => {
                    const isCorrect = dist.index === correctIndex;
                    return (
                      <div key={dist.index} className="relative group">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-4">
                            <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm ${
                              isCorrect ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}>
                              {String.fromCharCode(65 + dist.index)}
                            </span>
                            <span className="text-slate-700 font-medium text-base">{dist.optionText}</span>
                            {isCorrect && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold uppercase tracking-wider">
                                Correct Option
                              </span>
                            )}
                          </div>
                          <div className="text-right flex items-baseline gap-2">
                            <span className="font-bold text-slate-800 text-lg">{dist.percentage}%</span>
                            <span className="text-sm font-medium text-slate-400 w-8 text-right">({dist.count})</span>
                          </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${
                              isCorrect ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                            style={{ width: `${dist.percentage}%` }}
                          >
                            {/* Shimmer effect for progress bar */}
                            <div className="absolute inset-0 bg-white/20 w-full h-full transform -skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </main>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 20px;
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}

export default InstructorFinalResults;
