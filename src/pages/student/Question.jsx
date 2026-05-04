import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function Question() {
  const navigate = useNavigate();
  const { state } = useLocation();
  
  const studentName = state?.studentName ?? "";
  const gameCode = state?.gameCode ?? "";
  const sessionId = state?.sessionId ?? "";
  const currentRound = state?.currentRound ?? 1;
  const currentQuestionId = state?.currentQuestionId ?? null;
  const currentDifficulty = state?.currentDifficulty ?? null;
  // pointsPerQuestion is set by Difficulty.jsx based on selected difficulty
  const pointsPerQuestion = Number(state?.pointsPerQuestion ?? 100);
  const playerId = String(studentName ?? "").trim();
  
  const [sessionData, setSessionData] = useState(null);
  // resolvedSessionId: prefer the DB-fetched session.id over state.sessionId
  const [resolvedSessionId, setResolvedSessionId] = useState(sessionId);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const hasAnsweredRef = useRef(false);
  const timerStartRef = useRef(null);

  // Shared round timer from Difficulty screen
  const roundTimerStartedAt = state?.roundTimerStartedAt;
  const roundTimerDuration = state?.roundTimerDuration || 30;

  const maxQuestions =
    Number(state?.questionCount) ||
    Number(sessionData?.question_count) ||
    Number(sessionData?.questionCount) ||
    Number(state?.maxQuestions) ||
    1;

  useEffect(() => {
    if (!gameCode || !studentName) {
      navigate("/student/join");
      return;
    }

    async function loadSessionAndQuestion() {
      try {
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("game_code", gameCode)
          .single();

        if (sessionError) throw sessionError;
        setSessionData(session);
        // Always use the real session UUID from the DB
        setResolvedSessionId(session.id);

        if (session.status === "round_results") {
          navigate("/student/round-results", {
            state: { studentName, gameCode, sessionId: session.id, currentRound: session.current_round }
          });
          return;
        }

        if (session.status === "finished") {
          navigate("/student/final-results", {
            state: { studentName, gameCode, sessionId: session.id }
          });
          return;
        }

        if (session.status === "waiting") {
          navigate("/student/lobby", {
            state: { studentName, gameCode }
          });
          return;
        }

        // Active question UI is driven by sessionData + sync effect so timer stays tied to DB question/ends_at.

      } catch (err) {
        console.error("Error loading session:", err);
        setError("Failed to load session data");
      } finally {
        setLoading(false);
      }
    }

    loadSessionAndQuestion();

    const subscription = supabase
      .channel(`session-${gameCode}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `game_code=eq.${gameCode}`
      }, async () => {
        const { data: full, error: fullErr } = await supabase
          .from("sessions")
          .select("*")
          .eq("game_code", gameCode)
          .single();

        if (fullErr || !full) {
          return;
        }

        setSessionData(full);

        if (full.status === "round_results") {
          navigate("/student/round-results", {
            state: {
              studentName,
              gameCode,
              sessionId: full.id,
              currentRound: full.current_round,
            },
          });
        } else if (full.status === "finished") {
          navigate("/student/final-results", {
            state: { studentName, gameCode, sessionId: full.id },
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [
    gameCode,
    studentName,
    sessionId,
    currentRound,
    navigate,
  ]);

  useEffect(() => {
    hasAnsweredRef.current = hasAnswered;
  }, [hasAnswered]);

  useEffect(() => {
    if (sessionData?.status !== "active" || !sessionData?.current_question_id) {
      return;
    }
    setHasAnswered(false);
    setSelectedAnswer(null);
    setIsSubmitting(false);
    setError("");
  }, [sessionData?.current_question_id]);

  useEffect(() => {
    if (!sessionData?.current_question_id) return;
    setHasAnswered(false);
    setSelectedAnswer(null);
    setIsSubmitting(false);
  }, [sessionData?.current_question_id]);

  useEffect(() => {
    if (sessionData?.status !== "active" || !sessionData?.current_question_id) {
      return;
    }

    const difficulty = currentDifficulty || sessionData.current_difficulty || "easy";
    const questionId = currentQuestionId || sessionData.current_question_id;

    const bankFromSession =
      sessionData.questions_by_difficulty || sessionData.questionsByDifficulty;

    const localKey = `quizplay_session_${gameCode}`;
    const raw = localStorage.getItem(localKey);
    const config = raw ? JSON.parse(raw) : null;

    const isValidBank = (b) =>
      b &&
      Object.keys(b).length > 0 &&
      Object.values(b).some((arr) => Array.isArray(arr) && arr.length > 0);

    const questionsByDifficulty =
      (isValidBank(bankFromSession) ? bankFromSession : null) ||
      (isValidBank(config?.questionsByDifficulty)
        ? config.questionsByDifficulty
        : null) ||
      (isValidBank(config?.questions_by_difficulty)
        ? config.questions_by_difficulty
        : null) ||
      {};

    const bank = questionsByDifficulty?.[difficulty] || [];
    const foundQuestion = bank.find(
      (q) =>
        q.id === questionId ||
        q.question_id === questionId ||
        q.qid === questionId
    );

    if (foundQuestion) {
      setCurrentQuestion(foundQuestion);
      setError("");
    } else {
      setCurrentQuestion(null);
      setError("Current question could not be loaded.");
    }
  }, [
    sessionData?.status,
    sessionData?.current_question_id,
    sessionData?.current_difficulty,
    sessionData?.questions_by_difficulty,
    gameCode,
  ]);

  
  // Shared round timer continuation from Difficulty screen
  useEffect(() => {
    // Clear any existing timer
    if (timerStartRef.current) {
      clearInterval(timerStartRef.current);
      timerStartRef.current = null;
    }

    // Don't start timer if no question, already answered, or no round timer
    if (!currentQuestionId || hasAnswered || !roundTimerStartedAt) {
      setTimeLeft(0);
      return;
    }

    console.log("[Timer] Question continuing from round timer:", roundTimerStartedAt, roundTimerDuration);
    
    // Calculate remaining time from shared round timer
    const tick = () => {
      const elapsed = Math.floor((Date.now() - new Date(roundTimerStartedAt)) / 1000);
      const remaining = Math.max(0, roundTimerDuration - elapsed);
      setTimeLeft(remaining);

      if (remaining === 0 && !hasAnsweredRef.current) {
        // Time expired - navigate back to Difficulty without saving -1 answer
        navigate("/student/difficulty", {
          state: {
            ...state,
            studentName,
            gameCode,
            sessionId: resolvedSessionId || sessionId,
            currentRound: sessionData.current_round,
            questionCount: maxQuestions
          }
        });
      }
    };

    // Initial calculation
    tick();
    
    // Update every second
    timerStartRef.current = setInterval(tick, 1000);
    
    return () => {
      if (timerStartRef.current) {
        clearInterval(timerStartRef.current);
        timerStartRef.current = null;
      }
    };
  }, [
    currentQuestionId,
    hasAnswered,
    roundTimerStartedAt,
    roundTimerDuration,
    navigate,
    state,
    studentName,
    gameCode,
    resolvedSessionId,
    sessionId,
    sessionData?.current_round,
    maxQuestions
  ]);

  useEffect(() => {
    if (sessionId && sessionData?.current_question_id) {
      checkIfAlreadyAnswered();
    }
  }, [sessionId, sessionData?.current_question_id, currentQuestionId]);

  const checkIfAlreadyAnswered = async () => {
    try {
      const targetSessionId = resolvedSessionId || sessionId;
      const targetQuestionId = currentQuestionId || sessionData?.current_question_id;
      if (!targetQuestionId || !targetSessionId) return;

      const { data: existingResponse } = await supabase
        .from("responses")
        .select("*")
        .eq("session_id", targetSessionId)
        .eq("question_id", targetQuestionId)
        .eq("player_id", playerId)
        .maybeSingle();

      if (existingResponse) {
        setHasAnswered(true);
        setSelectedAnswer(existingResponse.selected_answer);

        const localKey = `quizplay_answered_questions_${gameCode}_${playerId}`;
        const stored = localStorage.getItem(localKey);
        const answered = stored ? JSON.parse(stored) : [];
        if (!answered.includes(targetQuestionId)) {
          answered.push(targetQuestionId);
          localStorage.setItem(localKey, JSON.stringify(answered));
        }

        const reachedLimit = answered.length >= maxQuestions;

        if (reachedLimit) {
          navigate("/student/final-results", {
            state: { ...state, studentName, gameCode, sessionId: targetSessionId, currentRound: sessionData.current_round, questionCount: maxQuestions }
          });
        } else {
          navigate("/student/difficulty", {
            state: { ...state, studentName, gameCode, sessionId: targetSessionId, currentRound: sessionData.current_round, questionCount: maxQuestions }
          });
        }
      }
    } catch (err) {
      // No existing response is fine
    }
  };

  const handleSubmit = async (answerOverride = null) => {
    if (isSubmitting || hasAnswered) return;

    if (!currentQuestion) {
      setError("Question is still loading. Please wait.");
      return;
    }

    const answerToSubmit = answerOverride ?? selectedAnswer;

    if (answerToSubmit === null || answerToSubmit === undefined) {
      setError("Please select an answer before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      const targetSessionIdPre =
        sessionData?.id || resolvedSessionId || sessionId || null;
      if (!targetSessionIdPre) {
        setError("Session not loaded. Please wait or rejoin.");
        setIsSubmitting(false);
        return;
      }
      const correctAnswer =
        currentQuestion.correctAnswer ??
        currentQuestion.correct_answer ??
        currentQuestion.correct_option ??
        0;

      const isCorrect = Number(answerToSubmit) === Number(correctAnswer);
      // Use difficulty-based points from Difficulty.jsx, fallback to 100
      const pointsAwarded = isCorrect ? pointsPerQuestion : 0;

      const targetQuestionId = currentQuestion.id || currentQuestionId || sessionData?.current_question_id;
      const targetSessionId = targetSessionIdPre;

      // Calculate actual round number based on student's previous responses
      const { data: existingResponses } = await supabase
        .from("responses")
        .select("round_number")
        .eq("session_id", targetSessionId)
        .eq("player_id", playerId)
        .order("answered_at", { ascending: false })
        .limit(1);

      const actualRoundNumber = existingResponses && existingResponses.length > 0 
        ? (existingResponses[0].round_number || 0) + 1
        : 1;

      const responsePayload = {
        session_id: targetSessionId,
        question_id: String(targetQuestionId ?? ""),
        player_id: playerId,
        round_number: actualRoundNumber,
        selected_answer: answerToSubmit,
        is_correct: isCorrect,
        points_awarded: pointsAwarded,
      };

      console.log("Selected answer before submit:", answerToSubmit);
      console.log("Current question before submit:", currentQuestion);
      console.log("Response insert payload:", responsePayload);

      const { error: upsertError } = await supabase
        .from("responses")
        .upsert(responsePayload, {
          onConflict: "session_id,question_id,player_id"
        });

      if (upsertError) throw upsertError;

      setHasAnswered(true);

      // Update total_score safely: recalculate from all responses to avoid race conditions
      const { data: allMyResponses } = await supabase
        .from("responses")
        .select("points_awarded")
        .eq("session_id", targetSessionId)
        .eq("player_id", playerId);

      if (allMyResponses) {
        const newTotalScore = allMyResponses.reduce(
          (sum, r) => sum + Number(r.points_awarded || 0),
          0
        );
        await supabase
          .from("session_players")
          .update({ total_score: newTotalScore })
          .eq("session_id", targetSessionId)
          .eq("student_name", playerId);
      }

      // Add to local storage
      const localKey = `quizplay_answered_questions_${gameCode}_${playerId}`;
      const stored = localStorage.getItem(localKey);
      const answered = stored ? JSON.parse(stored) : [];
      if (!answered.includes(targetQuestionId)) {
        answered.push(targetQuestionId);
        localStorage.setItem(localKey, JSON.stringify(answered));
      }

      // Clear round timer after successful answer to prepare for next round
      const timerKey = `quizplay_round_timer_${gameCode}_${playerId}`;
      localStorage.removeItem(timerKey);

      const reachedLimit = answered.length >= maxQuestions;

      if (reachedLimit) {
        navigate("/student/final-results", {
          state: {
            ...state,
            studentName,
            gameCode,
            sessionId: targetSessionId,
            currentRound: sessionData?.current_round,
            questionCount: maxQuestions
          }
        });
      } else {
        const resolvedQuestionsByDifficulty =
          state?.questionsByDifficulty ||
          state?.questions_by_difficulty ||
          sessionData?.questions_by_difficulty ||
          {};

        navigate("/student/round-results", {
          state: {
            ...state,
            studentName,
            gameCode,
            sessionId: targetSessionId,
            currentQuestionId: targetQuestionId,
            currentDifficulty,
            currentRound: actualRoundNumber,
            questionCount: maxQuestions,
            timePerQuestion: roundTimerDuration || 30,
            pointsAwarded,
            isCorrect,
            selectedAnswer: answerToSubmit,
            currentQuestion,
            questionsByDifficulty: resolvedQuestionsByDifficulty
          }
        });
      }

    } catch (err) {
      console.error("Error submitting answer:", err);
      setError(err.message || "Failed to submit answer");
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-xl font-semibold">Loading question...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Error</h1>
          <p className="text-slate-300 mb-6">{error}</p>
          <button
            onClick={() => setError("")}
            className="px-4 py-2 rounded-xl bg-cyan-500 text-white hover:bg-cyan-600 transition font-semibold"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-yellow-300 mb-4">Waiting for Question</h1>
          <p className="text-slate-300 mb-6">The instructor will start the next question soon.</p>
        </div>
      </div>
    );
  }

  const options = currentQuestion.options || currentQuestion.choices || [];

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-3xl bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="game-font text-3xl text-cyan-300">Question</h1>
            <p className="text-slate-300 mt-1">
              Round {currentRound} • Difficulty:{" "}
              <span className="text-white capitalize">{sessionData?.current_difficulty || "unknown"}</span>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-slate-900 border border-slate-600 rounded-2xl px-5 py-3 text-center">
              <p className="text-slate-300 text-sm">Time</p>
              <p className="game-font text-2xl text-yellow-300">{formatTime(timeLeft)}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
          <p className="game-font text-2xl mb-4">{currentQuestion.question || currentQuestion.q || currentQuestion.question_text}</p>
          <p className="text-slate-400 text-sm">Choose one answer.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {options.map((option, index) => (
            <button
              type="button"
              key={index}
              onClick={() => {
                setSelectedAnswer(index);
                handleSubmit(index);
              }}
              disabled={hasAnswered || isSubmitting}
              className={[
                "text-left rounded-xl p-4 transition border-2",
                hasAnswered || isSubmitting ? "cursor-not-allowed" : "hover:bg-slate-700",
                "bg-slate-900",
                selectedAnswer === index
                  ? "border-cyan-400 bg-cyan-900/30"
                  : "border-slate-700"
              ].join(" ")}
            >
              <span className="text-white font-medium">
                {String.fromCharCode(65 + index)}. {option}
              </span>
            </button>
          ))}
        </div>

        
        {hasAnswered && (
          <div className="mt-6 p-4 rounded-xl border border-cyan-200 bg-cyan-900/20 text-center">
            <p className="text-cyan-200">
              Answer submitted! Waiting for other students...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Question;
