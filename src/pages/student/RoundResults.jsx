import { useCallback, useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { calculateLeaderboard } from "../../utils/leaderboard";

function getTextValue(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "";
}

function getStudentName(student, index) {
  if (!student) {
    return `Student ${index + 1}`;
  }
  if (typeof student === "string") {
    return student;
  }
  if (typeof student !== "object") {
    return `Student ${index + 1}`;
  }
  const candidates = [
    student.student_name,
    student.name,
    student.full_name,
    student.nickname,
    student.display_name,
  ];
  for (const candidate of candidates) {
    const text = getTextValue(candidate);
    if (text) return text;
  }
  return `Student ${index + 1}`;
}

function isFinalSessionStatus(session) {
  return session?.status === "finished" || session?.current_phase === "final_results";
}

function getOptionLetter(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3) {
    return String.fromCharCode(65 + value);
  }

  const text = String(value).trim();
  if (/^[0-3]$/.test(text)) {
    return String.fromCharCode(65 + Number(text));
  }

  const namedOptionMatch = text.match(/^option[\s_-]*([A-D])$/i);
  if (namedOptionMatch) {
    return namedOptionMatch[1].toUpperCase();
  }

  const letterMatch = text.match(/^[A-D](?=$|[\s.):_-])/i);
  return letterMatch ? letterMatch[0].toUpperCase() : "";
}

function getQuestionOptions(question) {
  if (!question) {
    return [];
  }

  if (Array.isArray(question.options)) {
    return question.options;
  }

  if (Array.isArray(question.answers)) {
    return question.answers;
  }

  return [question.option_a, question.option_b, question.option_c, question.option_d];
}

function getCorrectOptionLetter(question) {
  if (!question) {
    return "";
  }

  const correctValue =
    question.correct_answer ??
    question.correctAnswer ??
    question.answer ??
    question.correct_option ??
    question.correctOption;
  const directLetter = getOptionLetter(correctValue);
  if (directLetter) {
    return directLetter;
  }

  const correctText = String(correctValue ?? "").trim();
  if (!correctText) {
    return "";
  }

  const optionIndex = getQuestionOptions(question).findIndex(
    (option) => String(option ?? "").trim() === correctText
  );

  return optionIndex >= 0 && optionIndex <= 3 ? getOptionLetter(optionIndex) : "";
}

