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
    { 
      label: "Easy", 
      diff: "easy", 
      points: 100, 
      badge: "bg-gradient-to-r from-emerald-400 to-cyan-400",
      borderColor: "border-emerald-400/60 hover:border-emerald-400/90",
      glowColor: "hover:shadow-emerald-400/40",
      theme: "from-emerald-400/30 to-cyan-400/30",
      buttonBg: "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400"
    },
    { 
      label: "Medium", 
      diff: "medium", 
      points: 200, 
      badge: "bg-gradient-to-r from-amber-400 to-yellow-400",
      borderColor: "border-amber-400/60 hover:border-amber-400/90",
      glowColor: "hover:shadow-amber-400/40",
      theme: "from-amber-400/30 to-yellow-400/30",
      buttonBg: "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400"
    },
    { 
      label: "Hard", 
      diff: "hard", 
      points: 300, 
      badge: "bg-gradient-to-r from-red-400 to-pink-400",
      borderColor: "border-red-400/60 hover:border-red-400/90",
      glowColor: "hover:shadow-red-400/40",
      theme: "from-red-400/30 to-pink-400/30",
      buttonBg: "bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400"
    },
  ];

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
        
        {/* More lightning bolts */}
        <div className="absolute top-12 left-8 w-1.5 h-1.5 text-cyan-300/25 animate-pulse" style={{ animationDelay: '2.5s', animationDuration: '2.5s' }}>
          <span className="text-base">⚡</span>
        </div>
        <div className="absolute top-52 left-8 w-1 h-1 text-cyan-300/20 animate-pulse" style={{ animationDelay: '4.8s', animationDuration: '2.5s' }}>
          <span className="text-sm">⚡</span>
        </div>
        <div className="absolute top-12 right-8 w-1.5 h-1.5 text-cyan-300/25 animate-pulse" style={{ animationDelay: '1.2s', animationDuration: '2.5s' }}>
          <span className="text-base">⚡</span>
        </div>
        <div className="absolute top-52 right-8 w-1 h-1 text-cyan-300/20 animate-pulse" style={{ animationDelay: '3.6s', animationDuration: '2.5s' }}>
          <span className="text-sm">⚡</span>
        </div>
        
        {/* Flag icons */}
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
      </div>
      
      {/* Radial overlay for depth */}
      <div className="fixed inset-0 bg-gradient-radial from-transparent via-slate-900/20 to-slate-900/40 pointer-events-none z-20" style={{ background: 'radial-gradient(circle at center, transparent 0%, rgba(15, 23, 42, 0.2) 50%, rgba(15, 23, 42, 0.4) 100%)' }} />
      
      {/* Main Content */}
      <div className="relative min-h-screen flex items-center justify-center px-6 z-30">
        <div className="w-full max-w-5xl bg-slate-800/70 backdrop-blur-xl rounded-3xl shadow-3xl border-2 border-slate-600/50 p-8">
          {/* Enhanced Header with Timer */}
          <div className="flex flex-col items-center justify-center gap-4 md:gap-8 mb-6 md:mb-12">
            {/* Timer Card - Centered Above */}
            <div className="relative bg-slate-900/65 backdrop-blur-2xl border-2 border-cyan-400/55 rounded-2xl px-4 py-3 md:px-8 md:py-5 hover:border-cyan-400/75 transition-all duration-300 shadow-cyan-400/25 shadow-2xl">
              {/* Enhanced glow effect */}
              <div className="absolute inset-0 bg-cyan-400/22 rounded-3xl animate-pulse" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/18 to-transparent rounded-3xl" />
              <div className="absolute inset-0 bg-gradient-radial from-cyan-400/6 via-transparent to-transparent" style={{ background: 'radial-gradient(circle at center, rgba(6, 182, 212, 0.06) 0%, transparent 60%)' }} />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/3 to-transparent opacity-20" />
              <p className="text-cyan-300 text-xs font-bold tracking-wider uppercase relative z-10 mb-1 md:mb-2">Time Remaining</p>
              <p className="game-font text-2xl md:text-4xl font-bold bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-300 bg-clip-text text-transparent relative z-10 animate-pulse" style={{ animationDuration: '2s' }}>
                {timeLeft}s
              </p>
            </div>

            {/* Premium Title */}
            <h1 className="game-font text-4xl md:text-6xl font-bold relative text-center">
              {/* Strong neon glow background */}
              <span className="absolute inset-0 blur-3xl bg-gradient-to-r from-cyan-400/60 via-pink-400/50 to-cyan-400/60 animate-pulse" style={{ animationDuration: '3s' }} />
              <span className="absolute inset-0 blur-xl bg-gradient-to-r from-cyan-400/40 via-pink-400/30 to-cyan-400/40 animate-pulse" style={{ animationDelay: '1.5s', animationDuration: '3s' }} />
              <span className="relative bg-gradient-to-r from-cyan-300 via-pink-200 to-cyan-300 bg-clip-text text-transparent drop-shadow-lg">
                Choose Difficulty
              </span>
            </h1>
          </div>

          {/* Enhanced Difficulty Cards Grid with premium styling */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-10">
            {cards.map((c) => {
              const availableCount = getAvailableCount(c.diff);
              const isExhausted = availableCount === 0;

              return (
                <div
                  key={c.diff}
                  className={`relative border-2 ${c.borderColor} rounded-2xl p-6 md:p-12 transition-all duration-500 transform hover:scale-105 hover:shadow-3xl ${c.glowColor} ${
                    isExhausted
                      ? 'bg-slate-900/50 border-slate-600/40 opacity-50 cursor-not-allowed backdrop-blur-md'
                      : 'bg-slate-900/25 border-slate-600/35 backdrop-blur-md hover:bg-slate-900/35 hover:shadow-4xl'
                  }`}
                >
                  {/* Enhanced glow effect */}
                  {!isExhausted && (
                    <>
                      <div className={`absolute inset-0 bg-gradient-to-br ${c.theme} opacity-22 rounded-3xl animate-pulse`} style={{ animationDuration: '3s' }} />
                      <div className="absolute inset-0 bg-gradient-radial from-white/6 via-transparent to-transparent rounded-3xl" style={{ background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.06) 0%, transparent 60%)' }} />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/2 to-transparent opacity-25" />
                    </>
                  )}

                  {/* Enhanced points badge */}
                  {!isExhausted && (
                    <div className={`absolute -top-5 md:-top-7 left-1/2 -translate-x-1/2 ${c.badge} text-slate-900 font-bold rounded-full px-4 py-2 md:px-7 md:py-4 shadow-3xl text-lg md:text-xl border-2 border-white/45 backdrop-blur-sm`}>
                      +{c.points} pts
                    </div>
                  )}

                  {/* Enhanced difficulty title */}
                  <div className="relative z-10">
                    <h2 className={`game-font text-4xl md:text-7xl font-bold bg-gradient-to-r ${c.theme} bg-clip-text text-transparent mt-8 md:mt-20 mb-6 md:mb-10 drop-shadow-lg`}>
                      {c.label}
                    </h2>

                    {/* Removed available count text as requested */}
                    
                    {/* Enhanced select button */}
                    <button
                      onClick={() => handleDifficultySelect(c.diff, c.points)}
                      disabled={isExhausted}
                      className={`relative w-full game-font py-4 md:py-6 rounded-2xl transition-all duration-500 transform hover:scale-105 shadow-2xl overflow-hidden group text-lg md:text-xl font-bold ${
                        isExhausted
                          ? 'bg-slate-700/50 text-slate-400 cursor-not-allowed border border-slate-600/50'
                          : `${c.buttonBg} text-slate-900 hover:shadow-3xl border-2 border-white/35 hover:border-white/55 hover:shadow-lg`
                      }`}
                    >
                      {/* Enhanced hover shine effect */}
                      {!isExhausted && (
                        <>
                          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/45 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                          <span className="absolute inset-0 bg-gradient-to-t from-transparent to-white/12 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <span className="absolute inset-0 bg-gradient-to-br from-white/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        </>
                      )}
                      <span className="relative z-10 tracking-wide">
                        {isExhausted ? "Exhausted" : "Select"}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

export default Difficulty;
