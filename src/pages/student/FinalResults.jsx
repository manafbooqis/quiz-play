import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { calculateLeaderboard } from "../../utils/leaderboard";

// Shows the student's final score, rank, and answer summary.
function FinalResults() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const studentName = state?.studentName ?? "";
  const initialGameCode = state?.gameCode ?? "";
  const sessionId = state?.sessionId ?? "";
  const savedSessionRaw = initialGameCode ? localStorage.getItem(`quizplay_session_${initialGameCode}`) : null;
  const savedSession = savedSessionRaw ? JSON.parse(savedSessionRaw) : null;
  const playerId =
    state?.playerId ||
    state?.sessionPlayerId ||
    savedSession?.playerId ||
    savedSession?.sessionPlayerId ||
    "";

  const [gameCode, setGameCode] = useState(initialGameCode);
  const [players, setPlayers] = useState([]);
  const [responses, setResponses] = useState([]);
  const [sessionQuestionCount, setSessionQuestionCount] = useState(0);
  const [sessionScoringConfig, setSessionScoringConfig] = useState({});
  const [loading, setLoading] = useState(true);

  // Loads final players, responses, and scoring config for the completed quiz.
  useEffect(() => {
    if (!sessionId && !initialGameCode) {
      setLoading(false);
      return;
    }

    // Resolves the session and fetches data needed to build the final leaderboard.
    async function loadResults() {
      try {
        let resolvedSessionId = "";
        let resolvedQuestionCount = 0;

        if (initialGameCode) {
          const { data: sessionRow } = await supabase
            .from("sessions")
            .select("*")
            .eq("game_code", initialGameCode)
            .maybeSingle();

          resolvedSessionId = sessionRow?.id ?? "";
          resolvedQuestionCount = Number(sessionRow?.question_count) || 0;
          setSessionScoringConfig(sessionRow || {});
          setGameCode(initialGameCode);
        }

        if (!resolvedSessionId && sessionId) {
          const { data: sessionRow } = await supabase
            .from("sessions")
            .select("*")
            .eq("id", sessionId)
            .maybeSingle();

          resolvedSessionId = sessionRow?.id ?? "";
          resolvedQuestionCount = Number(sessionRow?.question_count) || 0;
          setSessionScoringConfig(sessionRow || {});
          setGameCode(sessionRow?.game_code || "");
        }

        if (!resolvedSessionId) {
          setLoading(false);
          return;
        }

        // Fetch real players
        const { data: playersData } = await supabase
          .from("session_players")
          .select("*")
          .eq("session_id", resolvedSessionId);

        // Fetch real responses
        const { data: responsesData } = await supabase
          .from("responses")
          .select("*")
          .eq("session_id", resolvedSessionId);

        setPlayers(playersData ?? []);
        setResponses(responsesData ?? []);
        setSessionQuestionCount(resolvedQuestionCount);
      } catch (err) {
        console.error("Error loading final results:", err);
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, [sessionId, initialGameCode]);

  if (!sessionId && !gameCode) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
        <button
          onClick={() => navigate("/student/join")}
          className="game-font bg-cyan-500 hover:bg-cyan-400 text-slate-900 py-3 px-6 rounded-xl transition"
        >
          Go to Join Page
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-xl font-semibold text-slate-300">Loading results...</p>
      </div>
    );
  }

  const leaderboard = calculateLeaderboard(
    players,
    responses,
    sessionQuestionCount,
    sessionScoringConfig
  );

  // This student's data
  const myData = (
    (playerId ? leaderboard.find((player) => player.id === playerId) : null) ||
    leaderboard.find((player) => player.name === studentName)
  ) || {
    score: 0,
    correct: 0,
    total: sessionQuestionCount,
    accuracy: 0,
    rank: 0,
  };
  const totalPoints = myData.score;
  const correctCount = myData.correct;
  const totalAnswered = myData.total;

  const rank = myData.rank;

  // Build answersStatus from real responses for this student
  const directMyResponses = playerId
    ? responses.filter((r) => r.player_id === playerId)
    : [];
  const myResponses = (directMyResponses.length > 0
    ? directMyResponses
    : responses.filter((r) => r.player_id === studentName))
    .sort((a, b) => {
      // Sort by answered_at first, then by created_at as fallback
      const aTime = new Date(a.answered_at || a.created_at).getTime();
      const bTime = new Date(b.answered_at || b.created_at).getTime();
      return aTime - bTime;
    });
  const answersStatus = myResponses.map((r) => r.is_correct);

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
        <div className="absolute top-32 right-16 w-2 h-2 bg-pink-400/20 rounded-full animate-ping border border-pink-400/30" style={{ animationDelay: '1s' }} />
        <div className="absolute top-48 left-1/4 w-2.5 h-2.5 bg-yellow-300/15 rounded-full animate-ping border border-yellow-300/25" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-32 right-1/3 w-3 h-3 bg-cyan-400/20 rounded-full animate-ping border border-cyan-400/35" style={{ animationDelay: '1.5s' }} />
        <div className="absolute bottom-48 left-20 w-2 h-2 bg-cyan-400/15 rounded-full animate-pulse border border-cyan-400/25" style={{ animationDelay: '0.8s' }}>
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
        
        {/* Trophy decorations */}
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
        
        {/* Sparkles */}
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
        <div className="absolute bottom-4 right-24 w-1 h-1 text-cyan-300/15 animate-pulse" style={{ animationDelay: '4.5s', animationDuration: '2s' }}>
          <span className="text-sm">✨</span>
        </div>
      </div>
      
      {/* Radial overlay for depth */}
      <div className="fixed inset-0 bg-gradient-radial from-transparent via-slate-900/20 to-slate-900/40 pointer-events-none z-20" style={{ background: 'radial-gradient(circle at center, transparent 0%, rgba(15, 23, 42, 0.2) 50%, rgba(15, 23, 42, 0.4) 100%)' }} />
      
      {/* Main Content */}
      <div className="relative min-h-screen flex items-center justify-center px-4 py-6 z-30">
        <div className="w-full max-w-7xl bg-slate-800/70 backdrop-blur-xl rounded-3xl shadow-3xl border-2 border-slate-600/50 p-6">
          {/* Premium Header with Enhanced Title */}
          <div className="text-center mb-6">
            <h1 className="game-font text-5xl md:text-6xl font-bold relative text-center mb-3">
              {/* Strong neon glow background */}
              <span className="absolute inset-0 blur-3xl bg-gradient-to-r from-cyan-400/60 via-pink-400/50 to-cyan-400/60 animate-pulse" style={{ animationDuration: '3s' }} />
              <span className="absolute inset-0 blur-xl bg-gradient-to-r from-cyan-400/40 via-pink-400/30 to-cyan-400/40 animate-pulse" style={{ animationDelay: '1.5s', animationDuration: '3s' }} />
              <span className="relative bg-gradient-to-r from-cyan-300 via-pink-200 to-cyan-300 bg-clip-text text-transparent drop-shadow-lg">
                Final Results
              </span>
            </h1>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Results Section - spans 8 columns */}
            <div className="lg:col-span-8">
              <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-4xl border-2 border-cyan-400/50 p-6 overflow-hidden">
                {/* Multicolor edge glow effect */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-400/20 via-blue-400/20 to-pink-400/20 animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-amber-400/15 via-transparent to-transparent animate-pulse" style={{ animationDelay: '2s', animationDuration: '4s' }} />
                <div className="absolute inset-0 rounded-3xl border-2 border-transparent bg-gradient-to-r from-cyan-400/30 via-blue-400/30 via-amber-400/30 to-pink-400/30 animate-pulse" style={{ animationDuration: '3s' }} />
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-transparent via-white/5 to-transparent" />
                
                <div className="relative z-10">
                  {/* Player Name and Score Header */}
                  <div className="text-center mb-6">
                    <h2 className="game-font text-3xl md:text-4xl font-bold text-white mb-2">
                      {studentName || "Final Results"}
                    </h2>
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-emerald-400/20 rounded-xl animate-pulse" style={{ animationDuration: '2s' }} />
                      <div className="relative bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-8 py-4 rounded-xl shadow-lg">
                        <p className="text-lg font-semibold mb-1">Total Score</p>
                        <p className="text-4xl md:text-5xl font-bold">{totalPoints}</p>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Stats Layout */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {/* Correct Answers Badge */}
                    <div className="relative bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-emerald-400/30">
                      <div className="absolute inset-0 bg-emerald-400/10 rounded-2xl animate-pulse" style={{ animationDuration: '3s' }} />
                      <div className="relative z-10 text-center">
                        <p className="text-emerald-200 font-semibold mb-2">Correct Answers</p>
                        <p className="text-2xl md:text-3xl font-bold text-emerald-300">{correctCount}</p>
                      </div>
                    </div>

                    {/* Total Questions Badge */}
                    <div className="relative bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-pink-400/30">
                      <div className="absolute inset-0 bg-pink-400/10 rounded-2xl animate-pulse" style={{ animationDelay: '3s' }} />
                      <div className="relative z-10 text-center">
                        <p className="text-pink-200 font-semibold mb-2">Total Questions</p>
                        <p className="text-2xl md:text-3xl font-bold text-pink-300">{totalAnswered}</p>
                      </div>
                    </div>

                    {/* Final Rank Badge */}
                    <div className="relative bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-cyan-400/30">
                      <div className="absolute inset-0 bg-cyan-400/10 rounded-2xl animate-pulse" style={{ animationDelay: '3s' }} />
                      <div className="relative z-10 text-center">
                        <p className="text-cyan-200 font-semibold mb-2">Final Rank</p>
                        <p className="text-2xl md:text-3xl font-bold text-cyan-300">
                          {rank > 0 ? `#${rank}` : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Accuracy Badge */}
                    <div className="relative bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-amber-400/30">
                      <div className="absolute inset-0 bg-amber-400/10 rounded-2xl animate-pulse" style={{ animationDelay: '3s' }} />
                      <div className="relative z-10 text-center">
                        <p className="text-amber-200 font-semibold mb-2">Accuracy</p>
                        <p className="text-2xl md:text-3xl font-bold text-amber-300">
                          {myData.accuracy}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Question Summary Section */}
                  <div className="relative bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-purple-400/30">
                    <div className="absolute inset-0 bg-purple-400/10 rounded-2xl animate-pulse" style={{ animationDuration: '3s' }} />
                    <div className="relative z-10">
                      <h3 className="text-purple-200 font-semibold mb-3 text-center">Question Summary</h3>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {Array.from({ length: Math.max(answersStatus.length, totalAnswered || 0) }).map((_, i) => {
                          const ok = answersStatus[i] === true;
                          const wrong = answersStatus[i] === false;

                          return (
                            <div
                              key={i}
                              className={[
                                "relative w-10 h-10 flex items-center justify-center rounded-lg shadow transition-all duration-300",
                                ok 
                                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600 border-2 border-emerald-300/50" 
                                  : wrong 
                                  ? "bg-gradient-to-br from-red-400/80 to-red-500/80 border-2 border-red-300/40" 
                                  : "bg-gradient-to-br from-slate-600 to-slate-700 border-2 border-slate-400/30",
                              ].join(" ")}
                            >
                              <span className="game-font text-white text-sm font-bold">{i + 1}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => navigate("/student/join")}
                    className="relative w-full bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-slate-900 py-3 px-6 rounded-xl font-bold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 border-2 border-yellow-300/50"
                  >
                    <div className="absolute inset-0 bg-yellow-400/20 rounded-xl animate-pulse" style={{ animationDuration: '2s' }} />
                    <span className="relative z-10">Join Another Quiz</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Leaderboard Section - spans 4 columns */}
            <div className="lg:col-span-4">
              <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl p-5 h-full border-2 border-cyan-400/30 overflow-hidden">
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-400/10 via-blue-400/10 to-cyan-400/10 animate-pulse" style={{ animationDuration: '3s' }} />
                <div className="absolute inset-0 rounded-2xl border border-cyan-400/20" />
                
                <div className="relative z-10">
                  <h2 className="game-font text-2xl mb-4 text-cyan-300 text-center">
                    Leaderboard
                  </h2>

                  {leaderboard.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center">No participants found.</p>
                  ) : (
                    <div className={["space-y-3 pr-1", leaderboard.length <= 5 ? "" : "max-h-[400px] overflow-y-auto"].join(" ")}>
                      {leaderboard.map((p, idx) => {
                        const isCurrentUser = playerId ? p.id === playerId : p.name === studentName;
                        return (
                          <div
                            key={`${p.id || p.name}-${p.rank}`}
                            className={[
                              "relative px-4 py-3 rounded-2xl flex items-center justify-between transition-all duration-300",
                              isCurrentUser 
                                ? "bg-gradient-to-r from-cyan-600/50 to-blue-600/50 border-2 border-cyan-400/60 shadow-lg shadow-cyan-400/30" 
                                : idx === 0 
                                ? "bg-gradient-to-r from-yellow-600/40 to-amber-600/40 border border-yellow-400/40 hover:from-yellow-600/50 hover:to-amber-600/50" 
                                : idx === 1 
                                ? "bg-gradient-to-r from-slate-400/40 to-slate-500/40 border border-slate-300/40 hover:from-slate-400/50 hover:to-slate-500/50" 
                                : idx === 2 
                                ? "bg-gradient-to-r from-orange-700/40 to-orange-800/40 border border-orange-400/40 hover:from-orange-700/50 hover:to-orange-800/50" 
                                : "bg-gradient-to-r from-emerald-700/30 to-emerald-800/30 border border-emerald-400/20 hover:from-emerald-700/40 hover:to-emerald-800/40",
                            ].join(" ")}
                          >
                            {/* Glow effect for current user */}
                            {isCurrentUser && (
                              <div className="absolute inset-0 bg-cyan-400/20 rounded-2xl animate-pulse" style={{ animationDuration: '2s' }} />
                            )}
                            
                            <div className="flex items-center gap-3 min-w-0 relative z-10">
                              <span className="text-lg">
                                {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🎖️"}
                              </span>
                              <span className={["game-font text-base truncate flex-1", isCurrentUser ? "text-cyan-200 font-bold" : "text-white"].join(" ")}>
                                {p.name}
                                {isCurrentUser && (
                                  <span className="ml-2 text-xs bg-cyan-400/30 px-2 py-1 rounded-full text-cyan-200">You</span>
                                )}
                              </span>
                            </div>
                            <span className={["font-semibold text-base min-w-[3rem] text-right", isCurrentUser ? "text-cyan-200" : "text-yellow-300"].join(" ")}>
                              {p.score}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default FinalResults;
