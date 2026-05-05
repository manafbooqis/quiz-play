import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase, getSessionPlayers } from "../../lib/supabase";

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

function Lobby() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [sessionData, setSessionData] = useState(null);
  const [livePlayers, setLivePlayers] = useState(null);

  // Clear any existing round timers when entering lobby
  useEffect(() => {
    const studentName = state?.studentName;
    const gameCode = state?.gameCode;
    
    if (studentName && gameCode) {
      const timerKey = `quizplay_round_timer_${gameCode}_${studentName}`;
      localStorage.removeItem(timerKey);
    }
  }, [state?.studentName, state?.gameCode]);

  if (!state?.studentName || !state?.gameCode) {
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

  const { studentName, gameCode } = state;

  // Setup real-time session monitoring
  useEffect(() => {
    if (!gameCode) return;

    // Load initial session data
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

          // If session is already active, navigate to question page
          if (session.status === "active") {
            const saved = localStorage.getItem(`quizplay_session_${gameCode}`);
            const savedSession = saved ? JSON.parse(saved) : null;
            const questionsByDifficulty = savedSession?.questionsByDifficulty || savedSession?.questions_by_difficulty || session.questions_by_difficulty;
            
            console.log("Navigating student to difficulty page (initial load)");
            navigate("/student/difficulty", {
              state: {
                studentName,
                gameCode,
                sessionId: session.id,
                currentRound: session.current_round || 1,
                currentQuestionId: session.current_question_id,
                currentDifficulty: session.current_difficulty,
                questionsByDifficulty,
                timePerQuestion,
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

        // Auto-navigate when quiz starts
        if (updatedSession.status === "active" && updatedSession.current_question_id) {
          const saved = localStorage.getItem(`quizplay_session_${gameCode}`);
          const savedSession = saved ? JSON.parse(saved) : null;
          const questionsByDifficulty = savedSession?.questionsByDifficulty || savedSession?.questions_by_difficulty || updatedSession.questions_by_difficulty;

          console.log("Lobby navigating to difficulty page");
          console.log("Lobby gameCode:", gameCode);
          console.log("Lobby loaded session:", updatedSession);
          console.log("Lobby session status:", updatedSession.status);
          console.log("Lobby current question:", updatedSession.current_question_id);
          console.log("Lobby navigating to difficulty");
          
          navigate("/student/difficulty", {
            state: {
              studentName,
              gameCode,
              sessionId: updatedSession.id,
              currentRound: updatedSession.current_round || 1,
              currentQuestionId: updatedSession.current_question_id,
              currentDifficulty: updatedSession.current_difficulty,
              questionsByDifficulty
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
          .select("id, game_code, status, current_question_id, current_difficulty, current_round")
          .eq("game_code", gameCode)
          .single();

        if (!pollError && session) {
          console.log("Lobby polling session:", session);
          if (session.status === "active" && session.current_question_id) {
            const saved = localStorage.getItem(`quizplay_session_${gameCode}`);
            const savedSession = saved ? JSON.parse(saved) : null;
            const questionsByDifficulty = savedSession?.questionsByDifficulty || savedSession?.questions_by_difficulty;

            console.log("Lobby polling: navigating to difficulty page");
            navigate("/student/difficulty", {
              state: {
                studentName,
                gameCode,
                sessionId: session.id,
                currentRound: session.current_round || 1,
                currentQuestionId: session.current_question_id,
                currentDifficulty: session.current_difficulty,
                questionsByDifficulty,
                timePerQuestion,
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
  }, [gameCode, studentName, navigate]);

  // Poll session_players for live updates
  useEffect(() => {
    if (!gameCode) return;

    // Initial fetch
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

  // Read instructor config (questionCount + timePerQuestion + players)
  const raw = localStorage.getItem(`quizplay_session_${gameCode}`);
  const config = raw ? JSON.parse(raw) : null;

  const totalQuestions =
    config?.questionCount ?? config?.question_count ?? 3;
  const timePerQuestion =
    config?.timePerQuestion ?? config?.time_per_question ?? 15;

  const normalizePlayers = (playersArray) => {
    if (!Array.isArray(playersArray)) return [];
    return playersArray.map((player, index) => getStudentName(player, index));
  };

  // Use live players from database with fallback to config
  const displayPlayers = normalizePlayers(livePlayers ?? config?.players ?? []);
  
  // Only show real players — never use fake fallback names
  const players = config?.players
      ? [...new Set([...normalizePlayers(config.players), studentName])]
      : [studentName];

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
          <div>RACE: WAIT</div>
          <div>MODE: LOBBY</div>
          <div className="text-xs mt-1">LAP: 0/0</div>
        </div>
        <div className="absolute bottom-8 left-8 text-cyan-400/40 font-mono text-xs animate-pulse" style={{ animationDelay: '1s' }}>
          <div>SPEED: 0</div>
          <div>STATUS: READY</div>
          <div className="text-xs mt-1">TIME: --:--</div>
        </div>
        <div className="absolute top-32 left-8 text-cyan-400/35 font-mono text-xs animate-pulse" style={{ animationDelay: '2s' }}>
          <div>TRACK: 01</div>
          <div>WEATHER: CLEAR</div>
        </div>
        <div className="absolute bottom-32 right-8 text-cyan-400/30 font-mono text-xs animate-pulse" style={{ animationDelay: '3s' }}>
          <div>SESSION: {gameCode}</div>
          <div>PLAYERS: {displayPlayers.length}</div>
        </div>
      </div>
      
      {/* Premium lobby card */}
      <div className="relative w-full max-w-3xl bg-slate-800/60 backdrop-blur-xl rounded-3xl p-10 shadow-4xl border-2 border-cyan-400/40">
        {/* Inner glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/15 via-transparent to-blue-500/15 rounded-3xl opacity-60" />
        {/* Premium header section */}
        <div className="relative mb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="relative">
              {/* Waiting icon */}
              <div className="flex items-center mb-4">
                <div className="relative mr-4">
                  <div className="absolute inset-0 bg-cyan-400/25 rounded-full animate-ping" />
                  <div className="relative bg-cyan-500/30 backdrop-blur-md rounded-2xl p-3 border-2 border-cyan-400/50">
                    <svg className="w-6 h-6 text-cyan-200" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.7L16.2,16.2Z" />
                    </svg>
                  </div>
                </div>
                <h1 className="game-font text-4xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                  Waiting Room
                </h1>
              </div>
              <p className="text-slate-300 text-lg">
                Hi <span className="text-white font-semibold">{studentName}</span>
              </p>
              <p className="text-slate-400 text-base mt-2">
                Quiz rounds: {totalQuestions} • Time per question:{" "}
                {timePerQuestion}s
              </p>
            </div>

            {/* Enhanced game code section */}
            <div className="relative bg-slate-900/60 backdrop-blur-sm border-2 border-cyan-400/40 rounded-2xl px-6 py-5 text-center shadow-cyan-400/30 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-transparent rounded-2xl opacity-50" />
              <p className="relative text-cyan-300 text-sm font-medium">Game Code</p>
              <p className="relative game-font text-4xl font-bold text-yellow-300 mt-2">{gameCode}</p>
            </div>
          </div>
        </div>

        {/* Enhanced waiting state section */}
        <div className="relative bg-slate-900/60 backdrop-blur-sm border-2 border-cyan-400/30 rounded-2xl p-8 mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-transparent rounded-2xl opacity-40" />
          <div className="relative">
            <p className="text-cyan-300 text-lg font-medium mb-6">
              Waiting for the instructor to start the quiz...
            </p>
            {/* Enhanced waiting animation */}
            <div className="flex items-center justify-center space-x-2">
              <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0s', animationDuration: '1.5s' }} />
              <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s', animationDuration: '1.5s' }} />
              <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.6s', animationDuration: '1.5s' }} />
              <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.9s', animationDuration: '1.5s' }} />
              <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '1.2s', animationDuration: '1.5s' }} />
            </div>
            <div className="mt-6 h-3 w-full bg-slate-700/50 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-400/60 to-cyan-300/60 animate-pulse" style={{ animationDuration: '3s' }} />
            </div>
          </div>
        </div>

        {/* Enhanced players section */}
        <div className="relative mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="game-font text-3xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">Players</h2>
            <span className="text-cyan-300 text-base font-medium bg-cyan-400/10 px-3 py-1 rounded-full border border-cyan-400/30">
              {displayPlayers.length} joined
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayPlayers.map((p, idx) => {
              const playerName = getStudentName(p, idx);
              const isCurrentPlayer = playerName === studentName;
              return (
                <div
                  key={`${playerName}-${idx}`}
                  className={`relative rounded-2xl px-5 py-4 border-2 transition-all duration-300 ${
                    isCurrentPlayer 
                      ? 'bg-cyan-500/20 border-cyan-400/60 shadow-cyan-400/50 shadow-2xl' 
                      : 'bg-slate-900/60 border-cyan-400/30 hover:border-cyan-400/50 hover:bg-cyan-400/10'
                  }`}
                >
                  {isCurrentPlayer && (
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-transparent rounded-2xl" />
                  )}
                  <div className="relative flex items-center">
                    {isCurrentPlayer && (
                      <div className="mr-3">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                      </div>
                    )}
                    <span className={`font-medium ${
                      isCurrentPlayer ? 'text-cyan-200' : 'text-white'
                    }`}>
                      {playerName}
                    </span>
                    {isCurrentPlayer && (
                      <span className="ml-auto text-cyan-400 text-xs font-medium">You</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Waiting for instructor to start the quiz */}

        {/* Enhanced navigation button */}
        <button
          onClick={() => navigate("/")}
          className="relative w-full bg-gradient-to-r from-slate-700/50 to-slate-600/50 hover:from-slate-600/50 hover:to-slate-500/50 text-cyan-300 font-bold py-4 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-cyan-400/40 hover:shadow-2xl border-2 border-cyan-400/40 hover:border-cyan-400/60 overflow-hidden group"
        >
          {/* Subtle shine effect */}
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          <span className="relative flex items-center justify-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" />
            </svg>
            Back to Home
          </span>
        </button>
      </div>
    </div>
  );
}

export default Lobby;