function RoundResults() {
  const navigate = useNavigate();
  const { state } = useLocation();
  
  const studentName = state?.studentName ?? "";
  const gameCode = state?.gameCode ?? "";
  const sessionId = state?.sessionId ?? "";
  const currentRound = state?.currentRound ?? 1;
  const savedSessionRaw = gameCode ? localStorage.getItem(`quizplay_session_${gameCode}`) : null;
  const savedSession = savedSessionRaw ? JSON.parse(savedSessionRaw) : null;
  const playerId =
    state?.playerId ||
    state?.sessionPlayerId ||
    savedSession?.playerId ||
    savedSession?.sessionPlayerId ||
    studentName;
  
  // Get result data from navigation state (Phase 1)
  const pointsAwarded = state?.pointsAwarded ?? 0;
  const isCorrect = state?.isCorrect ?? false;
  const selectedAnswer = state?.selectedAnswer ?? null;
  const currentDifficulty = state?.currentDifficulty ?? "";
  const currentQuestion = state?.currentQuestion ?? null;
  const questionCount = state?.questionCount ?? 1;
  const selectedOptionLetter = getOptionLetter(selectedAnswer);
  const correctOptionLetter = getCorrectOptionLetter(currentQuestion);
  
  const [sessionData, setSessionData] = useState(null);
  const [roundResults, setRoundResults] = useState([]);
  const [myResult, setMyResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [targetTime, setTargetTime] = useState(null);
  const countdownStartedRef = useRef(false);
  const countdownNavigationDoneRef = useRef(false);
  const previousRoundRef = useRef(currentRound);
  const finalNavigationDoneRef = useRef(false);

  const goToFinalResults = useCallback((session) => {
    if (finalNavigationDoneRef.current) return;
    finalNavigationDoneRef.current = true;

    navigate("/student/final-results", {
      state: {
        studentName,
        playerId,
        sessionPlayerId: playerId,
        gameCode: session?.game_code || gameCode,
        sessionId: session?.id || sessionId,
      },
      replace: true,
    });
  }, [gameCode, navigate, sessionId, studentName, playerId]);

  const markSessionFinished = useCallback(async () => {
    const targetSessionId = sessionData?.id || sessionId;
    if (!targetSessionId || finalNavigationDoneRef.current) return;

    try {
      const { data, error } = await supabase
        .from("sessions")
        .update({
          status: "finished",
          quiz_finished_at: new Date().toISOString(),
        })
        .eq("id", targetSessionId)
        .select("*")
        .single();

      if (error) throw error;
      setSessionData(data);
      goToFinalResults(data);
    } catch (err) {
      console.error("Error marking session finished:", err);
    }
  }, [goToFinalResults, sessionData?.id, sessionId]);

  useEffect(() => {
    if (!gameCode && !sessionId) return undefined;

    let isMounted = true;

    async function loadAndWatchSession() {
      const query = supabase.from("sessions").select("*");
      const { data: session, error } = sessionId
        ? await query.eq("id", sessionId).maybeSingle()
        : await query.eq("game_code", gameCode).maybeSingle();

      if (!isMounted) return;
      if (error) {
        console.error("Error loading shared session status:", error);
        return;
      }

      if (session) {
        setSessionData(session);
        if (isFinalSessionStatus(session)) goToFinalResults(session);
      }
    }

    loadAndWatchSession();

    const channelName = sessionId
      ? `round-results-session-${sessionId}`
      : `round-results-game-${gameCode}`;
    const filter = sessionId ? `id=eq.${sessionId}` : `game_code=eq.${gameCode}`;

    const subscription = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sessions",
          filter,
        },
        (payload) => {
          const updatedSession = payload.new;
          if (!updatedSession) return;
          setSessionData((prev) => ({ ...prev, ...updatedSession }));
          if (isFinalSessionStatus(updatedSession)) {
            goToFinalResults(updatedSession);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(subscription);
    };
  }, [gameCode, goToFinalResults, sessionId]);

  // Mark when current student reaches RoundResults
  useEffect(() => {
    if (!gameCode || !studentName || !sessionId || !currentRound) return;

    const markStudentSeen = async () => {
      try {
        // Update existing response with round_results_seen_at
        const updateQuery = supabase
          .from("responses")
          .update({
            round_results_seen_at: new Date().toISOString()
          })
          .eq("session_id", sessionId)
          .eq("round_number", Number(currentRound))
          .in("player_id", [playerId, studentName].filter(Boolean));

        // Add question_id filter if available
        if (state?.currentQuestionId) {
          updateQuery.eq("question_id", String(state.currentQuestionId));
        }

        const { data, error } = await updateQuery
          .select("id, session_id, player_id, round_number, question_id, round_results_seen_at");

        if (error) {
          console.error("[RoundResultsSeenMark] Failed to mark student seen:", error);
        } else if (!data || data.length === 0) {
          console.warn("[RoundResultsSeenMark] No response row found to update", {
            playerId,
            currentRound,
            currentQuestionId: state?.currentQuestionId
          });
        } else {
          console.log("[RoundResultsSeenMark]", {
            playerId,
            currentRound,
            currentQuestionId: state?.currentQuestionId,
            markedAt: new Date().toISOString(),
            updatedRows: data.length
          });
        }
      } catch (err) {
        console.error("[RoundResultsSeenMark] Exception:", err);
      }
    };

    markStudentSeen();
  }, [gameCode, studentName, playerId, sessionId, currentRound, state?.currentQuestionId]);

  // Polling logic for all-students sync target time only
  useEffect(() => {
    if (!gameCode || !studentName || !sessionId || !currentRound) return;

    const pollInterval = setInterval(async () => {
      try {
        // Load all students in session
        const { data: players, error: playersError } = await supabase
          .from("session_players")
          .select("*")
          .eq("session_id", sessionId);

        if (playersError) throw playersError;

        // Load responses for current round
        const { data: responses, error: responsesError } = await supabase
          .from("responses")
          .select("*")
          .eq("session_id", sessionId)
          .eq("round_number", Number(currentRound));

        if (responsesError) throw responsesError;

        // Calculate target time when all students are seen
        const seenResponses = responses.filter(r => r.round_results_seen_at !== null);
        const seenPlayers = new Set();
        players.forEach((player) => {
          const playerKeys = [player.id, player.student_name].filter(Boolean).map(String);
          if (seenResponses.some((response) => playerKeys.includes(String(response.player_id)))) {
            seenPlayers.add(String(player.id));
          }
        });
        
        let latestSeenTime = null;
        if (seenResponses.length > 0) {
          latestSeenTime = seenResponses.reduce((latest, r) => {
            const t = new Date(r.round_results_seen_at).getTime();
            return Math.max(latest, t);
          }, 0);
        }

        if (players.length > 0 && seenPlayers.size >= players.length && latestSeenTime) {
          const nextTargetTime = latestSeenTime + 8000; // 8 seconds in milliseconds
          setTargetTime(nextTargetTime);
        }

      } catch (err) {
        console.error("Error polling round results:", err);
      }
    }, 1000); // Poll every 1 second

    return () => clearInterval(pollInterval);
  }, [
    gameCode,
    studentName,
    sessionId,
    currentRound,
    state?.currentQuestionId,
    targetTime,
    sessionData,
    questionCount,
  ]);

  // Update countdown based on target time
  useEffect(() => {
    if (!targetTime) return;
    
    const updateInterval = setInterval(() => {
      const now = new Date().getTime();
      const remaining = Math.max(0, Math.ceil((targetTime - now) / 1000));
      setCountdown(remaining);
      
      if (now >= targetTime) {
        clearInterval(updateInterval);
      }
    }, 100);

    return () => clearInterval(updateInterval);
  }, [targetTime]);

  // Navigation after target time reached
  useEffect(() => {
    if (targetTime && new Date().getTime() >= targetTime && !countdownNavigationDoneRef.current) {
      countdownNavigationDoneRef.current = true;
      
      const maxRounds = Number(sessionData?.question_count || questionCount || 1);
      if (Number(currentRound) >= maxRounds) {
        markSessionFinished();
      } else {
        const sentTimePerQuestion = Number(state?.timePerQuestion) ||
                                   Number(state?.time_per_question) ||
                                   Number(sessionData?.time_per_question) ||
                                   10;
        
        navigate("/student/difficulty", {
          state: {
            studentName,
            playerId,
            sessionPlayerId: playerId,
            gameCode,
            sessionId,
            currentRound: Number(currentRound) + 1,
            questionCount,
            questionsByDifficulty: state?.questionsByDifficulty,
            timePerQuestion: sentTimePerQuestion
          }
        });
      }
    }
  }, [
    countdown,
    currentRound,
    questionCount,
    navigate,
    studentName,
    playerId,
    gameCode,
    sessionId,
    state,
    targetTime,
    markSessionFinished,
    sessionData?.question_count,
    sessionData?.time_per_question,
  ]);

  // Reset refs when currentRound changes
  useEffect(() => {
    if (previousRoundRef.current !== currentRound) {
      countdownStartedRef.current = false;
      countdownNavigationDoneRef.current = false;
      setCountdown(0);
      previousRoundRef.current = currentRound;
    }
  }, [currentRound]);

  useEffect(() => {
    if (!gameCode || !studentName) {
      navigate("/student/join");
      return;
    }

    async function loadData() {
      try {
        // Load session data
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("game_code", gameCode)
          .single();

        if (sessionError) throw sessionError;
        setSessionData(session);

        if (isFinalSessionStatus(session)) {
          goToFinalResults(session);
          return;
        }

        // Load current round responses for ranking
        const { data: responses, error: responsesError } = await supabase
          .from("responses")
          .select("*")
          .eq("session_id", session.id)
          .eq("round_number", currentRound);

        if (responsesError) throw responsesError;

        // Load students for names
        const { data: players, error: playersError } = await supabase
          .from("session_players")
          .select("*")
          .eq("session_id", session.id);

        if (playersError) throw playersError;

        // Create student name mapping
        const studentMap = {};
        players.forEach(player => {
          studentMap[player.id] = getStudentName(player, 0);
          studentMap[player.student_name] = getStudentName(player, 0);
        });

        // Process results with names and rankings
        const processedResults = responses.map(response => ({
          ...response,
          studentName: studentMap[response.player_id] || response.player_id
        })).sort((a, b) => b.points_awarded - a.points_awarded);

        setRoundResults(processedResults);

        // Find my result
        const myResponse = processedResults.find(r => 
          r.player_id === playerId ||
          r.player_id === studentName || 
          r.studentName === studentName
        );
        setMyResult(myResponse);

      } catch (err) {
        console.error("Error loading round results:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [gameCode, studentName, playerId, sessionId, currentRound, navigate, goToFinalResults]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-xl font-semibold">Loading results...</div>
      </div>
    );
  }

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
      
      {/* Main Content */}
      <div className="relative min-h-screen flex items-start justify-center px-6 py-4 z-30">
        <div className="w-full max-w-5xl bg-slate-800/70 backdrop-blur-xl rounded-3xl shadow-3xl border-2 border-slate-600/50 p-6">
        {/* Premium Header */}
          <div className="text-center mb-6">
            <h1 className="game-font text-5xl md:text-6xl font-bold relative mb-3">
              {/* Strong neon glow background */}
              <span className="absolute inset-0 blur-3xl bg-gradient-to-r from-cyan-400/60 via-pink-400/50 to-cyan-400/60 animate-pulse" style={{ animationDuration: '3s' }} />
              <span className="absolute inset-0 blur-xl bg-gradient-to-r from-cyan-400/40 via-pink-400/30 to-cyan-400/40 animate-pulse" style={{ animationDelay: '1.5s', animationDuration: '3s' }} />
              <span className="relative bg-gradient-to-r from-cyan-300 via-pink-200 to-cyan-300 bg-clip-text text-transparent drop-shadow-lg">
                Question Results
              </span>
            </h1>
            <div className="flex items-center justify-center gap-6 text-slate-300 text-lg">
              <span className="text-cyan-200 font-semibold">Question {currentRound}</span>
              <span className="text-pink-300">•</span>
              <span className="text-cyan-200">Game Code: {gameCode}</span>
            </div>
            {targetTime && countdown > 0 && (
              <div className="mt-4 inline-block bg-slate-900/80 border border-emerald-400/40 rounded-full px-6 py-2">
                <span className="text-emerald-400 font-bold text-lg animate-pulse">
                  Next round in {countdown}s...
                </span>
              </div>
            )}
          </div>

        {/* Main Result Card with Glassmorphism */}
          <div className="mb-6 relative bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-xl border-2 border-cyan-400/60 rounded-3xl p-6 text-center shadow-2xl overflow-hidden">
            {/* Multicolor edge glow effect */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-400/20 via-blue-400/20 to-pink-400/20 animate-pulse" style={{ animationDuration: '4s' }} />
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-amber-400/15 via-transparent to-transparent animate-pulse" style={{ animationDelay: '2s', animationDuration: '4s' }} />
            <div className="absolute inset-0 rounded-3xl border-2 border-transparent bg-gradient-to-r from-cyan-400/30 via-blue-400/30 via-amber-400/30 to-pink-400/30 animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-transparent via-white/5 to-transparent" />
            
            {/* Result content */}
            <div className="relative z-10">
              {/* Correct/Wrong Icon */}
              <div className="flex items-center justify-center mb-4">
                <div className={`relative w-20 h-20 rounded-full flex items-center justify-center font-bold text-3xl shadow-2xl ${
                  isCorrect 
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-400/50' 
                    : 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-400/50'
                }`}>
                  {/* Glow effect */}
                  <div className={`absolute inset-0 rounded-full animate-ping ${
                    isCorrect ? 'bg-emerald-400/40' : 'bg-red-400/40'
                  }`} style={{ animationDelay: '1s' }} />
                  <span className="relative z-10">{isCorrect ? '✓' : '✗'}</span>
                </div>
              </div>
              
              <h2 className="text-3xl font-bold mb-4 text-white">Your Result</h2>
              
              {/* Points and Difficulty */}
              <div className="flex items-center justify-center gap-8 mb-6">
                <div className="text-center">
                  <p className="text-4xl font-bold text-cyan-300">{pointsAwarded}</p>
                  <p className="text-cyan-100 text-sm mt-1">Points earned</p>
                </div>
                <div className="w-px h-16 bg-gradient-to-b from-transparent via-cyan-400 to-transparent"></div>
                <div className="text-center">
                  <p className="text-3xl font-bold capitalize text-pink-300">{currentDifficulty}</p>
                  <p className="text-pink-100 text-sm mt-1">Difficulty</p>
                </div>
              </div>
              
              {/* Question Details */}
              {currentQuestion && (
                <div className="text-left bg-slate-900/60 backdrop-blur-md rounded-2xl p-6 border border-cyan-400/30">
                  <p className="text-lg font-semibold mb-3 text-cyan-200">Question:</p>
                  <p className="text-white mb-4 leading-relaxed">{currentQuestion.question_text || currentQuestion.questionText}</p>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="font-semibold text-cyan-200 mb-2">Your Answer:</p>
                      <p className="text-white text-lg font-medium">
                        {selectedOptionLetter || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-200 mb-2">Correct Answer:</p>
                      <p className="text-white text-lg font-medium">
                        {correctOptionLetter || "Correct answer is not available"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        {/* Top Performers Section */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-center mb-4 relative">
              <span className="bg-gradient-to-r from-cyan-300 to-pink-300 bg-clip-text text-transparent">Top Performers</span>
            </h2>
            <div className="space-y-2">
              {roundResults.slice(0, 5).map((result, index) => (
                <div 
                  key={result.id}
                  className={`relative flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 backdrop-blur-md overflow-hidden ${
                    result.player_id === myResult?.player_id
                    ? "border-cyan-400/60 bg-cyan-900/40 shadow-cyan-400/30"
                    : "border-slate-600/50 bg-slate-700/40 hover:border-slate-500/50"
                  }`}
                >
                  {/* Subtle glow effect for current user */}
                  {result.player_id === myResult?.player_id && (
                    <div className="absolute inset-0 bg-cyan-400/10 rounded-2xl animate-pulse" style={{ animationDuration: '2s' }} />
                  )}
                  
                  <div className="flex items-center gap-4 relative z-10">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                      index === 0 ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-400/50' :
                      index === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500 text-white shadow-slate-400/50' :
                      index === 2 ? 'bg-gradient-to-br from-orange-600 to-orange-700 text-white shadow-orange-400/50' :
                      'bg-gradient-to-br from-slate-600 to-slate-700 text-white'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className={`font-semibold text-lg ${
                        result.player_id === myResult?.player_id ? "text-cyan-300" : "text-white"
                      }`}>
                        {result.studentName}
                        {result.player_id === myResult?.player_id && (
                          <span className="text-cyan-400 ml-2">(You)</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold text-lg relative z-10 ${
                    result.player_id === myResult?.player_id ? "text-cyan-300" : "text-pink-300"
                  }`}>
                    {result.points_awarded} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default RoundResults;
