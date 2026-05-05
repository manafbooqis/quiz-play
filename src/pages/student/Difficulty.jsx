import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function Difficulty() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const studentName = state?.studentName ?? "";
  const gameCode = state?.gameCode ?? "";
  const sessionId = state?.sessionId ?? "";
  const playerId = studentName;
  const questionsByDifficulty = state?.questionsByDifficulty || {};

  const hasSessionData = Boolean(studentName && gameCode);
  
  const [answeredIds, setAnsweredIds] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [roundTimerStartedAt, setRoundTimerStartedAt] = useState(null);
  const [roundTimerDuration, setRoundTimerDuration] = useState(0);
  const difficultyTimeoutHandledRef = useRef(false);

  const [session, setSession] = useState(null);

  const timePerQuestion = 
    Number(state?.timePerQuestion) ||
    Number(state?.time_per_question) ||
    Number(session?.time_per_question) ||
    30;

  console.log("[TimerFlow] Difficulty resolved", { 
    stateTime: state?.timePerQuestion, 
    sessionTime: session?.time_per_question, 
    timePerQuestion 
  });

  const maxQuestions =
    Number(state?.questionCount) ||
    Number(session?.question_count) ||
    Number(session?.questionCount) ||
    Number(state?.maxQuestions) ||
    1;

  const resolvedQuestionCount =
    Number(state?.questionCount) ||
    Number(state?.maxQuestions) ||
    Number(session?.question_count) ||
    Number(session?.questionCount) ||
    Number(maxQuestions) ||
    1;

  const resolvedQuestionCountRef = useRef(resolvedQuestionCount);

  useEffect(() => {
    resolvedQuestionCountRef.current = resolvedQuestionCount;
  }, [resolvedQuestionCount]);

  console.log("[DifficultyQuestionCount]", {
    stateQuestionCount: state?.questionCount,
    stateMaxQuestions: state?.maxQuestions,
    sessionQuestionCount: session?.question_count,
    sessionQuestionCountCamel: session?.questionCount,
    maxQuestions,
    resolvedQuestionCount
  });

  useEffect(() => {
    if (!hasSessionData) return;
    const localKey = `quizplay_answered_questions_${gameCode}_${playerId}`;
    const stored = localStorage.getItem(localKey);
    if (stored) {
      setAnsweredIds(JSON.parse(stored));
    }
  }, [hasSessionData, gameCode, playerId]);

  // Shared round timer logic
  useEffect(() => {
    if (!hasSessionData || !timePerQuestion) return;

    const roundKey = answeredIds.length; // Current round index
    const timerKey = `quizplay_round_timer_${gameCode}_${playerId}`;
    
    // Get existing timer for this round
    const storedTimer = localStorage.getItem(timerKey);
    let roundTimer = storedTimer ? JSON.parse(storedTimer) : null;
    
    // Create new timer if doesn't exist or round changed
    if (!roundTimer || roundTimer.roundKey !== roundKey) {
      roundTimer = {
        roundKey,
        startedAt: new Date().toISOString(),
        duration: timePerQuestion
      };
      localStorage.setItem(timerKey, JSON.stringify(roundTimer));
    }
    
    setRoundTimerStartedAt(roundTimer.startedAt);
    setRoundTimerDuration(roundTimer.duration);
    
    // Update timeLeft every second
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(roundTimer.startedAt)) / 1000);
      const remaining = Math.max(0, roundTimer.duration - elapsed);
      setTimeLeft(remaining);
      
      if (remaining === 0) {
        clearInterval(interval);
        
        // Handle timeout if no difficulty selected and not already handled
        if (!difficultyTimeoutHandledRef.current) {
          difficultyTimeoutHandledRef.current = true;
          handleDifficultyTimeout();
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [hasSessionData, timePerQuestion, answeredIds.length, gameCode, playerId]);

  const handleDifficultyTimeout = async () => {
    try {
      // Resolve session ID safely
      const targetSessionId = state?.sessionId || session?.id || sessionId;
      
      if (!targetSessionId) {
        console.error("[DifficultyTimeout] missing session id");
        navigate("/student/round-results", {
          state: {
            ...state,
            studentName,
            gameCode,
            sessionId: targetSessionId,
            currentRound: Number(state?.currentRound) || 1,
            questionCount: Number(resolvedQuestionCountRef.current) || 1,
            pointsAwarded: 0,
            isCorrect: false,
            selectedAnswer: null,
            timedOut: true,
            currentQuestion: { question: "Time ended before selecting difficulty.", correct_answer: "No answer" }
          }
        });
        return;
      }

      // Resolve player id from session_players
      const { data: playerRow } = await supabase
        .from("session_players")
        .select("id, student_name")
        .eq("session_id", targetSessionId)
        .eq("student_name", studentName)
        .maybeSingle();

      const resolvedPlayerId = playerRow?.student_name || studentName || playerId;

      // Determine round number
      const currentRound = Number(state?.currentRound) || 1;

      // Use the latest resolved question count from ref to avoid stale closure values
      const questionCount = Number(resolvedQuestionCountRef.current) || 1;

      // Resolve a REAL fallback question id
      const questionIndex = currentRound - 1;
      const fallbackQuestionId = questionsByDifficulty.easy?.[questionIndex]?.id ||
        questionsByDifficulty.medium?.[questionIndex]?.id ||
        questionsByDifficulty.hard?.[questionIndex]?.id;

      console.log("[DifficultyTimeoutDebug]", {
        targetSessionId,
        studentName,
        resolvedPlayerId,
        currentRound,
        questionCount,
        fallbackQuestionId
      });

      if (!fallbackQuestionId) {
        console.error("[DifficultyTimeout] no fallback question id found");
        navigate("/student/round-results", {
          state: {
            ...state,
            studentName,
            gameCode,
            sessionId: targetSessionId,
            currentRound,
            questionCount,
            pointsAwarded: 0,
            isCorrect: false,
            selectedAnswer: null,
            timedOut: true,
            currentQuestion: { question: "Time ended before selecting difficulty.", correct_answer: "No answer" },
            questionsByDifficulty
          }
        });
        return;
      }

      // Check for existing response using same unique constraint as normal answer
      const { data: existingResponse } = await supabase
        .from("responses")
        .select("*")
        .eq("session_id", targetSessionId)
        .eq("question_id", String(fallbackQuestionId))
        .eq("player_id", resolvedPlayerId)
        .maybeSingle();

      console.log("[DifficultyTimeoutDuplicateCheck]", {
        targetSessionId,
        fallbackQuestionId,
        resolvedPlayerId,
        currentRound,
        existingResponse,
      });

      if (!existingResponse) {
        // Insert timeout response using upsert with same onConflict as normal answer
        const timeoutResponse = {
          session_id: targetSessionId,
          question_id: String(fallbackQuestionId),
          player_id: resolvedPlayerId,
          round_number: currentRound,
          selected_answer: 0,
          is_correct: false,
          points_awarded: 0
        };

        const { error: upsertError } = await supabase
          .from("responses")
          .upsert(timeoutResponse, {
            onConflict: "session_id,question_id,player_id"
          });

        console.log("[DifficultyTimeoutUpsertResult]", {
          timeoutResponse,
          upsertError,
        });

        if (upsertError) throw upsertError;
      }

      // Clear shared round timer before navigating
      const timerKey = `quizplay_round_timer_${gameCode}_${playerId}`;
      localStorage.removeItem(timerKey);

      // Navigate to RoundResults
      navigate("/student/round-results", {
        state: {
          ...state,
          studentName,
          gameCode,
          sessionId: targetSessionId,
          currentRound,
          questionCount,
          timePerQuestion,
          currentDifficulty: "timeout",
          currentQuestionId: String(fallbackQuestionId || ""),
          pointsAwarded: 0,
          isCorrect: false,
          selectedAnswer: null,
          timedOut: true,
          currentQuestion: fallbackQuestionId ? 
            questionsByDifficulty.easy?.[questionIndex] || 
            questionsByDifficulty.medium?.[questionIndex] || 
            questionsByDifficulty.hard?.[questionIndex] : 
            { question: "Time ended before selecting difficulty.", correct_answer: "No answer" },
          questionsByDifficulty
        }
      });

    } catch (err) {
      console.error("Error handling difficulty timeout:", err);
      // Fallback navigation
      navigate("/student/round-results", {
        state: {
          ...state,
          studentName,
          gameCode,
          sessionId: state?.sessionId || session?.id || sessionId,
          currentRound: Number(state?.currentRound) || 1,
          questionCount: Number(resolvedQuestionCountRef.current) || 1,
          pointsAwarded: 0,
          isCorrect: false,
          selectedAnswer: null,
          timedOut: true,
          currentQuestion: { question: "Time ended before selecting difficulty.", correct_answer: "No answer" }
        }
      });
    }
  };

  useEffect(() => {
    if (!hasSessionData || !sessionId) return;
    const fetchSession = async () => {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();
      if (data) setSession(data);
    };
    fetchSession();
  }, [hasSessionData, sessionId]);

  useEffect(() => {
    if (!hasSessionData) return;
  }, [hasSessionData]);

  if (!hasSessionData) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8 text-center">
          <h1 className="game-font text-3xl text-yellow-300 mb-4">Oops!</h1>
          <p className="text-slate-300 mb-6">You need to join a game first.</p>
          <button
            onClick={() => navigate("/student/join")}
            className="game-font bg-cyan-500 hover:bg-cyan-400 text-slate-900 py-3 px-6 rounded-xl transition"
          >
            Go to Join Page
          </button>
        </div>
      </div>
    );
  }

  const handleDifficultySelect = (difficulty, points) => {
    const bank = questionsByDifficulty[difficulty] || [];
    
    // Find first unanswered question
    const unansweredQuestion = bank.find(q => 
      !answeredIds.includes(q.id) && 
      !answeredIds.includes(q.question_id) && 
      !answeredIds.includes(q.qid)
    );

    if (unansweredQuestion) {
      const questionId = unansweredQuestion.id || unansweredQuestion.question_id || unansweredQuestion.qid;
      navigate("/student/question", {
        state: {
          ...state,
          currentDifficulty: difficulty,
          currentQuestionId: questionId,
          pointsPerQuestion: points,
          questionCount: Number(resolvedQuestionCountRef.current) || 1,
          timePerQuestion: timePerQuestion,
          roundTimerStartedAt,
          roundTimerDuration,
        },
      });
    } else {
      alert(`No questions available for ${difficulty} difficulty. Please choose another.`);
    }
  };

  const getAvailableCount = (difficulty) => {
    const bank = questionsByDifficulty[difficulty] || [];
    return bank.filter(q => 
      !answeredIds.includes(q.id) && 
      !answeredIds.includes(q.question_id) && 
      !answeredIds.includes(q.qid)
    ).length;
  };

  const cards = [
    { label: "Easy", diff: "easy", points: 10, badge: "bg-emerald-400" },
    { label: "Medium", diff: "medium", points: 25, badge: "bg-yellow-300" },
    { label: "Hard", diff: "hard", points: 50, badge: "bg-red-400" },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-4xl bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="game-font text-3xl text-cyan-300">Pick Difficulty</h1>
            <p className="text-slate-300 mt-2">
              Answered: <span className="text-white font-semibold">{answeredIds.length}</span> / {maxQuestions}
            </p>
          </div>
          <div className="text-center">
            <p className="text-slate-400 text-sm">Time Remaining</p>
            <p className={`game-font text-3xl mt-1 ${timeLeft <= 10 ? 'text-red-400' : 'text-yellow-300'}`}>
              {timeLeft}s
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          {cards.map((c) => {
            const availableCount = getAvailableCount(c.diff);
            const isExhausted = availableCount === 0;

            return (
              <div
                key={c.diff}
                className={`relative border rounded-2xl p-6 transition ${isExhausted ? 'bg-slate-800 border-slate-700 opacity-60' : 'bg-slate-900 border-slate-700'}`}
              >
                {!isExhausted && (
                  <div className={`absolute -top-4 left-1/2 -translate-x-1/2 ${c.badge} text-slate-900 font-bold rounded-full px-3 py-1 shadow`}>
                    +{c.points}
                  </div>
                )}

                <h2 className="game-font text-4xl text-white mt-10">{c.label}</h2>

                <button
                  onClick={() => handleDifficultySelect(c.diff, c.points)}
                  disabled={isExhausted}
                  className={`w-full mt-8 game-font py-3 rounded-xl transition ${isExhausted ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-yellow-300 hover:bg-yellow-200 text-slate-900'}`}
                >
                  {isExhausted ? "Exhausted" : "Select"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Difficulty;
