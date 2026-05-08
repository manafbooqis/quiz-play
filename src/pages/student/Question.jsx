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

      if (remaining === 0 && !hasAnsweredRef.current && !timeoutHandledRef.current) {
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
    <>
      {/* Rich Racing Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden pointer-events-none">
        
        {/* Layered depth glows */}
        <div className="absolute inset-0 bg-gradient-to-t from-cyan-400/5 via-transparent to-pink-400/5 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute inset-0 bg-gradient-radial from-cyan-400/8 via-transparent to-transparent opacity-60" style={{ background: 'radial-gradient(circle at 30% 50%, rgba(6, 182, 212, 0.08) 0%, transparent 50%)' }} />
        <div className="absolute inset-0 bg-gradient-radial from-pink-400/8 via-transparent to-transparent opacity-60" style={{ background: 'radial-gradient(circle at 70% 50%, rgba(236, 72, 153, 0.08) 0%, transparent 50%)' }} />
        <div className="absolute inset-0 bg-gradient-radial from-yellow-400/4 via-transparent to-transparent opacity-50" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(250, 204, 21, 0.04) 0%, transparent 50%)' }} />
        
        {/* Stronger curved neon racing lanes */}
        <div className="absolute inset-0">
          {/* Left side - enhanced cyan/blue racing track */}
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
            <path d="M 50 100 Q 150 200 100 300 T 200 500 Q 250 600 150 700 L 100 800" 
                  stroke="url(#cyanTrack)" strokeWidth="8" fill="none" filter="url(#cyanGlow)" className="animate-pulse" style={{ animationDuration: '3s' }} />
            <path d="M 30 0 Q 130 200 30 400 T 50 800" 
                  stroke="#06b6d4" strokeWidth="4" fill="none" opacity="0.6" className="animate-pulse" style={{ animationDelay: '1s', animationDuration: '3s' }} />
            <path d="M 70 0 Q 170 200 70 400 T 90 800" 
                  stroke="#0891b2" strokeWidth="3" fill="none" opacity="0.4" className="animate-pulse" style={{ animationDelay: '2s', animationDuration: '3s' }} />
            <path d="M 90 0 Q 190 200 90 400 T 110 800" 
                  stroke="#0e7490" strokeWidth="2" fill="none" opacity="0.2" className="animate-pulse" style={{ animationDelay: '3s', animationDuration: '3s' }} />
          </svg>
          
          {/* Right side - enhanced pink/purple racing track */}
          <svg className="absolute top-0 right-0 w-1/3 h-full" viewBox="0 0 300 800" style={{ opacity: 0.6 }}>
            <defs>
              <linearGradient id="pinkTrack" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ec4899" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#db2777" stopOpacity="1" />
                <stop offset="100%" stopColor="#be185d" stopOpacity="0.5" />
              </linearGradient>
              <filter id="pinkGlow">
                <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <path d="M 250 100 Q 150 200 250 300 T 200 500 Q 150 600 250 700 L 200 800" 
                  stroke="url(#pinkTrack)" strokeWidth="8" fill="none" filter="url(#pinkGlow)" className="animate-pulse" style={{ animationDuration: '3s', animationDelay: '1.5s' }} />
            <path d="M 270 0 Q 170 200 270 400 T 250 800" 
                  stroke="#ec4899" strokeWidth="4" fill="none" opacity="0.6" className="animate-pulse" style={{ animationDelay: '2.5s', animationDuration: '3s' }} />
            <path d="M 230 0 Q 130 200 230 400 T 210 800" 
                  stroke="#db2777" strokeWidth="3" fill="none" opacity="0.4" className="animate-pulse" style={{ animationDelay: '3.5s', animationDuration: '3s' }} />
            <path d="M 210 0 Q 110 200 210 400 T 190 800" 
                  stroke="#be185d" strokeWidth="2" fill="none" opacity="0.2" className="animate-pulse" style={{ animationDelay: '4.5s', animationDuration: '3s' }} />
          </svg>
        </div>
        
        {/* Enhanced speed lines */}
        <div className="absolute top-1/4 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent animate-pulse" style={{ animationDuration: '2s' }} />
        <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-pink-400/60 to-transparent animate-pulse" style={{ animationDelay: '0.7s', animationDuration: '2s' }} />
        <div className="absolute top-3/4 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-yellow-300/40 to-transparent animate-pulse" style={{ animationDelay: '1.4s', animationDuration: '2s' }} />
        <div className="absolute top-1/6 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent animate-pulse" style={{ animationDelay: '2.1s', animationDuration: '2s' }} />
        <div className="absolute top-5/6 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-400/30 to-transparent animate-pulse" style={{ animationDelay: '2.8s', animationDuration: '2s' }} />
        
        {/* Diagonal speed streaks */}
        <div className="absolute top-20 right-1/4 w-48 h-1.5 bg-gradient-to-l from-transparent via-cyan-400/40 to-transparent transform rotate-45 animate-pulse" style={{ animationDelay: '0.3s', animationDuration: '2s' }} />
        <div className="absolute bottom-32 left-1/4 w-40 h-1.5 bg-gradient-to-r from-transparent via-pink-400/40 to-transparent transform rotate-12 animate-pulse" style={{ animationDelay: '1s', animationDuration: '2s' }} />
        <div className="absolute top-60 left-1/3 w-36 h-1 bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent transform -rotate-12 animate-pulse" style={{ animationDelay: '1.7s', animationDuration: '2s' }} />
        <div className="absolute bottom-48 right-1/3 w-44 h-1 bg-gradient-to-l from-transparent via-pink-400/35 to-transparent transform -rotate-6 animate-pulse" style={{ animationDelay: '2.3s', animationDuration: '2s' }} />
        
        {/* Floating decorative elements */}
        <div className="absolute top-16 left-12 w-3 h-3 bg-cyan-400/25 rounded-full animate-ping border border-cyan-400/40" />
        <div className="absolute top-32 right-16 w-2 h-2 bg-cyan-400/20 rounded-full animate-ping border border-cyan-400/30" style={{ animationDelay: '1.8s' }} />
        <div className="absolute bottom-24 left-20 w-2 h-2 bg-cyan-400/15 rounded-full animate-pulse border border-cyan-400/25" style={{ animationDelay: '0.8s' }}>
          <span className="text-cyan-300/70 text-xs flex items-center justify-center h-full">🏁</span>
        </div>
        <div className="absolute bottom-40 right-12 w-3 h-3 bg-cyan-400/20 rounded-full animate-ping border border-cyan-400/30" style={{ animationDelay: '2.3s' }} />
        <div className="absolute top-48 left-24 w-2 h-2 text-cyan-300/25 animate-pulse" style={{ animationDelay: '1.3s' }}>
          <span className="text-cyan-300/70 text-xs flex items-center justify-center h-full">⚡</span>
        </div>
        <div className="absolute top-24 right-24 w-2 h-2 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.6s' }}>
          <span className="text-cyan-300/70 text-xs flex items-center justify-center h-full">⚡</span>
        </div>
        <div className="absolute bottom-12 right-24 w-2 h-2 text-cyan-300/15 animate-pulse" style={{ animationDelay: '3.2s' }}>
          <span className="text-cyan-300/70 text-xs flex items-center justify-center h-full">⚡</span>
        </div>
      </div>
      
      {/* Radial overlay for depth */}
      <div className="fixed inset-0 bg-gradient-radial from-transparent via-slate-900/20 to-slate-900/40 pointer-events-none z-20" style={{ background: 'radial-gradient(circle at center, transparent 0%, rgba(15, 23, 42, 0.2) 50%, rgba(15, 23, 42, 0.4) 100%)' }} />
      
      {/* Main Content - Wide Desktop Panel */}
      <div className="relative min-h-screen flex items-center justify-center px-6 z-30">
        <div className="w-[90vw] max-w-6xl bg-slate-800/70 backdrop-blur-xl rounded-3xl shadow-3xl border-2 border-slate-600/50 p-4 md:p-8">
          {/* Enhanced Header with Timer */}
          <div className="flex flex-col items-center justify-center gap-4 md:gap-8 mb-6 md:mb-12">
            {/* Premium Title */}
            <h1 className="game-font text-4xl md:text-6xl font-bold relative text-center">
              {/* Strong neon glow background */}
              <span className="absolute inset-0 blur-3xl bg-gradient-to-r from-cyan-400/60 via-pink-400/50 to-cyan-400/60 animate-pulse" style={{ animationDuration: '3s' }} />
              <span className="absolute inset-0 blur-xl bg-gradient-to-r from-cyan-400/40 via-pink-400/30 to-cyan-400/40 animate-pulse" style={{ animationDelay: '1.5s', animationDuration: '3s' }} />
              <span className="relative bg-gradient-to-r from-cyan-300 via-pink-200 to-cyan-300 bg-clip-text text-transparent drop-shadow-lg">
                QUESTION {currentRound}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-slate-300 text-lg md:text-xl text-center">
              Question {currentRound} • Difficulty:{" "}
              <span className="text-white capitalize font-semibold">{sessionData?.current_difficulty || currentDifficulty || "unknown"}</span>
            </p>

            {/* Centered Timer Card */}
            <div className="relative bg-slate-900/65 backdrop-blur-2xl border-2 border-cyan-400/55 rounded-2xl px-4 py-3 md:px-8 md:py-5 hover:border-cyan-400/75 transition-all duration-300 shadow-cyan-400/25 shadow-2xl">
              {/* Enhanced glow effect */}
              <div className="absolute inset-0 bg-cyan-400/22 rounded-3xl animate-pulse" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/18 to-transparent rounded-3xl" />
              <div className="absolute inset-0 bg-gradient-radial from-cyan-400/6 via-transparent to-transparent" style={{ background: 'radial-gradient(circle at center, rgba(6, 182, 212, 0.06) 0%, transparent 60%)' }} />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/3 to-transparent opacity-20" />
              <p className="text-cyan-300 text-xs font-bold tracking-wider uppercase relative z-10 mb-1 md:mb-2">Time Remaining</p>
              <p className="game-font text-2xl md:text-4xl font-bold bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-300 bg-clip-text text-transparent relative z-10 animate-pulse" style={{ animationDuration: '2s' }}>
                {formatTime(timeLeft)}
              </p>
            </div>
          </div>

        {/* Question Card with Clean Multicolor Edge Glow */}
          <div className="relative w-full bg-slate-900/80 backdrop-blur-xl rounded-3xl p-4 md:p-8 mb-6 md:mb-8 border-2 border-transparent shadow-2xl overflow-hidden">
            {/* Multicolor edge glow effect */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-400/20 via-blue-400/20 to-pink-400/20 animate-pulse" style={{ animationDuration: '4s' }} />
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-amber-400/15 via-transparent to-transparent animate-pulse" style={{ animationDelay: '2s', animationDuration: '4s' }} />
            <div className="absolute inset-0 rounded-3xl border-2 border-transparent bg-gradient-to-r from-cyan-400/30 via-blue-400/30 via-amber-400/30 to-pink-400/30 animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-transparent via-white/5 to-transparent" />
            
            {/* Question content */}
            <div className="relative z-10">
              <p className="game-font text-2xl md:text-3xl font-bold text-white mb-4 md:mb-4 leading-relaxed">
                {currentQuestion.question || currentQuestion.q || currentQuestion.question_text}
              </p>
              <p className="text-slate-300 text-base">Choose one answer.</p>
            </div>
          </div>

        {/* Answer Cards with A/B/C/D Color Themes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8 w-full">
            {options.map((option, index) => {
              // Color themes for each answer option
              const answerThemes = {
                0: { // A - Cyan/Teal
                  bg: 'from-cyan-500/20 to-teal-500/20',
                  border: 'border-cyan-400/60 hover:border-cyan-400/90',
                  glow: 'hover:shadow-cyan-400/40',
                  selected: 'border-cyan-400 bg-cyan-900/40 shadow-cyan-400/50',
                  letter: 'text-cyan-300'
                },
                1: { // B - Blue
                  bg: 'from-blue-500/20 to-indigo-500/20',
                  border: 'border-blue-400/60 hover:border-blue-400/90',
                  glow: 'hover:shadow-blue-400/40',
                  selected: 'border-blue-400 bg-blue-900/40 shadow-blue-400/50',
                  letter: 'text-blue-300'
                },
                2: { // C - Amber/Yellow
                  bg: 'from-amber-500/20 to-yellow-500/20',
                  border: 'border-amber-400/60 hover:border-amber-400/90',
                  glow: 'hover:shadow-amber-400/40',
                  selected: 'border-amber-400 bg-amber-900/40 shadow-amber-400/50',
                  letter: 'text-amber-300'
                },
                3: { // D - Pink/Magenta
                  bg: 'from-pink-500/20 to-magenta-500/20',
                  border: 'border-pink-400/60 hover:border-pink-400/90',
                  glow: 'hover:shadow-pink-400/40',
                  selected: 'border-pink-400 bg-pink-900/40 shadow-pink-400/50',
                  letter: 'text-pink-300'
                }
              };

              const theme = answerThemes[index] || answerThemes[0];
              const isSelected = selectedAnswer === index;

              return (
                <button
                  type="button"
                  key={index}
                  onClick={() => {
                    setSelectedAnswer(index);
                    handleSubmit(index);
                  }}
                  disabled={hasAnswered || isSubmitting}
                  className={`relative w-full text-left rounded-2xl p-4 md:p-6 transition-all duration-300 transform hover:scale-[1.02] border-2 backdrop-blur-md overflow-hidden group ${
                    hasAnswered || isSubmitting 
                      ? 'cursor-not-allowed bg-slate-900/50 border-slate-600/40 opacity-60' 
                      : `bg-gradient-to-br ${theme.bg} ${theme.border} hover:bg-slate-900/30 ${theme.glow} hover:shadow-2xl`
                  } ${isSelected ? theme.selected : ''}`}
                >
                  {/* Subtle glow effect */}
                  {!hasAnswered && !isSubmitting && (
                    <div className={`absolute inset-0 bg-gradient-to-br ${theme.bg} opacity-0 group-hover:opacity-50 transition-opacity duration-300`} />
                  )}
                  
                  {/* Answer content */}
                  <div className="relative z-10">
                    <div className="flex items-start gap-4">
                      <span className={`text-2xl font-bold ${theme.letter} ${isSelected ? 'animate-pulse' : ''}`}>
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="text-white font-medium text-base md:text-lg leading-relaxed flex-1">
                        {option}
                      </span>
                    </div>
                  </div>

                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-3 h-3 bg-white rounded-full animate-ping" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Answer submitted message */}
          {hasAnswered && (
            <div className="relative mt-6 p-6 rounded-2xl border-2 border-cyan-400/50 bg-cyan-900/20 backdrop-blur-md text-center">
              <div className="absolute inset-0 bg-cyan-400/10 rounded-2xl animate-pulse" style={{ animationDuration: '2s' }} />
              <p className="text-cyan-200 text-lg font-semibold relative z-10">
                Answer submitted! Waiting for other students...
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Question;
