import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getSessionById,
  getSessionPlayers,
  insertSessionPlayer,
} from "../../lib/supabase";

function JoinGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [studentName, setStudentName] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const codeFromUrl = searchParams.get("code")?.trim().toUpperCase() || "";

    if (codeFromUrl) {
      setGameCode(codeFromUrl);
    }
  }, [searchParams]);

  const handleJoin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmedName = studentName.trim();
    const trimmedCode = gameCode.trim().toUpperCase();

    if (!trimmedName) {
      setError("Please enter your name.");
      setLoading(false);
      return;
    }

    if (!trimmedCode) {
      setError("Please enter the game code.");
      setLoading(false);
      return;
    }

    try {
      const { data: sessionData, error: sessionError } = await getSessionById(trimmedCode);

      if (sessionError) {
        throw sessionError;
      }

      if (!sessionData) {
        setError("Session not found. Check the game code.");
        setLoading(false);
        return;
      }

      const { data: existingPlayer, error: playerError } = await getSessionPlayers(trimmedCode);

      if (playerError) {
        throw playerError;
      }

      const matchingPlayer = Array.isArray(existingPlayer)
        ? existingPlayer.find((player) => player.name === trimmedName)
        : null;

      if (!matchingPlayer) {
        const { error: insertError } = await insertSessionPlayer({
          session_id: sessionData.id, // Use actual session UUID, not game code
          student_name: trimmedName,
          joined_at: new Date().toISOString(),
        });

        if (insertError) {
          throw insertError;
        }
      }

      const { data: updatedPlayers, error: refreshedPlayersError } = await getSessionPlayers(trimmedCode);

      if (refreshedPlayersError) {
        throw refreshedPlayersError;
      }

      localStorage.setItem(
        `quizplay_session_${trimmedCode}`,
        JSON.stringify({
          ...sessionData,
          gameCode: trimmedCode,
          players: updatedPlayers ?? [],
          questionsByDifficulty: sessionData.questions_by_difficulty ?? {},
          questionCount: sessionData.question_count,
          timePerQuestion: sessionData.time_per_question,
        })
      );

      navigate("/student/lobby", {
        state: {
          studentName: trimmedName,
          gameCode: trimmedCode,
        },
      });
    } catch (err) {
      console.error("Join session error:", err);
      setError("Failed to join session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center px-6">
      {/* Rich racing background */}
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
        
        {/* Rich floating particles */}
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
        
        {/* Additional tiny decorative elements */}
        
        {/* More question marks */}
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
          <div>MODE: JOIN</div>
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
          <div>SESSION: --</div>
          <div>PLAYERS: 0</div>
        </div>
      </div>
      
      {/* Premium centered join card */}
      <div className="relative w-full max-w-lg bg-slate-800/60 backdrop-blur-2xl rounded-3xl p-10 shadow-4xl border-2 border-cyan-400/50">
        {/* Stronger inner glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 via-transparent to-blue-500/20 rounded-3xl opacity-60" />
        {/* Card border glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/30 via-transparent to-cyan-400/30 rounded-3xl opacity-40" />
        
        {/* Premium header with icon */}
        <div className="relative mb-10">
          <div className="text-center">
            {/* Flag icon */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-400/25 rounded-full animate-ping" />
                <div className="relative bg-cyan-500/30 backdrop-blur-md rounded-2xl p-3 border-2 border-cyan-400/50">
                  <svg className="w-8 h-8 text-cyan-200" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14.4,6L14,4H5V21H7V14H12.6L13,16H20V6M14,8H18V14H13.6L13.2,12H7V8H14Z" />
                  </svg>
                </div>
              </div>
            </div>
            <h1 className="game-font text-5xl font-bold mb-3 bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
              Join Race
            </h1>
            <p className="text-slate-400 text-base">
              Enter your details to start the challenge
            </p>
          </div>
        </div>

        <form onSubmit={handleJoin} className="relative space-y-8">
          {/* Name input with stronger glow */}
          <div>
            <label className="block mb-3 text-cyan-300 font-semibold">Your Name</label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Enter your name"
              className="w-full p-5 rounded-2xl bg-slate-700/40 backdrop-blur-sm border-2 border-cyan-400/40 outline-none focus:border-cyan-400 focus:shadow-cyan-400/60 focus:shadow-2xl focus:bg-cyan-400/10 transition-all duration-300 placeholder-slate-400 text-white"
              required
            />
          </div>

          {/* Game code input with stronger glow */}
          <div>
            <label className="block mb-3 text-cyan-300 font-semibold">Game Code</label>
            <input
              type="text"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              placeholder="Enter game code"
              className="w-full p-5 rounded-2xl bg-slate-700/40 backdrop-blur-sm border-2 border-cyan-400/40 outline-none focus:border-cyan-400 focus:shadow-cyan-400/60 focus:shadow-2xl focus:bg-cyan-400/10 transition-all duration-300 placeholder-slate-400 text-white uppercase"
              required
            />
          </div>

          {/* Enhanced error message */}
          {error && (
            <div className="relative">
              <div className="absolute inset-0 bg-red-900/40 rounded-2xl animate-pulse border border-red-400/50" />
              <div className="absolute inset-0 bg-red-400/20 rounded-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
              <p className="relative text-red-400 text-sm font-medium p-4 rounded-2xl bg-red-900/30 backdrop-blur-sm border-2 border-red-400/40">
                {error}
              </p>
            </div>
          )}

          {/* Premium game CTA button */}
          <button
            type="submit"
            disabled={loading}
            className="relative w-full bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 disabled:from-cyan-600 disabled:to-cyan-700 text-slate-900 font-bold py-5 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-cyan-400/80 hover:shadow-3xl disabled:scale-100 disabled:shadow-none border-2 border-cyan-400/60 hover:border-cyan-400 disabled:border-cyan-400/40 overflow-hidden group transform hover:-translate-y-1"
          >
            {/* Stronger shine effect on hover */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative flex items-center justify-center">
              {loading ? (
                <>
                  <svg className="animate-spin -ml-2 mr-3 h-6 w-6 text-slate-900" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Joining...
                </>
              ) : (
                <>
                  <span className="mr-2">Start Race</span>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8,5.14V19.14L19,12.14L8,5.14Z" />
                  </svg>
                </>
              )}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default JoinGame;
