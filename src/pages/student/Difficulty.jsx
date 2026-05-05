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

  const disableTimerForTesting = 
    Boolean(state?.disableTimerForTesting) ||
    Boolean(session?.disable_timer_for_testing) ||
    false;

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
        
        // Handle timeout if no difficulty selected and not already handled and timer not disabled
        if (!difficultyTimeoutHandledRef.current && !disableTimerForTesting) {
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

  const cards = [
    {
      diff: 'easy',
      label: 'Easy',
      points: 100,
      badge: 'bg-green-400'
    },
    {
      diff: 'medium',
      label: 'Medium',
      points: 200,
      badge: 'bg-yellow-400'
    },
    {
      diff: 'hard',
      label: 'Hard',
      points: 300,
      badge: 'bg-red-400'
    }
  ];

  const getAvailableCount = (difficulty) => {
    return questionsByDifficulty?.[difficulty]?.length ?? 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center px-6">
      {/* Rich racing background matching Join Game screen */}
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
        <div className="absolute top-1/4 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent animate-pulse" style={{ animationDuration: '2s' }} />
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent animate-pulse" style={{ animationDelay: '0.7s', animationDuration: '2s' }} />
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
        <div className="absolute top-64 right-28 w-1.5 h-1.5 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.8s' }}>
          <span className="text-base">🏁</span>
        </div>
        
        {/* More tiny decorative elements */}
        <div className="absolute top-8 left-32 w-2 h-2 text-cyan-300/20 animate-pulse" style={{ animationDelay: '3.2s', animationDuration: '3s' }}>
          <span className="text-sm">?</span>
        </div>
        <div className="absolute top-72 left-32 w-1.5 h-1.5 text-cyan-300/15 animate-pulse" style={{ animationDelay: '1.8s', animationDuration: '3s' }}>
          <span className="text-base">?</span>
        </div>
        <div className="absolute top-8 right-32 w-2 h-2 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.6s', animationDuration: '3s' }}>
          <span className="text-sm">?</span>
        </div>
        <div className="absolute top-72 right-32 w-1.5 h-1.5 text-cyan-300/15 animate-pulse" style={{ animationDelay: '4.3s', animationDuration: '3s' }}>
          <span className="text-base">?</span>
        </div>
        
        {/* Tiny trophies */}
        <div className="absolute top-12 left-48 w-2 h-2 text-cyan-300/25 animate-pulse" style={{ animationDelay: '2.6s', animationDuration: '4s' }}>
          <span className="text-lg">🏆</span>
        </div>
        <div className="absolute bottom-16 right-48 w-1.5 h-1.5 text-cyan-300/20 animate-pulse" style={{ animationDelay: '4.2s', animationDuration: '4s' }}>
          <span className="text-base">🏆</span>
        </div>
        <div className="absolute top-56 left-56 w-1 h-1 text-cyan-300/15 animate-pulse" style={{ animationDelay: '1.1s', animationDuration: '4s' }}>
          <span className="text-sm">🏆</span>
        </div>
        
        {/* More lightning bolts */}
        <div className="absolute top-24 left-8 w-1.5 h-1.5 text-cyan-300/25 animate-pulse" style={{ animationDelay: '2.5s', animationDuration: '2.5s' }}>
          <span className="text-base">⚡</span>
        </div>
        <div className="absolute top-52 left-8 w-1 h-1 text-cyan-300/20 animate-pulse" style={{ animationDelay: '4.8s', animationDuration: '2.5s' }}>
          <span className="text-sm">⚡</span>
        </div>
        <div className="absolute top-24 right-8 w-1.5 h-1.5 text-cyan-300/25 animate-pulse" style={{ animationDelay: '1.2s', animationDuration: '2.5s' }}>
          <span className="text-base">⚡</span>
        </div>
        <div className="absolute top-52 right-8 w-1 h-1 text-cyan-300/20 animate-pulse" style={{ animationDelay: '3.6s', animationDuration: '2.5s' }}>
          <span className="text-sm">⚡</span>
        </div>
        
        {/* More flag icons */}
        <div className="absolute top-36 left-64 w-1.5 h-1.5 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.2s', animationDuration: '3s' }}>
          <span className="text-base">🏁</span>
        </div>
        <div className="absolute bottom-56 left-64 w-1 h-1 text-cyan-300/15 animate-pulse" style={{ animationDelay: '3.9s', animationDuration: '3s' }}>
          <span className="text-sm">🏁</span>
        </div>
        <div className="absolute top-36 right-64 w-1.5 h-1.5 text-cyan-300/20 animate-pulse" style={{ animationDelay: '1.7s', animationDuration: '3s' }}>
          <span className="text-base">🏁</span>
        </div>
        <div className="absolute bottom-56 right-64 w-1 h-1 text-cyan-300/15 animate-pulse" style={{ animationDelay: '4.4s', animationDuration: '3s' }}>
          <span className="text-sm">🏁</span>
        </div>
        
        {/* Tiny sparkles/stars */}
        <div className="absolute top-4 left-24 w-1.5 h-1.5 text-cyan-300/25 animate-pulse" style={{ animationDelay: '1.1s', animationDuration: '2s' }}>
          <span className="text-base">✨</span>
        </div>
        <div className="absolute top-4 right-24 w-1.5 h-1.5 text-cyan-300/20 animate-pulse" style={{ animationDelay: '3.7s', animationDuration: '2s' }}>
          <span className="text-base">✨</span>
        </div>
        <div className="absolute bottom-4 left-24 w-1 h-1 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.9s', animationDuration: '2s' }}>
          <span className="text-sm">✨</span>
        </div>
        <div className="absolute bottom-4 right-24 w-1 h-1 text-cyan-300/15 animate-pulse" style={{ animationDelay: '4.5s', animationDuration: '2s' }}>
          <span className="text-sm">✨</span>
        </div>
        <div className="absolute top-40 left-8 w-1 h-1 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.7s', animationDuration: '2s' }}>
          <span className="text-sm">✨</span>
        </div>
        <div className="absolute top-40 right-8 w-1 h-1 text-cyan-300/15 animate-pulse" style={{ animationDelay: '1.9s', animationDuration: '2s' }}>
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
          <div>RACE: READY</div>
          <div>MODE: SELECT</div>
          <div className="text-xs mt-1">LAP: 0/0</div>
        </div>
        <div className="absolute bottom-8 left-8 text-cyan-400/40 font-mono text-xs animate-pulse" style={{ animationDelay: '1s' }}>
          <div>SPEED: 0</div>
          <div>STATUS: WAIT</div>
          <div className="text-xs mt-1">TIME: --:--</div>
        </div>
        <div className="absolute top-32 left-8 text-cyan-400/35 font-mono text-xs animate-pulse" style={{ animationDelay: '2s' }}>
          <div>TRACK: 01</div>
          <div>WEATHER: CLEAR</div>
        </div>
        <div className="absolute bottom-32 right-8 text-cyan-400/30 font-mono text-xs animate-pulse" style={{ animationDelay: '3s' }}>
          <div>SESSION: {gameCode}</div>
          <div>PLAYERS: {answeredIds.length + 1}</div>
        </div>
      </div>
      
      {/* Premium difficulty selection card */}
      <div className="relative w-full max-w-4xl bg-slate-800/60 backdrop-blur-xl rounded-3xl p-10 shadow-4xl border-2 border-cyan-400/40">
        {/* Inner glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/15 via-transparent to-blue-500/15 rounded-3xl opacity-60" />
        
        <div className="relative">
          <div className="text-center mb-8">
            <h1 className="game-font text-4xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
              Choose Difficulty
            </h1>
            <p className="text-slate-400 mt-2">
              Select your challenge level
            </p>
            {disableTimerForTesting && (
              <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50">
                <span className="text-emerald-400 text-sm font-medium">Timer disabled for testing ∞</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
    </div>
  );
}

export default Difficulty;
