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
  const timeoutHandledRef = useRef(false);

  // Shared round timer from Difficulty screen
  const roundTimerStartedAt = state?.roundTimerStartedAt;
  const roundTimerDuration = state?.roundTimerDuration || 30;

  const maxQuestions =
    Number(state?.questionCount) ||
    Number(sessionData?.question_count) ||
    Number(sessionData?.questionCount) ||
    Number(state?.maxQuestions) ||
    1;

  const disableTimerForTesting = 
    Boolean(state?.disableTimerForTesting) ||
    Boolean(sessionData?.disable_timer_for_testing) ||
    false;

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

  // Safe fallback for current round
  const safeCurrentRound =
    Number(sessionData?.current_round) ||
    Number(state?.currentRound) ||
    Number(state?.roundNumber) ||
    answeredIds.length + 1 ||
    1;

  
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

      if (remaining === 0 && !hasAnsweredRef.current && !timeoutHandledRef.current && !disableTimerForTesting) {
        // Time expired - handle timeout properly
        timeoutHandledRef.current = true;
        handleTimeout();
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
    // Reset timeout ref when a new question loads
    timeoutHandledRef.current = false;
    
    if (sessionId && sessionData?.current_question_id) {
      checkIfAlreadyAnswered();
    }
  }, [sessionId, sessionData?.current_question_id, currentQuestionId]);

  const handleTimeout = async () => {
    try {
      // Resolve session ID safely
      const targetSessionId = resolvedSessionId || sessionId;
      const targetQuestionId = currentQuestionId || sessionData?.current_question_id;
      
      if (!targetSessionId || !targetQuestionId) {
        console.error("[QuestionTimeout] missing session or question id");
        navigate("/student/round-results", {
          state: {
            ...state,
            studentName,
            gameCode,
            sessionId: targetSessionId,
            currentQuestionId: targetQuestionId || "",
            currentDifficulty,
            currentRound: safeCurrentRound,
            questionCount: Number(state?.questionCount) || Number(maxQuestions) || 1,
            pointsAwarded: 0,
            isCorrect: false,
            selectedAnswer: null,
            timedOut: true,
            currentQuestion
          }
        });
        return;
      }

      // Resolve player_id from session_players
      const { data: playerRow } = await supabase
        .from("session_players")
        .select("id, student_name")
        .eq("session_id", targetSessionId)
        .eq("student_name", studentName)
        .maybeSingle();

      const resolvedPlayerId = playerRow?.student_name || studentName || playerId;

      // Determine round number
      const actualRoundNumber = Number(state?.currentRound) || Number(sessionData?.current_round) || 1;

      // Get real question ID
      const realQuestionId = currentQuestion?.id || 
        currentQuestion?.question_id || 
        currentQuestion?.qid || 
        targetQuestionId;

      console.log("[QuestionTimeoutDebug]", {
        studentName,
        gameCode,
        targetSessionId,
        resolvedSessionId,
        sessionId,
        currentRoundFromState: state?.currentRound,
        sessionCurrentRound: sessionData?.current_round,
        actualRoundNumber,
        currentQuestionId,
        targetQuestionId,
        currentQuestion,
        realQuestionId,
        resolvedPlayerId,
      });

      if (!realQuestionId) {
        console.error("[QuestionTimeout] no real question id found");
        navigate("/student/round-results", {
          state: {
            ...state,
            studentName,
            gameCode,
            sessionId: targetSessionId,
            currentQuestionId: targetQuestionId || "",
            currentDifficulty,
            currentRound: actualRoundNumber,
            questionCount: Number(state?.questionCount) || Number(maxQuestions) || 1,
            pointsAwarded: 0,
            isCorrect: false,
            selectedAnswer: null,
            timedOut: true,
            currentQuestion
          }
        });
        return;
      }

      // Check for existing response using the same unique constraint as normal answer
      const { data: existingResponse } = await supabase
        .from("responses")
        .select("*")
        .eq("session_id", targetSessionId)
        .eq("question_id", String(realQuestionId))
        .eq("player_id", resolvedPlayerId)
        .maybeSingle();

      console.log("[QuestionTimeoutDuplicateCheck]", {
        targetSessionId,
        realQuestionId,
        resolvedPlayerId,
        actualRoundNumber,
        existingResponse,
      });

      if (!existingResponse) {
        // Insert timeout response using upsert with same onConflict as normal answer
        const timeoutResponse = {
          session_id: targetSessionId,
          question_id: String(realQuestionId),
          player_id: resolvedPlayerId,
          round_number: actualRoundNumber,
          selected_answer: 0,
          is_correct: false,
          points_awarded: 0
        };

        const { error: upsertError } = await supabase
          .from("responses")
          .upsert(timeoutResponse, {
            onConflict: "session_id,question_id,player_id"
          });

        console.log("[QuestionTimeoutUpsertResult]", {
          timeoutResponse,
          upsertError,
        });

        if (upsertError) throw upsertError;
      }

      // Clear round timer after timeout to prevent Difficulty from reopening with expired timer
      const timerKey = `quizplay_round_timer_${gameCode}_${playerId}`;
      localStorage.removeItem(timerKey);

      // Navigate to RoundResults
      navigate("/student/round-results", {
        state: {
          ...state,
          studentName,
          gameCode,
          sessionId: targetSessionId,
          currentQuestionId: String(realQuestionId),
          currentDifficulty,
          currentRound: actualRoundNumber,
          questionCount: Number(state?.questionCount) || Number(maxQuestions) || 1,
          timePerQuestion: (() => {
                     const sentTimePerQuestion = Number(state?.timePerQuestion) ||
                                                 Number(state?.time_per_question) ||
                                                 Number(sessionData?.time_per_question) ||
                                                 Number(roundTimerDuration) ||
                                                 30;
                     console.log("[TimerFlow] Question timeout -> RoundResults", { sentTimePerQuestion });
                     return sentTimePerQuestion;
                   })(),
          pointsAwarded: 0,
          isCorrect: false,
          selectedAnswer: null,
          timedOut: true,
          currentQuestion,
          questionsByDifficulty: sessionData?.questions_by_difficulty || {}
        }
      });

    } catch (err) {
      console.error("Error handling timeout:", err);
      // Fallback navigation
      navigate("/student/round-results", {
        state: {
          ...state,
          studentName,
          gameCode,
          sessionId: resolvedSessionId || sessionId,
          currentRound: safeCurrentRound,
          questionCount: Number(state?.questionCount) || Number(maxQuestions) || 1,
          pointsAwarded: 0,
          isCorrect: false,
          selectedAnswer: null,
          timedOut: true,
          currentQuestion
        }
      });
    }
  };

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
            state: { ...state, studentName, gameCode, sessionId: targetSessionId, currentRound: safeCurrentRound, questionCount: maxQuestions }
          });
        } else {
          navigate("/student/difficulty", {
            state: { ...state, studentName, gameCode, sessionId: targetSessionId, currentRound: safeCurrentRound, questionCount: maxQuestions }
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
    // Prevent timeout from firing during normal answer submission
    timeoutHandledRef.current = true;

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

  if (loading || !sessionData) {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center px-6">
      {/* Rich racing background matching other student screens */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Layered depth glows */}
        <div className="absolute inset-0 bg-gradient-to-t from-cyan-400/5 via-transparent to-transparent animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute inset-0 bg-gradient-radial from-cyan-400/8 via-transparent to-transparent opacity-60" style={{ background: 'radial-gradient(circle at center, rgba(6, 182, 212, 0.08) 0%, transparent 50%)' }} />
        
        {/* Cyan racing curves on sides */}
        <svg className="absolute top-0 left-0 w-1/3 h-full" viewBox="0 0 300 800" style={{ opacity: 0.7 }}>
          <defs>
            <linearGradient id="cyanTrack" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#0891b2" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0e7490" stopOpacity="0.4" />
            </linearGradient>
            <filter id="cyanGlow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <path
            d="M 20 0 Q 120 200 40 400 T 60 800"
            stroke="url(#cyanTrack)"
            strokeWidth="4"
            fill="none"
            filter="url(#cyanGlow)"
            className="animate-pulse"
            style={{ animationDuration: '3s' }}
          />
          <path
            d="M 40 0 Q 140 200 60 400 T 80 800"
            stroke="#06b6d4"
            strokeWidth="2"
            fill="none"
            opacity="0.4"
            className="animate-pulse"
            style={{ animationDelay: '1s', animationDuration: '3s' }}
          />
        </svg>
        
        <svg className="absolute top-0 right-0 w-1/3 h-full" viewBox="0 0 300 800" style={{ opacity: 0.7 }}>
          <path
            d="M 280 0 Q 180 200 260 400 T 240 800"
            stroke="url(#cyanTrack)"
            strokeWidth="4"
            fill="none"
            filter="url(#cyanGlow)"
            className="animate-pulse"
            style={{ animationDuration: '3s', animationDelay: '1.5s' }}
          />
          <path
            d="M 260 0 Q 160 200 240 400 T 220 800"
            stroke="#06b6d4"
            strokeWidth="2"
            fill="none"
            opacity="0.4"
            className="animate-pulse"
            style={{ animationDelay: '2.5s', animationDuration: '3s' }}
          />
        </svg>
        
        {/* Speed lines */}
        <div className="absolute top-1/4 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent animate-pulse" style={{ animationDuration: '2s' }} />
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent animate-pulse" style={{ animationDelay: '1s', animationDuration: '2s' }} />
        <div className="absolute top-3/4 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent animate-pulse" style={{ animationDelay: '1.4s', animationDuration: '2s' }} />
        
        {/* Floating decorative elements */}
        <div className="absolute top-16 left-12 w-3 h-3 bg-cyan-400/25 rounded-full animate-ping border border-cyan-400/40" />
        <div className="absolute top-32 right-16 w-2 h-2 bg-cyan-400/20 rounded-full animate-ping border border-cyan-400/30" style={{ animationDelay: '1.8s' }} />
        <div className="absolute bottom-24 left-20 w-2 h-2 bg-cyan-400/15 rounded-full animate-pulse border border-cyan-400/25" style={{ animationDelay: '0.8s' }}>
          <span className="text-cyan-300/70 text-xs flex items-center justify-center h-full">⚡</span>
        </div>
        <div className="absolute bottom-40 right-12 w-3 h-3 bg-cyan-400/20 rounded-full animate-ping border border-cyan-400/30" style={{ animationDelay: '2.3s' }} />
        <div className="absolute top-48 left-24 w-2 h-2 text-cyan-300/25 animate-pulse" style={{ animationDelay: '1.3s' }}>
          <span className="text-lg">?</span>
        </div>
        <div className="absolute top-48 right-24 w-2 h-2 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.8s' }}>
          <span className="text-lg">?</span>
        </div>
        <div className="absolute bottom-48 left-16 w-2 h-2 text-cyan-300/15 animate-pulse" style={{ animationDelay: '3.2s' }}>
          <span className="text-base">⚡</span>
        </div>
        <div className="absolute bottom-48 right-16 w-2 h-2 text-cyan-300/15 animate-pulse" style={{ animationDelay: '0.6s' }}>
          <span className="text-base">⚡</span>
        </div>
        
        {/* Question marks and flags */}
        <div className="absolute top-24 left-32 w-2 h-2 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.1s' }}>
          <span className="text-sm">?</span>
        </div>
        <div className="absolute top-72 right-32 w-2 h-2 text-cyan-300/18 animate-pulse" style={{ animationDelay: '1.5s' }}>
          <span className="text-sm">?</span>
        </div>
        <div className="absolute top-36 left-64 w-1.5 h-1.5 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.2s' }}>
          <span className="text-base">🏁</span>
        </div>
        <div className="absolute bottom-56 left-64 w-1 h-1 text-cyan-300/15 animate-pulse" style={{ animationDelay: '3.9s' }}>
          <span className="text-sm">🏁</span>
        </div>
        <div className="absolute top-36 right-64 w-1.5 h-1.5 text-cyan-300/20 animate-pulse" style={{ animationDelay: '1.7s' }}>
          <span className="text-base">🏁</span>
        </div>
        <div className="absolute bottom-56 right-64 w-1 h-1 text-cyan-300/15 animate-pulse" style={{ animationDelay: '4.4s' }}>
          <span className="text-sm">🏁</span>
        </div>
        
        {/* Tiny sparkles/stars */}
        <div className="absolute top-4 left-24 w-1.5 h-1.5 text-cyan-300/25 animate-pulse" style={{ animationDelay: '1.1s' }}>
          <span className="text-base">✨</span>
        </div>
        <div className="absolute top-4 right-24 w-1.5 h-1.5 text-cyan-300/20 animate-pulse" style={{ animationDelay: '3.7s' }}>
          <span className="text-base">✨</span>
        </div>
        <div className="absolute bottom-4 left-24 w-1 h-1 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.9s' }}>
          <span className="text-sm">✨</span>
        </div>
        <div className="absolute bottom-4 right-24 w-1 h-1 text-cyan-300/15 animate-pulse" style={{ animationDelay: '4.5s' }}>
          <span className="text-sm">✨</span>
        </div>
        <div className="absolute top-40 left-8 w-1 h-1 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.7s' }}>
          <span className="text-sm">✨</span>
        </div>
        <div className="absolute top-40 right-8 w-1 h-1 text-cyan-300/15 animate-pulse" style={{ animationDelay: '1.9s' }}>
          <span className="text-sm">✨</span>
        </div>
        
        {/* Small cyan particles */}
        <div className="absolute top-12 left-4 w-1 h-1 bg-cyan-400/20 rounded-full animate-ping" style={{ animationDelay: '1.3s' }} />
        <div className="absolute top-28 left-4 w-1 h-1 bg-cyan-400/15 rounded-full animate-ping" style={{ animationDelay: '3.8s' }} />
        <div className="absolute top-44 left-4 w-1 h-1 bg-cyan-400/18 rounded-full animate-ping" style={{ animationDelay: '2.1s' }} />
        <div className="absolute top-60 left-4 w-1 h-1 bg-cyan-400/12 rounded-full animate-ping" style={{ animationDelay: '4.7s' }} />
        <div className="absolute top-76 left-4 w-1 h-1 bg-cyan-400/10 rounded-full animate-ping" style={{ animationDelay: '0.9s' }} />
        
        <div className="absolute top-12 right-4 w-1 h-1 bg-cyan-400/20 rounded-full animate-ping" style={{ animationDelay: '2.4s' }} />
        <div className="absolute top-28 right-4 w-1 h-1 bg-cyan-400/15 rounded-full animate-ping" style={{ animationDelay: '4.1s' }} />
        <div className="absolute top-44 right-4 w-1 h-1 bg-cyan-400/18 rounded-full animate-ping" style={{ animationDelay: '1.6s' }} />
        <div className="absolute top-60 right-4 w-1 h-1 bg-cyan-400/12 rounded-full animate-ping" style={{ animationDelay: '3.3s' }} />
        <div className="absolute top-76 right-4 w-1 h-1 bg-cyan-400/10 rounded-full animate-ping" style={{ animationDelay: '0.7s' }} />
        
        {/* Subtle racing dots */}
        <div className="absolute top-16 left-72 w-1.5 h-1.5 border border-cyan-400/15 rounded-full animate-pulse" style={{ animationDelay: '2.8s', animationDuration: '3s' }} />
        <div className="absolute top-48 left-72 w-1 h-1 border border-cyan-400/12 rounded-full animate-pulse" style={{ animationDelay: '4.2s', animationDuration: '3s' }} />
        <div className="absolute bottom-32 left-72 w-1.5 h-1.5 border border-cyan-400/10 rounded-full animate-pulse" style={{ animationDelay: '1.4s', animationDuration: '3s' }} />
        
        <div className="absolute top-16 right-72 w-1.5 h-1.5 border border-cyan-400/15 rounded-full animate-pulse" style={{ animationDelay: '3.1s', animationDuration: '3s' }} />
        <div className="absolute top-48 right-72 w-1 h-1 border border-cyan-400/12 rounded-full animate-pulse" style={{ animationDelay: '0.5s', animationDuration: '3s' }} />
        <div className="absolute bottom-32 right-72 w-1.5 h-1.5 border border-cyan-400/10 rounded-full animate-pulse" style={{ animationDelay: '4.6s', animationDuration: '3s' }} />
        
        {/* Checkered hints */}
        <div className="absolute top-32 left-4 w-1 h-1 opacity-12 animate-pulse" style={{ animationDelay: '2.7s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute top-32 right-4 w-1 h-1 opacity-10 animate-pulse" style={{ animationDelay: '1.9s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute bottom-16 left-4 w-1 h-1 opacity-8 animate-pulse" style={{ animationDelay: '3.4s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute bottom-16 right-4 w-1 h-1 opacity-8 animate-pulse" style={{ animationDelay: '0.8s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        
        {/* Extra speed streaks near edges */}
        <div className="absolute top-1/6 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent animate-pulse" style={{ animationDelay: '2.1s', animationDuration: '2s' }} />
        <div className="absolute top-5/6 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent animate-pulse" style={{ animationDelay: '2.8s', animationDuration: '2s' }} />
        <div className="absolute top-20 right-1/4 w-32 h-0.5 bg-gradient-to-l from-transparent via-cyan-400/20 to-transparent transform rotate-45 animate-pulse" style={{ animationDelay: '0.3s', animationDuration: '2s' }} />
        <div className="absolute bottom-32 left-1/4 w-28 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent transform rotate-12 animate-pulse" style={{ animationDelay: '1s', animationDuration: '2s' }} />
        
        {/* Enhanced HUD decorations */}
        <div className="absolute top-8 right-8 text-cyan-400/50 font-mono text-xs animate-pulse">
          <div>QUIZ: ACTIVE</div>
          <div>MODE: ANSWER</div>
          <div className="text-xs mt-1">TIME: {formatTime(timeLeft)}</div>
        </div>
        <div className="absolute bottom-8 left-8 text-cyan-400/40 font-mono text-xs animate-pulse" style={{ animationDelay: '1s' }}>
          <div>STATUS: THINKING</div>
          <div>ROUND: {currentRound}</div>
          <div className="text-xs mt-1">POINTS: {sessionData?.current_difficulty || "unknown"}</div>
        </div>
        <div className="absolute top-32 left-8 text-cyan-400/35 font-mono text-xs animate-pulse" style={{ animationDelay: '2s' }}>
          <div>QUESTION: {safeCurrentRound}</div>
          <div>DIFFICULTY: {(sessionData?.current_difficulty || "unknown").toUpperCase()}</div>
        </div>
        <div className="absolute bottom-32 right-8 text-cyan-400/30 font-mono text-xs animate-pulse" style={{ animationDelay: '3s' }}>
          <div>SESSION: {gameCode}</div>
          <div>PLAYER: {studentName}</div>
        </div>
      </div>
      
      {/* Premium glassmorphic question card */}
      <div className="relative w-full max-w-4xl bg-slate-800/60 backdrop-blur-xl rounded-3xl p-10 shadow-4xl border-2 border-cyan-400/40">
        {/* Inner glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/15 via-transparent to-blue-500/15 rounded-3xl opacity-60" />
        <div className="relative z-10">
          {/* Enhanced status header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="game-font text-4xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">Question</h1>
              <p className="text-slate-300 mt-2 text-lg">
                Round {currentRound} • Difficulty:{" "}
                <span className="text-white font-semibold capitalize">{sessionData?.current_difficulty || "unknown"}</span>
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-600 rounded-2xl px-6 py-4 text-center shadow-lg">
                <p className="text-slate-400 text-sm uppercase tracking-wider">Time</p>
                <p className="game-font text-3xl text-cyan-300">{formatTime(timeLeft)}</p>
              </div>
            </div>
          </div>

          {/* Question title area */}
          <div className="text-center mb-8">
            <h1 className="game-font text-5xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
              Question {safeCurrentRound}
            </h1>
            {disableTimerForTesting && (
              <div className="mt-4 inline-flex items-center px-4 py-2 rounded-full bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/50">
                <span className="text-emerald-400 text-sm font-medium">Timer disabled for testing ∞</span>
              </div>
            )}
          </div>

          {/* Premium question content card */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 mb-8 shadow-2xl">
            <p className="game-font text-3xl mb-6 text-white leading-relaxed">{currentQuestion.question || currentQuestion.q || currentQuestion.question_text}</p>
            <p className="text-slate-400 text-base">Choose one answer.</p>
          </div>

          {/* Premium answer cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
                  "relative text-left rounded-2xl p-6 transition-all duration-300 transform border-2",
                  hasAnswered || isSubmitting 
                    ? "cursor-not-allowed bg-slate-900/40 border-slate-600/50 opacity-60" 
                    : "bg-slate-900/30 backdrop-blur-sm border-slate-600/40 hover:bg-slate-900/40 hover:scale-105 hover:shadow-xl hover:border-cyan-400/60",
                  selectedAnswer === index
                    ? "border-cyan-400 bg-cyan-900/40 shadow-2xl shadow-cyan-500/25"
                    : ""
                ].join(" ")}
              >
                {/* Selected answer glow effect */}
                {selectedAnswer === index && !hasAnswered && (
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-2xl animate-pulse" style={{ animationDuration: '2s' }} />
                )}
                
                <div className="relative z-10">
                  <span className="text-white font-semibold text-lg">
                    <span className="inline-block w-8 h-8 bg-cyan-400/20 border-2 border-cyan-400 rounded-full text-center text-cyan-300 font-bold mr-3">
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                  </span>
                </div>
              </button>
            ))}
          </div>

        
          {/* Submitted waiting state */}
          {hasAnswered && (
            <div className="mt-8 p-6 rounded-2xl border border-cyan-400/50 bg-cyan-900/20 backdrop-blur-sm text-center shadow-xl">
              <p className="text-cyan-200 text-lg font-medium">
                Answer submitted! Waiting for other students...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Question;
