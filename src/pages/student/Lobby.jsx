import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase, getSessionPlayers } from "../../lib/supabase";

/**
 * Converts supported primitive values into display text.
 * @param {unknown} value - Candidate value from a player record.
 * @returns {string} Trimmed text or an empty string.
 */
function getTextValue(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

/**
 * Resolves a stable student display name from several supported row shapes.
 * @param {string|object} student - Player value or session player record.
 * @param {number} index - Fallback position for anonymous players.
 * @returns {string} Display name for the lobby.
 */
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

/**
 * Checks whether a session should show final results.
 * @param {object} session - Session row from Supabase.
 * @returns {boolean} True when the session is in a final state.
 */
function isFinalSessionStatus(session) {
  return session?.status === "finished" || session?.current_phase === "final_results";
}

// Shows the waiting room and reacts to instructor-driven session changes.
function Lobby() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const studentName = state?.studentName ?? "";
  const gameCode = state?.gameCode ?? "";
  const savedSessionRaw = gameCode ? localStorage.getItem(`quizplay_session_${gameCode}`) : null;
  const savedSession = savedSessionRaw ? JSON.parse(savedSessionRaw) : null;
  const playerId =
    state?.playerId ||
    state?.sessionPlayerId ||
    savedSession?.playerId ||
    savedSession?.sessionPlayerId ||
    "";
  const [, setSessionData] = useState(null);
  const [livePlayers, setLivePlayers] = useState(null);

  // Clears any existing round timer when a student returns to the lobby.
  useEffect(() => {
    if (studentName && gameCode) {
      const timerKey = `quizplay_round_timer_${gameCode}_${studentName}`;
      localStorage.removeItem(timerKey);
    }
  }, [studentName, gameCode]);

  // Watches the shared session status and moves students into the active quiz flow.
  useEffect(() => {
    if (!gameCode) return;

    // Loads the current session once before real-time updates arrive.
    async function loadSession() {
      try {
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("game_code", gameCode)
          .single();

        if (sessionError && sessionError.code !== 'PGRST116') {
          console.error("Session error:", sessionError);
          return;
        }

        if (session) {
          setSessionData(session);
          console.log("Lobby session status:", session.status);
          console.log("Lobby current question:", session.current_question_id);

          if (isFinalSessionStatus(session)) {
            navigate("/student/final-results", {
              state: {
                studentName,
                playerId,
                sessionPlayerId: playerId,
                gameCode: session.game_code || gameCode,
                sessionId: session.id,
              },
              replace: true,
            });
            return;
          }

          // If session is active or choosing_difficulty, navigate to difficulty page
          if (session.status === "active" || session.status === "choosing_difficulty") {
            const saved = localStorage.getItem(`quizplay_session_${gameCode}`);
            const savedSession = saved ? JSON.parse(saved) : null;
            const questionsByDifficulty = savedSession?.questionsByDifficulty || savedSession?.questions_by_difficulty || session.questions_by_difficulty;
            
            console.log("Navigating student to difficulty page (initial load)", session.status);
            navigate("/student/difficulty", {
              state: {
                studentName,
                playerId,
                sessionPlayerId: playerId,
                gameCode,
                sessionId: session.id,
                currentRound: session.current_round || 1,
                questionCount: session.question_count || session.questionCount,
                currentQuestionId: session.current_question_id || undefined,
                currentDifficulty: session.current_difficulty || undefined,
                questionsByDifficulty,
                timePerQuestion: session.time_per_question,
              }
            });
          }
        }
      } catch (err) {
        console.error("Error loading session:", JSON.stringify(err, null, 2));
        console.error("Message:", err.message);
        console.error("Details:", err.details);
        console.error("Hint:", err.hint);
        console.error("Code:", err.code);
      }
    }

    loadSession();

    // Setup real-time subscription
    const subscription = supabase
      .channel(`session-${gameCode}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `game_code=eq.${gameCode}`
      }, (payload) => {
        console.log("Lobby received session update:", payload);
        const updatedSession = payload.new;
        setSessionData(updatedSession);
        console.log("Lobby updated session status:", updatedSession.status);
        console.log("Lobby updated current question:", updatedSession.current_question_id);

        if (isFinalSessionStatus(updatedSession)) {
          navigate("/student/final-results", {
            state: {
              studentName,
              playerId,
              sessionPlayerId: playerId,
              gameCode: updatedSession.game_code || gameCode,
              sessionId: updatedSession.id,
            },
            replace: true,
          });
          return;
        }

        // Auto-navigate when quiz starts or moves to choosing_difficulty
        if (
          (updatedSession.status === "active" && updatedSession.current_question_id) ||
          updatedSession.status === "choosing_difficulty"
        ) {
          const saved = localStorage.getItem(`quizplay_session_${gameCode}`);
          const savedSession = saved ? JSON.parse(saved) : null;
          const questionsByDifficulty = savedSession?.questionsByDifficulty || savedSession?.questions_by_difficulty || updatedSession.questions_by_difficulty;

          console.log("Lobby navigating to difficulty page", updatedSession.status);
          
          navigate("/student/difficulty", {
            state: {
              studentName,
              playerId,
              sessionPlayerId: playerId,
              gameCode,
              sessionId: updatedSession.id,
              currentRound: updatedSession.current_round || 1,
              questionCount: updatedSession.question_count || updatedSession.questionCount,
              currentQuestionId: updatedSession.current_question_id || undefined,
              currentDifficulty: updatedSession.current_difficulty || undefined,
              questionsByDifficulty,
              timePerQuestion: updatedSession.time_per_question,
            }
          });
        }
      })
      .subscribe();

    // Fallback polling in case real-time doesn't fire
    const pollingInterval = setInterval(async () => {
      try {
        const { data: session, error: pollError } = await supabase
          .from("sessions")
          .select("*")
          .eq("game_code", gameCode)
          .single();

        if (!pollError && session) {
          console.log("Lobby polling session:", session.status);
          if (isFinalSessionStatus(session)) {
            navigate("/student/final-results", {
              state: {
                studentName,
                playerId,
                sessionPlayerId: playerId,
                gameCode: session.game_code || gameCode,
                sessionId: session.id,
              },
              replace: true,
            });
            return;
          }

          if (
            (session.status === "active" && session.current_question_id) ||
            session.status === "choosing_difficulty"
          ) {
            const saved = localStorage.getItem(`quizplay_session_${gameCode}`);
            const savedSession = saved ? JSON.parse(saved) : null;
            const questionsByDifficulty = savedSession?.questionsByDifficulty || savedSession?.questions_by_difficulty;

            console.log("Lobby polling: navigating to difficulty page", session.status);
            navigate("/student/difficulty", {
              state: {
                studentName,
                playerId,
                sessionPlayerId: playerId,
                gameCode,
                sessionId: session.id,
                currentRound: session.current_round || 1,
                questionCount: session.question_count || session.questionCount,
                currentQuestionId: session.current_question_id || undefined,
                currentDifficulty: session.current_difficulty || undefined,
                questionsByDifficulty,
                timePerQuestion: session.time_per_question,
              }
            });
          }
        }
      } catch (err) {
        console.error("Lobby polling error:", err);
      }
    }, 2000);

    return () => {
      supabase.removeChannel(subscription);
      clearInterval(pollingInterval);
    };
  }, [gameCode, studentName, playerId, navigate]);

  // Polls session players so the waiting room stays current for late joins.
  useEffect(() => {
    if (!gameCode) return;

    // Loads the first player list for the lobby roster.
    async function loadPlayers() {
      try {
        const { data: players, error } = await getSessionPlayers(gameCode);
        if (!error && players) {
          setLivePlayers(players);
        }
      } catch (err) {
        console.error("Error loading players:", err);
      }
    }

    loadPlayers();

    // Poll every 2000ms
    const playersPollingInterval = setInterval(async () => {
      try {
        const { data: players, error } = await getSessionPlayers(gameCode);
        if (!error && players) {
          setLivePlayers(players);
        }
      } catch (err) {
        console.error("Error polling players:", err);
      }
    }, 2000);

    return () => {
      clearInterval(playersPollingInterval);
    };
  }, [gameCode]);

  if (!studentName || !gameCode) {
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

  // Read instructor config (questionCount + timePerQuestion + players)
  const config = savedSession;

  const totalQuestions =
    config?.questionCount ?? config?.question_count ?? 3;
  const timePerQuestion =
    config?.timePerQuestion ?? config?.time_per_question ?? 15;

  // Converts live player rows into names for the lobby roster.
  const normalizePlayers = (playersArray) => {
    if (!Array.isArray(playersArray)) return [];
    return playersArray.map((player, index) => getStudentName(player, index));
  };

  // Use live players from database with fallback to config
  const displayPlayers = normalizePlayers(livePlayers ?? config?.players ?? []);
  
  // Only show real players — never use fake fallback names
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center px-6 relative">
      {/* Rich Racing Background matching Home.jsx quality */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden pointer-events-none">
        
        {/* Enhanced layered depth glows matching Home richness */}
        <div className="absolute inset-0 bg-gradient-to-t from-cyan-400/8 via-transparent to-pink-400/8 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute inset-0 bg-gradient-radial from-cyan-400/12 via-transparent to-transparent opacity-70" style={{ background: 'radial-gradient(circle at 30% 50%, rgba(6, 182, 212, 0.12) 0%, transparent 50%)' }} />
        <div className="absolute inset-0 bg-gradient-radial from-pink-400/12 via-transparent to-transparent opacity-70" style={{ background: 'radial-gradient(circle at 70% 50%, rgba(236, 72, 153, 0.12) 0%, transparent 50%)' }} />
        <div className="absolute inset-0 bg-gradient-radial from-yellow-400/4 via-transparent to-transparent opacity-50" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(250, 204, 21, 0.04) 0%, transparent 50%)' }} />
        
        {/* Stronger curved neon racing lanes matching Home */}
        <div className="absolute inset-0">
          {/* Left side - enhanced cyan/blue racing track */}
          <svg className="absolute top-0 left-0 w-1/2 h-full" viewBox="0 0 400 800" style={{ opacity: 0.9 }}>
            <defs>
              <linearGradient id="cyanTrack" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#0891b2" stopOpacity="1" />
                <stop offset="100%" stopColor="#0e7490" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="purpleAccent" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#9333ea" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.3" />
              </linearGradient>
              <filter id="cyanGlow">
                <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <path d="M 30 0 Q 150 200 50 400 T 70 800" stroke="url(#cyanTrack)" strokeWidth="8" fill="none" filter="url(#cyanGlow)" className="animate-pulse" style={{ animationDuration: '3s' }} />
            <path d="M 10 0 Q 130 200 30 400 T 50 800" stroke="#06b6d4" strokeWidth="4" fill="none" opacity="0.6" className="animate-pulse" style={{ animationDelay: '1s', animationDuration: '3s' }} />
            <path d="M 50 0 Q 170 200 70 400 T 90 800" stroke="url(#purpleAccent)" strokeWidth="3" fill="none" opacity="0.4" className="animate-pulse" style={{ animationDelay: '2s', animationDuration: '3s' }} />
            <path d="M 70 0 Q 190 200 90 400 T 110 800" stroke="#0891b2" strokeWidth="2" fill="none" opacity="0.2" className="animate-pulse" style={{ animationDelay: '3s', animationDuration: '3s' }} />
          </svg>
          
          {/* Right side - enhanced pink/purple racing track */}
          <svg className="absolute top-0 right-0 w-1/2 h-full" viewBox="0 0 400 800" style={{ opacity: 0.9 }}>
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
            <path d="M 370 0 Q 250 200 350 400 T 330 800" stroke="url(#pinkTrack)" strokeWidth="8" fill="none" filter="url(#pinkGlow)" className="animate-pulse" style={{ animationDuration: '3s', animationDelay: '1.5s' }} />
            <path d="M 390 0 Q 270 200 370 400 T 350 800" stroke="#ec4899" strokeWidth="4" fill="none" opacity="0.6" className="animate-pulse" style={{ animationDelay: '2.5s', animationDuration: '3s' }} />
            <path d="M 350 0 Q 230 200 330 400 T 310 800" stroke="#db2777" strokeWidth="3" fill="none" opacity="0.4" className="animate-pulse" style={{ animationDelay: '3.5s', animationDuration: '3s' }} />
            <path d="M 330 0 Q 210 200 310 400 T 290 800" stroke="#be185d" strokeWidth="2" fill="none" opacity="0.2" className="animate-pulse" style={{ animationDelay: '4.5s', animationDuration: '3s' }} />
          </svg>
        </div>
        
        {/* Enhanced speed lines matching Home richness */}
        <div className="absolute top-1/4 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent animate-pulse" style={{ animationDuration: '2s' }} />
        <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-pink-400/60 to-transparent animate-pulse" style={{ animationDelay: '0.7s', animationDuration: '2s' }} />
        <div className="absolute top-3/4 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-yellow-300/40 to-transparent animate-pulse" style={{ animationDelay: '1.4s', animationDuration: '2s' }} />
        <div className="absolute top-1/6 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent animate-pulse" style={{ animationDelay: '2.1s', animationDuration: '2s' }} />
        <div className="absolute top-5/6 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-400/30 to-transparent animate-pulse" style={{ animationDelay: '2.8s', animationDuration: '2s' }} />
        
        {/* More diagonal speed streaks matching Home */}
        <div className="absolute top-20 right-1/4 w-48 h-1.5 bg-gradient-to-l from-transparent via-cyan-400/40 to-transparent transform rotate-45 animate-pulse" style={{ animationDelay: '0.3s', animationDuration: '2s' }} />
        <div className="absolute bottom-32 left-1/4 w-40 h-1.5 bg-gradient-to-r from-transparent via-pink-400/40 to-transparent transform rotate-12 animate-pulse" style={{ animationDelay: '1s', animationDuration: '2s' }} />
        <div className="absolute top-60 left-1/3 w-36 h-1 bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent transform -rotate-12 animate-pulse" style={{ animationDelay: '1.7s', animationDuration: '2s' }} />
        <div className="absolute bottom-48 right-1/3 w-44 h-1 bg-gradient-to-l from-transparent via-pink-400/35 to-transparent transform -rotate-6 animate-pulse" style={{ animationDelay: '2.3s', animationDuration: '2s' }} />
        <div className="absolute top-40 right-1/3 w-32 h-0.5 bg-gradient-to-l from-transparent via-cyan-400/25 to-transparent transform rotate-6 animate-pulse" style={{ animationDelay: '3s', animationDuration: '2s' }} />
        <div className="absolute bottom-60 left-1/3 w-28 h-0.5 bg-gradient-to-r from-transparent via-pink-400/25 to-transparent transform -rotate-3 animate-pulse" style={{ animationDelay: '3.7s', animationDuration: '2s' }} />
        
        {/* Enhanced checkered flag patterns matching Home */}
        <div className="absolute bottom-12 right-12 w-20 h-20 opacity-20">
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute top-24 left-16 w-12 h-12 opacity-15">
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute bottom-20 left-24 w-10 h-10 opacity-12">
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute top-48 right-20 w-8 h-8 opacity-10">
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>

        {/* Rich decorative background elements matching Home density */}
        
        {/* Tiny question marks - cyan side */}
        <div className="absolute top-16 left-8 w-3 h-3 text-cyan-300/30 animate-pulse" style={{ animationDelay: '0.5s', animationDuration: '3s' }}>
          <span className="text-lg">?</span>
        </div>
        <div className="absolute top-28 left-24 w-2 h-2 text-cyan-300/25 animate-pulse" style={{ animationDelay: '2.1s', animationDuration: '3s' }}>
          <span className="text-sm">?</span>
        </div>
        <div className="absolute top-64 left-16 w-2 h-2 text-cyan-300/20 animate-pulse" style={{ animationDelay: '3.7s', animationDuration: '3s' }}>
          <span className="text-sm">?</span>
        </div>
        <div className="absolute bottom-24 left-8 w-3 h-3 text-cyan-300/25 animate-pulse" style={{ animationDelay: '1.3s', animationDuration: '3s' }}>
          <span className="text-lg">?</span>
        </div>
        
        {/* Tiny question marks - pink side */}
        <div className="absolute top-20 right-8 w-3 h-3 text-pink-300/30 animate-pulse" style={{ animationDelay: '1.8s', animationDuration: '3s' }}>
          <span className="text-lg">?</span>
        </div>
        <div className="absolute top-48 right-24 w-2 h-2 text-pink-300/25 animate-pulse" style={{ animationDelay: '3.4s', animationDuration: '3s' }}>
          <span className="text-sm">?</span>
        </div>
        <div className="absolute bottom-32 right-12 w-2 h-2 text-pink-300/20 animate-pulse" style={{ animationDelay: '0.9s', animationDuration: '3s' }}>
          <span className="text-sm">?</span>
        </div>
        
        {/* Tiny trophies */}
        <div className="absolute top-12 left-48 w-2 h-2 text-cyan-300/25 animate-pulse" style={{ animationDelay: '2.6s', animationDuration: '4s' }}>
          <span className="text-lg">🏆</span>
        </div>
        <div className="absolute bottom-16 right-48 w-1.5 h-1.5 text-pink-300/20 animate-pulse" style={{ animationDelay: '4.2s', animationDuration: '4s' }}>
          <span className="text-base">🏆</span>
        </div>
        <div className="absolute top-56 left-56 w-1 h-1 text-cyan-300/15 animate-pulse" style={{ animationDelay: '1.1s', animationDuration: '4s' }}>
          <span className="text-sm">🏆</span>
        </div>
        
        {/* Tiny lightning bolts */}
        <div className="absolute top-24 left-8 w-1.5 h-1.5 text-cyan-300/25 animate-pulse" style={{ animationDelay: '2.5s', animationDuration: '2.5s' }}>
          <span className="text-base">⚡</span>
        </div>
        <div className="absolute top-52 left-8 w-1 h-1 text-cyan-300/20 animate-pulse" style={{ animationDelay: '4.8s', animationDuration: '2.5s' }}>
          <span className="text-sm">⚡</span>
        </div>
        <div className="absolute top-24 right-8 w-1.5 h-1.5 text-pink-300/25 animate-pulse" style={{ animationDelay: '1.2s', animationDuration: '2.5s' }}>
          <span className="text-base">⚡</span>
        </div>
        <div className="absolute top-52 right-8 w-1 h-1 text-pink-300/20 animate-pulse" style={{ animationDelay: '3.6s', animationDuration: '2.5s' }}>
          <span className="text-sm">⚡</span>
        </div>
        
        {/* Tiny flag icons */}
        <div className="absolute top-36 left-64 w-1.5 h-1.5 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.2s', animationDuration: '3s' }}>
          <span className="text-base">🏁</span>
        </div>
        <div className="absolute bottom-56 left-64 w-1 h-1 text-cyan-300/15 animate-pulse" style={{ animationDelay: '3.9s', animationDuration: '3s' }}>
          <span className="text-sm">🏁</span>
        </div>
        <div className="absolute top-36 right-64 w-1.5 h-1.5 text-pink-300/20 animate-pulse" style={{ animationDelay: '1.7s', animationDuration: '3s' }}>
          <span className="text-base">🏁</span>
        </div>
        <div className="absolute bottom-56 right-64 w-1 h-1 text-pink-300/15 animate-pulse" style={{ animationDelay: '4.4s', animationDuration: '3s' }}>
          <span className="text-sm">🏁</span>
        </div>
        
        {/* Tiny sparkles/stars */}
        <div className="absolute top-4 left-24 w-1.5 h-1.5 text-cyan-300/25 animate-pulse" style={{ animationDelay: '1.1s', animationDuration: '2s' }}>
          <span className="text-base">✨</span>
        </div>
        <div className="absolute top-4 right-24 w-1.5 h-1.5 text-pink-300/20 animate-pulse" style={{ animationDelay: '3.7s', animationDuration: '2s' }}>
          <span className="text-base">✨</span>
        </div>
        <div className="absolute bottom-4 left-24 w-1 h-1 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.9s', animationDuration: '2s' }}>
          <span className="text-sm">✨</span>
        </div>
        <div className="absolute bottom-4 right-24 w-1 h-1 text-pink-300/15 animate-pulse" style={{ animationDelay: '4.5s', animationDuration: '2s' }}>
          <span className="text-sm">✨</span>
        </div>
        <div className="absolute top-40 left-8 w-1 h-1 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.7s', animationDuration: '2s' }}>
          <span className="text-sm">✨</span>
        </div>
        <div className="absolute top-40 right-8 w-1 h-1 text-pink-300/15 animate-pulse" style={{ animationDelay: '1.9s', animationDuration: '2s' }}>
          <span className="text-sm">✨</span>
        </div>
        
        {/* Rich floating particles with enhanced variety */}
        <div className="absolute top-16 left-12 w-3 h-3 bg-cyan-400/25 rounded-full animate-ping border border-cyan-400/40" />
        <div className="absolute top-32 right-16 w-2 h-2 bg-pink-400/20 rounded-full animate-ping border border-pink-400/30" style={{ animationDelay: '1.8s' }} />
        <div className="absolute bottom-24 left-20 w-2 h-2 bg-cyan-400/15 rounded-full animate-pulse border border-cyan-400/25" style={{ animationDelay: '0.8s' }}>
          <span className="text-cyan-300/70 text-xs flex items-center justify-center h-full">⚡</span>
        </div>
        <div className="absolute bottom-40 right-12 w-3 h-3 bg-pink-400/20 rounded-full animate-ping border border-pink-400/30" style={{ animationDelay: '2.3s' }} />
        
        {/* Enhanced HUD decorations matching Home richness */}
        <div className="absolute top-8 right-8 text-cyan-400/60 font-mono text-xs animate-pulse">
          <div>LOBBY</div>
          <div>MODE: WAIT</div>
          <div className="text-xs mt-1">LAP: 01</div>
        </div>
        <div className="absolute bottom-8 left-8 text-pink-400/50 font-mono text-xs animate-pulse" style={{ animationDelay: '1s' }}>
          <div>PLAYERS: {displayPlayers.length}</div>
          <div>SESSION: {gameCode}</div>
          <div className="text-xs mt-1">TIME: --:--</div>
        </div>
        <div className="absolute top-32 left-8 text-cyan-400/40 font-mono text-xs animate-pulse" style={{ animationDelay: '2s' }}>
          <div>TRACK: 01</div>
          <div>WEATHER: CLEAR</div>
        </div>
        <div className="absolute bottom-32 right-8 text-pink-400/35 font-mono text-xs animate-pulse" style={{ animationDelay: '3s' }}>
          <div>STATUS: READY</div>
          <div>FUEL: 100%</div>
        </div>
        <div className="absolute top-56 left-8 text-cyan-400/30 font-mono text-xs animate-pulse" style={{ animationDelay: '2.5s' }}>
          <div>RACE: WAIT</div>
          <div>MODE: LOBBY</div>
        </div>
        <div className="absolute bottom-56 right-8 text-pink-400/25 font-mono text-xs animate-pulse" style={{ animationDelay: '3.5s' }}>
          <div>POS: --</div>
          <div>SPEED: 0</div>
        </div>
      </div>
      
      {/* Radial overlay for depth matching Home */}
      <div className="fixed inset-0 bg-gradient-radial from-transparent via-slate-900/20 to-slate-900/40 pointer-events-none z-20" style={{ background: 'radial-gradient(circle at center, transparent 0%, rgba(15, 23, 42, 0.2) 50%, rgba(15, 23, 42, 0.4) 100%)' }} />
      
      {/* Main Content */}
      <div className="relative min-h-screen flex items-center justify-center px-4 py-3 md:px-6 md:py-4 z-30">

        <div className="w-full max-w-5xl text-center">
          {/* Enhanced Premium Hero Title with reduced size */}
          <div className="mb-3 md:mb-4">
            <h1 className="game-font text-3xl md:text-4xl font-bold mb-1.5 md:mb-2 relative">
              {/* Stronger neon glow background */}
              <span className="absolute inset-0 blur-3xl bg-gradient-to-r from-yellow-300/60 via-cyan-300/50 to-pink-300/60 animate-pulse" style={{ animationDuration: '3s' }} />
              <span className="absolute inset-0 blur-xl bg-gradient-to-r from-yellow-300/40 via-cyan-300/30 to-pink-300/40 animate-pulse" style={{ animationDelay: '1.5s', animationDuration: '3s' }} />
              
              {/* Speed streaks behind title */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent transform skew-x-12 animate-pulse" style={{ animationDelay: '0.7s', animationDuration: '2s' }} />
              <span className="absolute inset-0 bg-gradient-to-l from-transparent via-pink-400/20 to-transparent transform -skew-x-12 animate-pulse" style={{ animationDelay: '1.4s', animationDuration: '2s' }} />
              
              {/* Main title text */}
              <span className="relative bg-gradient-to-r from-yellow-300 via-cyan-200 to-pink-300 bg-clip-text text-transparent drop-shadow-lg">
                Waiting Room
              </span>
            </h1>
            <p className="text-slate-300 text-sm md:text-base font-light relative">
              <span className="absolute inset-0 bg-gradient-to-r from-cyan-400/10 to-pink-400/10 blur-sm animate-pulse" style={{ animationDuration: '4s' }} />
              <span className="relative">Hi <span className="text-white font-semibold text-base md:text-lg">{studentName}</span> • Ready to start</span>
            </p>
          </div>

          {/* Premium Waiting Room Card */}
          <div className="relative bg-slate-800/70 backdrop-blur-xl rounded-3xl p-4 md:p-5 shadow-3xl border-2 border-cyan-400/50 hover:border-cyan-400/90 transition-all duration-500 hover:scale-[1.02] hover:shadow-cyan-400/40 hover:shadow-4xl overflow-hidden">
            {/* Enhanced animated background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/15 via-transparent to-blue-500/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute inset-0 bg-cyan-400/8 animate-pulse" />
            <div className="absolute inset-0 bg-gradient-to-t from-cyan-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="relative z-10">
              {/* Enhanced Header Section */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 mb-4">
                <div className="text-left">
                  <div>
                    <p className="text-cyan-300 text-sm md:text-base font-semibold mb-0.5">Quiz Details</p>
                    <p className="text-slate-300 text-sm md:text-base">
                      Questions: <span className="text-white font-bold">{totalQuestions}</span> • 
                      Time: <span className="text-white font-bold">{timePerQuestion}s</span>
                    </p>
                  </div>
                </div>

                <div className="relative bg-slate-900/70 backdrop-blur-xl rounded-3xl px-5 py-3 md:px-6 md:py-3.5 text-center border-2 border-cyan-400/40 shadow-2xl hover:border-cyan-400/60 transition-all duration-300">
                  {/* Enhanced glow effect */}
                  <div className="absolute inset-0 bg-cyan-400/20 rounded-3xl animate-pulse" />
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-transparent rounded-3xl" />
                  <p className="text-cyan-300 text-xs font-semibold relative z-10 mb-0.5">GAME CODE</p>
                  <p className="game-font text-3xl md:text-4xl font-bold bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-400 bg-clip-text text-transparent relative z-10">{gameCode}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4 md:gap-5 items-start">
              {/* Enhanced Waiting Status Panel */}
              <div className="relative bg-slate-900/60 backdrop-blur-xl rounded-3xl p-4 md:p-5 border-2 border-cyan-400/30">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-cyan-400/10 rounded-3xl animate-pulse" style={{ animationDuration: '3s' }} />
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 to-transparent rounded-3xl" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-center mb-3">
                    <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-cyan-400 rounded-full animate-pulse mr-2.5" />
                    <p className="text-slate-300 text-sm md:text-base font-medium">
                      Waiting for the instructor to start the quiz...
                    </p>
                    <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-cyan-400 rounded-full animate-pulse ml-2.5" style={{ animationDelay: '0.5s' }} />
                  </div>
                  
                  {/* Enhanced progress bar */}
                  <div className="relative h-2.5 md:h-3 w-full bg-slate-700/50 rounded-full overflow-hidden mb-4">
                    <div className="absolute inset-0 bg-cyan-400/20 rounded-full animate-pulse" />
                    <div className="h-full w-1/2 bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-500 rounded-full animate-pulse relative overflow-hidden">
                      {/* Animated shine */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -translate-x-full animate-pulse" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                    </div>
                  </div>
                  
                  {/* Enhanced loading dots */}
                  <div className="flex justify-center space-x-2">
                    <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                    <div className="w-2.5 h-2.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>

              <div>
              {/* Enhanced Players Section */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="game-font text-2xl md:text-3xl font-bold bg-gradient-to-r from-pink-300 via-purple-400 to-cyan-300 bg-clip-text text-transparent">Players</h2>
                <span className="text-cyan-300 text-sm md:text-base font-semibold bg-cyan-400/20 px-3 py-1 rounded-full border border-cyan-400/40">
                  {displayPlayers.length} joined
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {displayPlayers.map((p, idx) => {
                  const playerName = getStudentName(p, idx);
                  const isCurrentUser = playerId ? p?.id === playerId : playerName === studentName;
                  return (
                    <div
                      key={`${playerName}-${idx}`}
                      className={`relative bg-slate-900/60 backdrop-blur-sm rounded-2xl px-3 py-2.5 border-2 transition-all duration-300 hover:scale-105 ${
                        isCurrentUser 
                          ? 'border-cyan-400/60 shadow-cyan-400/40 shadow-2xl' 
                          : 'border-slate-700/50 hover:border-cyan-400/40 hover:shadow-cyan-400/20'
                      }`}
                    >
                      {/* Enhanced glow for current user */}
                      {isCurrentUser && (
                        <div className="absolute inset-0 bg-cyan-400/15 rounded-2xl animate-pulse" />
                      )}
                      
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center space-x-2 min-w-0">
                          {/* Racing icon */}
                          <span className="text-lg md:text-xl shrink-0">
                            {isCurrentUser ? '🏎️' : '🏁'}
                          </span>
                          <span className={`text-sm md:text-base font-bold truncate ${
                            isCurrentUser ? 'text-cyan-300' : 'text-white'
                          }`}>
                            {playerName}
                          </span>
                        </div>
                        {isCurrentUser && (
                          <span className="text-[10px] md:text-xs bg-gradient-to-r from-cyan-400/40 to-blue-400/40 text-cyan-200 px-2 py-0.5 rounded-full font-semibold border border-cyan-400/60 shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
              </div>

        {/* Waiting for instructor to start the quiz */}

              {/* Enhanced Back to Home Button */}
              <button
                onClick={() => navigate("/")}
                className="relative w-full mt-4 bg-gradient-to-r from-slate-800/80 to-slate-700/80 hover:from-slate-700/80 hover:to-slate-600/80 border-2 border-cyan-400/50 hover:border-cyan-400/80 py-3 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-cyan-400/60 hover:shadow-3xl font-bold text-cyan-300 overflow-hidden group text-sm md:text-base"
              >
                {/* Enhanced hover shine effect */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                
                <span className="relative z-10 flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Home
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Lobby;
