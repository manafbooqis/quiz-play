import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getSessionById,
  getSessionPlayers,
  insertSessionPlayer,
} from "../../lib/supabase";

/**
 * Normalizes a display name so duplicate checks are case-insensitive.
 * @param {string} name - Name entered by a student or loaded from a player row.
 * @returns {string} Trimmed lowercase name used for comparisons.
 */
function normalizeDisplayName(name) {
  return String(name || "").trim().toLowerCase();
}

// Renders the student join form and creates or restores the session player.
function JoinGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [studentName, setStudentName] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Reads a shared game code from the join URL so students can join from links.
  useEffect(() => {
    const codeFromUrl = searchParams.get("code")?.trim().toUpperCase() || "";

    if (codeFromUrl) {
      setGameCode(codeFromUrl);
    }
  }, [searchParams]);

  // Validates join details, creates a player when needed, and opens the lobby.
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

      const playerStorageKey = `quizplay_player_${trimmedCode}_${trimmedName}`;
      const storedPlayerId = localStorage.getItem(playerStorageKey);
      const matchingPlayer = Array.isArray(existingPlayer)
        ? existingPlayer.find((player) => player.id === storedPlayerId)
        : null;
      let sessionPlayer = matchingPlayer || null;

      if (!sessionPlayer) {
        const requestedName = normalizeDisplayName(trimmedName);
        const duplicateNamePlayer = Array.isArray(existingPlayer)
          ? existingPlayer.find(
              (player) =>
                normalizeDisplayName(player.student_name || player.name) === requestedName
            )
          : null;

        if (duplicateNamePlayer) {
          setError("This name is already used in this game. Please choose another name.");
          setLoading(false);
          return;
        }

        const { data: insertedPlayer, error: insertError } = await insertSessionPlayer({
          session_id: sessionData.id, // Use actual session UUID, not game code
          student_name: trimmedName,
          joined_at: new Date().toISOString(),
        });

        if (insertError) {
          throw insertError;
        }

        sessionPlayer = insertedPlayer;
      }

      const { data: updatedPlayers, error: refreshedPlayersError } = await getSessionPlayers(trimmedCode);

      if (refreshedPlayersError) {
        throw refreshedPlayersError;
      }

      if (!sessionPlayer?.id) {
        sessionPlayer = Array.isArray(updatedPlayers)
          ? updatedPlayers.find((player) => player.id === storedPlayerId) ||
              updatedPlayers.find((player) => player.student_name === trimmedName)
          : null;
      }

      const sessionPlayerId = sessionPlayer?.id || "";
      if (sessionPlayerId) {
        localStorage.setItem(playerStorageKey, sessionPlayerId);
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
          playerId: sessionPlayerId,
          sessionPlayerId,
          studentName: trimmedName,
        })
      );

      navigate("/student/lobby", {
        state: {
          studentName: trimmedName,
          gameCode: trimmedCode,
          playerId: sessionPlayerId,
          sessionPlayerId,
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
      {/* Rich racing background with cyan + purple/pink atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Layered depth glows - enhanced cyan on left with subtle purple accent, pink/purple on right */}
        <div className="absolute inset-0 bg-gradient-to-t from-cyan-400/6 via-transparent to-pink-400/6 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute inset-0 bg-gradient-radial from-cyan-400/12 via-transparent to-transparent opacity-75" style={{ background: 'radial-gradient(circle at 25% 50%, rgba(6, 182, 212, 0.12) 0%, transparent 50%)' }} />
        <div className="absolute inset-0 bg-gradient-radial from-purple-400/8 via-transparent to-transparent opacity-55" style={{ background: 'radial-gradient(circle at 35% 50%, rgba(168, 85, 247, 0.08) 0%, transparent 50%)' }} />
        <div className="absolute inset-0 bg-gradient-radial from-pink-400/10 via-transparent to-transparent opacity-70" style={{ background: 'radial-gradient(circle at 70% 50%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)' }} />
        {/* Extra subtle left side accent glow */}
        <div className="absolute inset-0 bg-gradient-radial from-blue-400/4 via-transparent to-transparent opacity-40" style={{ background: 'radial-gradient(circle at 20% 40%, rgba(59, 130, 246, 0.04) 0%, transparent 60%)' }} />
        
        {/* Enhanced cyan racing curves on left with subtle purple accent */}
        <svg className="absolute top-0 left-0 w-1/3 h-full" viewBox="0 0 300 800" style={{ opacity: 0.8 }}>
          <defs>
            <linearGradient id="cyanTrack" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#0891b2" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#0e7490" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="purpleAccent" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#9333ea" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.2" />
            </linearGradient>
            <filter id="cyanGlow">
              <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <path
            d="M 20 0 Q 120 200 40 400 T 60 800"
            stroke="url(#cyanTrack)"
            strokeWidth="5"
            fill="none"
            filter="url(#cyanGlow)"
            className="animate-pulse"
            style={{ animationDuration: '3s' }}
          />
          <path
            d="M 35 0 Q 135 200 55 400 T 75 800"
            stroke="url(#purpleAccent)"
            strokeWidth="3"
            fill="none"
            className="animate-pulse"
            style={{ animationDelay: '0.5s', animationDuration: '3s' }}
          />
          <path
            d="M 50 0 Q 150 200 70 400 T 90 800"
            stroke="#06b6d4"
            strokeWidth="2"
            fill="none"
            opacity="0.4"
            className="animate-pulse"
            style={{ animationDelay: '1s', animationDuration: '3s' }}
          />
        </svg>
        
        {/* Pink/purple racing curves on right side */}
        <svg className="absolute top-0 right-0 w-1/3 h-full" viewBox="0 0 300 800" style={{ opacity: 0.7 }}>
          <defs>
            <linearGradient id="pinkTrack" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#a855f7" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#9333ea" stopOpacity="0.4" />
            </linearGradient>
            <filter id="pinkGlow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <path
            d="M 280 0 Q 180 200 260 400 T 240 800"
            stroke="url(#pinkTrack)"
            strokeWidth="4"
            fill="none"
            filter="url(#pinkGlow)"
            className="animate-pulse"
            style={{ animationDuration: '3s', animationDelay: '1.5s' }}
          />
          <path
            d="M 260 0 Q 160 200 240 400 T 220 800"
            stroke="#ec4899"
            strokeWidth="2"
            fill="none"
            opacity="0.4"
            className="animate-pulse"
            style={{ animationDelay: '2.5s', animationDuration: '3s' }}
          />
        </svg>
        
        {/* Enhanced speed lines with more variety and depth */}
        <div className="absolute top-1/6 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent animate-pulse" style={{ animationDuration: '2s' }} />
        <div className="absolute top-1/4 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent animate-pulse" style={{ animationDuration: '2s' }} />
        <div className="absolute top-1/3 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-purple-400/25 to-transparent animate-pulse" style={{ animationDelay: '0.3s', animationDuration: '2s' }} />
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-400/30 to-transparent animate-pulse" style={{ animationDelay: '0.7s', animationDuration: '2s' }} />
        <div className="absolute top-2/3 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-purple-400/20 to-transparent animate-pulse" style={{ animationDelay: '1.1s', animationDuration: '2s' }} />
        <div className="absolute top-3/4 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent animate-pulse" style={{ animationDelay: '1.4s', animationDuration: '2s' }} />
        <div className="absolute top-5/6 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-pink-400/25 to-transparent animate-pulse" style={{ animationDelay: '1.8s', animationDuration: '2s' }} />
        
        {/* Rich floating particles with color variety */}
        <div className="absolute top-16 left-12 w-3 h-3 bg-cyan-400/25 rounded-full animate-ping border border-cyan-400/40" />
        <div className="absolute top-32 right-16 w-2 h-2 bg-pink-400/20 rounded-full animate-ping border border-pink-400/30" style={{ animationDelay: '1.8s' }} />
        <div className="absolute bottom-24 left-20 w-2 h-2 bg-cyan-400/15 rounded-full animate-pulse border border-cyan-400/25" style={{ animationDelay: '0.8s' }}>
          <span className="text-cyan-300/70 text-xs flex items-center justify-center h-full">⚡</span>
        </div>
        <div className="absolute bottom-40 right-12 w-3 h-3 bg-pink-400/20 rounded-full animate-ping border border-pink-400/30" style={{ animationDelay: '2.3s' }} />
        <div className="absolute top-48 left-24 w-2 h-2 text-cyan-300/25 animate-pulse" style={{ animationDelay: '1.3s' }}>
          <span className="text-lg">?</span>
        </div>
        <div className="absolute top-64 right-28 w-1.5 h-1.5 text-pink-300/20 animate-pulse" style={{ animationDelay: '2.8s' }}>
          <span className="text-base">🏁</span>
        </div>
        
        {/* Additional tiny decorative elements */}
        
        {/* More question marks with color variety */}
        <div className="absolute top-8 left-32 w-2 h-2 text-cyan-300/20 animate-pulse" style={{ animationDelay: '3.2s', animationDuration: '3s' }}>
          <span className="text-sm">?</span>
        </div>
        <div className="absolute top-72 left-32 w-1.5 h-1.5 text-cyan-300/15 animate-pulse" style={{ animationDelay: '1.8s', animationDuration: '3s' }}>
          <span className="text-base">?</span>
        </div>
        <div className="absolute top-8 right-32 w-2 h-2 text-pink-300/20 animate-pulse" style={{ animationDelay: '2.6s', animationDuration: '3s' }}>
          <span className="text-sm">?</span>
        </div>
        <div className="absolute top-72 right-32 w-1.5 h-1.5 text-pink-300/15 animate-pulse" style={{ animationDelay: '4.3s', animationDuration: '3s' }}>
          <span className="text-base">?</span>
        </div>
        
        {/* Tiny trophies with color variety */}
        <div className="absolute top-12 left-48 w-2 h-2 text-cyan-300/25 animate-pulse" style={{ animationDelay: '2.6s', animationDuration: '4s' }}>
          <span className="text-lg">🏆</span>
        </div>
        <div className="absolute bottom-16 right-48 w-1.5 h-1.5 text-pink-300/20 animate-pulse" style={{ animationDelay: '4.2s', animationDuration: '4s' }}>
          <span className="text-base">🏆</span>
        </div>
        <div className="absolute top-56 left-56 w-1 h-1 text-cyan-300/15 animate-pulse" style={{ animationDelay: '1.1s', animationDuration: '4s' }}>
          <span className="text-sm">🏆</span>
        </div>
        
        {/* More lightning bolts with color variety */}
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
        
        {/* More flag icons with color variety */}
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
        
        {/* Enhanced sparkles/stars with more variety */}
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
        <div className="absolute top-24 left-16 w-1 h-1 text-purple-300/18 animate-pulse" style={{ animationDelay: '3.2s', animationDuration: '2s' }}>
          <span className="text-sm">✨</span>
        </div>
        <div className="absolute bottom-24 right-16 w-1.5 h-1.5 text-pink-300/22 animate-pulse" style={{ animationDelay: '1.4s', animationDuration: '2s' }}>
          <span className="text-base">✨</span>
        </div>
        <div className="absolute top-56 left-32 w-1 h-1 text-cyan-300/15 animate-pulse" style={{ animationDelay: '4.1s', animationDuration: '2s' }}>
          <span className="text-sm">✨</span>
        </div>
        <div className="absolute bottom-56 right-32 w-1 h-1 text-purple-300/12 animate-pulse" style={{ animationDelay: '2.3s', animationDuration: '2s' }}>
          <span className="text-sm">✨</span>
        </div>
        
        {/* Enhanced particles with more variety and depth */}
        <div className="absolute top-12 left-4 w-1 h-1 bg-cyan-400/25 rounded-full animate-ping" style={{ animationDelay: '1.3s' }} />
        <div className="absolute top-28 left-4 w-1 h-1 bg-purple-400/18 rounded-full animate-ping" style={{ animationDelay: '3.8s' }} />
        <div className="absolute top-44 left-4 w-1 h-1 bg-cyan-400/20 rounded-full animate-ping" style={{ animationDelay: '2.1s' }} />
        <div className="absolute top-60 left-4 w-1 h-1 bg-purple-400/15 rounded-full animate-ping" style={{ animationDelay: '4.7s' }} />
        <div className="absolute top-76 left-4 w-1 h-1 bg-cyan-400/12 rounded-full animate-ping" style={{ animationDelay: '0.9s' }} />
        
        <div className="absolute top-12 right-4 w-1 h-1 bg-pink-400/25 rounded-full animate-ping" style={{ animationDelay: '2.4s' }} />
        <div className="absolute top-28 right-4 w-1 h-1 bg-purple-400/18 rounded-full animate-ping" style={{ animationDelay: '4.1s' }} />
        <div className="absolute top-44 right-4 w-1 h-1 bg-pink-400/20 rounded-full animate-ping" style={{ animationDelay: '1.6s' }} />
        <div className="absolute top-60 right-4 w-1 h-1 bg-purple-400/15 rounded-full animate-ping" style={{ animationDelay: '3.3s' }} />
        <div className="absolute top-76 right-4 w-1 h-1 bg-pink-400/12 rounded-full animate-ping" style={{ animationDelay: '0.7s' }} />
        
        {/* Additional middle particles for depth */}
        <div className="absolute top-20 left-12 w-0.5 h-0.5 bg-cyan-400/15 rounded-full animate-ping" style={{ animationDelay: '2.8s' }} />
        <div className="absolute top-36 right-12 w-0.5 h-0.5 bg-pink-400/12 rounded-full animate-ping" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-52 left-8 w-0.5 h-0.5 bg-purple-400/10 rounded-full animate-ping" style={{ animationDelay: '3.6s' }} />
        <div className="absolute top-68 right-8 w-0.5 h-0.5 bg-cyan-400/8 rounded-full animate-ping" style={{ animationDelay: '2.2s' }} />
        
        {/* Enhanced racing dots with more geometric variety */}
        <div className="absolute top-16 left-72 w-1.5 h-1.5 border border-cyan-400/18 rounded-full animate-pulse" style={{ animationDelay: '2.8s', animationDuration: '3s' }} />
        <div className="absolute top-32 left-68 w-1 h-1 border border-purple-400/12 rounded-full animate-pulse" style={{ animationDelay: '1.7s', animationDuration: '3s' }} />
        <div className="absolute top-48 left-72 w-1 h-1 border border-cyan-400/14 rounded-full animate-pulse" style={{ animationDelay: '4.2s', animationDuration: '3s' }} />
        <div className="absolute bottom-32 left-72 w-1.5 h-1.5 border border-cyan-400/12 rounded-full animate-pulse" style={{ animationDelay: '1.4s', animationDuration: '3s' }} />
        
        <div className="absolute top-16 right-72 w-1.5 h-1.5 border border-pink-400/18 rounded-full animate-pulse" style={{ animationDelay: '3.1s', animationDuration: '3s' }} />
        <div className="absolute top-32 right-68 w-1 h-1 border border-purple-400/12 rounded-full animate-pulse" style={{ animationDelay: '2.4s', animationDuration: '3s' }} />
        <div className="absolute top-48 right-72 w-1 h-1 border border-pink-400/14 rounded-full animate-pulse" style={{ animationDelay: '0.5s', animationDuration: '3s' }} />
        <div className="absolute bottom-32 right-72 w-1.5 h-1.5 border border-pink-400/12 rounded-full animate-pulse" style={{ animationDelay: '4.6s', animationDuration: '3s' }} />
        
        {/* Additional geometric shapes */}
        <div className="absolute top-24 left-64 w-1 h-1 border border-cyan-400/10 rotate-45 animate-pulse" style={{ animationDelay: '3.3s', animationDuration: '3s' }} />
        <div className="absolute top-56 right-64 w-1.5 h-1.5 border border-pink-400/8 rotate-45 animate-pulse" style={{ animationDelay: '1.9s', animationDuration: '3s' }} />
        <div className="absolute bottom-40 left-64 w-1 h-1 border border-purple-400/6 rotate-45 animate-pulse" style={{ animationDelay: '2.7s', animationDuration: '3s' }} />
        
        {/* Final polish: subtle extra decorative elements */}
        <div className="absolute top-12 left-20 w-0.5 h-0.5 bg-cyan-400/8 rounded-full animate-ping" style={{ animationDelay: '4.2s' }} />
        <div className="absolute top-28 right-20 w-0.5 h-0.5 bg-pink-400/6 rounded-full animate-ping" style={{ animationDelay: '2.1s' }} />
        <div className="absolute bottom-20 left-16 w-0.5 h-0.5 bg-purple-400/5 rounded-full animate-ping" style={{ animationDelay: '3.5s' }} />
        <div className="absolute bottom-36 right-16 w-0.5 h-0.5 bg-cyan-400/7 rounded-full animate-ping" style={{ animationDelay: '1.8s' }} />
        
        {/* Tiny HUD-style indicators */}
        <div className="absolute top-8 left-32 text-cyan-400/20 font-mono text-xs animate-pulse" style={{ animationDelay: '2.4s' }}>
          <div>●</div>
        </div>
        <div className="absolute top-16 right-32 text-pink-400/18 font-mono text-xs animate-pulse" style={{ animationDelay: '3.1s' }}>
          <div>■</div>
        </div>
        <div className="absolute bottom-12 left-36 text-purple-400/15 font-mono text-xs animate-pulse" style={{ animationDelay: '1.7s' }}>
          <div>▲</div>
        </div>
        <div className="absolute bottom-24 right-36 text-cyan-400/12 font-mono text-xs animate-pulse" style={{ animationDelay: '4.6s' }}>
          <div>◆</div>
        </div>
        
        {/* Enhanced checkered hints and racing details */}
        <div className="absolute top-20 left-4 w-1.5 h-1.5 opacity-15 animate-pulse" style={{ animationDelay: '2.7s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute top-32 right-4 w-1 h-1 opacity-12 animate-pulse" style={{ animationDelay: '1.9s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute bottom-20 left-4 w-1.5 h-1.5 opacity-10 animate-pulse" style={{ animationDelay: '3.4s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute bottom-16 right-4 w-1 h-1 opacity-10 animate-pulse" style={{ animationDelay: '0.8s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute top-48 left-8 w-1 h-1 opacity-8 animate-pulse" style={{ animationDelay: '2.2s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute top-64 right-8 w-1.5 h-1.5 opacity-6 animate-pulse" style={{ animationDelay: '1.5s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        
        {/* Enhanced diagonal speed streaks and racing lines */}
        <div className="absolute top-12 right-1/4 w-36 h-0.5 bg-gradient-to-l from-transparent via-pink-400/25 to-transparent transform rotate-45 animate-pulse" style={{ animationDelay: '0.3s', animationDuration: '2s' }} />
        <div className="absolute top-28 left-1/4 w-32 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent transform rotate-12 animate-pulse" style={{ animationDelay: '0.8s', animationDuration: '2s' }} />
        <div className="absolute top-44 right-1/3 w-28 h-0.5 bg-gradient-to-l from-transparent via-purple-400/20 to-transparent transform -rotate-12 animate-pulse" style={{ animationDelay: '1.3s', animationDuration: '2s' }} />
        <div className="absolute bottom-32 left-1/4 w-28 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent transform rotate-12 animate-pulse" style={{ animationDelay: '1s', animationDuration: '2s' }} />
        <div className="absolute bottom-48 right-1/4 w-32 h-0.5 bg-gradient-to-l from-transparent via-pink-400/20 to-transparent transform -rotate-6 animate-pulse" style={{ animationDelay: '1.6s', animationDuration: '2s' }} />
        <div className="absolute top-60 left-1/3 w-24 h-0.5 bg-gradient-to-r from-transparent via-purple-400/18 to-transparent transform -rotate-3 animate-pulse" style={{ animationDelay: '2.1s', animationDuration: '2s' }} />
        
        {/* Enhanced HUD decorations with more racing details */}
        <div className="absolute top-8 right-8 text-cyan-400/60 font-mono text-xs animate-pulse">
          <div>RACE: READY</div>
          <div>MODE: JOIN</div>
          <div className="text-xs mt-1">LAP: 0/0</div>
          <div className="text-xs mt-1">BEST: --:--</div>
        </div>
        <div className="absolute bottom-8 left-8 text-pink-400/50 font-mono text-xs animate-pulse" style={{ animationDelay: '1s' }}>
          <div>SPEED: 0</div>
          <div>GEAR: N</div>
          <div>STATUS: WAIT</div>
          <div className="text-xs mt-1">TIME: --:--</div>
        </div>
        <div className="absolute top-32 left-8 text-cyan-400/40 font-mono text-xs animate-pulse" style={{ animationDelay: '2s' }}>
          <div>TRACK: 01</div>
          <div>WEATHER: CLEAR</div>
          <div className="text-xs mt-1">TEMP: 72°F</div>
        </div>
        <div className="absolute bottom-32 right-8 text-pink-400/35 font-mono text-xs animate-pulse" style={{ animationDelay: '3s' }}>
          <div>SESSION: --</div>
          <div>PLAYERS: 0</div>
          <div className="text-xs mt-1">FUEL: 100%</div>
        </div>
        <div className="absolute top-56 left-8 text-cyan-400/30 font-mono text-xs animate-pulse" style={{ animationDelay: '2.5s' }}>
          <div>DRIFT: OFF</div>
          <div>BOOST: READY</div>
        </div>
        <div className="absolute bottom-56 right-8 text-pink-400/25 font-mono text-xs animate-pulse" style={{ animationDelay: '3.5s' }}>
          <div>POS: --</div>
          <div>LAPS: 0/3</div>
        </div>
      </div>
      
      {/* Premium centered join card with subtle pink accent */}
      <div className="relative w-full max-w-lg bg-slate-800/60 backdrop-blur-2xl rounded-3xl p-10 shadow-4xl border-2 border-cyan-400/50">
        {/* Stronger inner glow effect with subtle pink */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 via-transparent to-pink-400/15 rounded-3xl opacity-60" />
        {/* Card border glow with subtle pink accent */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/30 via-transparent to-pink-400/20 rounded-3xl opacity-40" />
        
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
            <h1 className="game-font text-4xl md:text-5xl font-bold text-center mb-4 bg-gradient-to-r from-cyan-300 via-sky-200 to-pink-300 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(34,211,238,0.45)]">
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

          {/* Premium game CTA button with subtle pink shine */}
          <button
            type="submit"
            disabled={loading}
            className="relative w-full bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-pink-400 disabled:from-cyan-600 disabled:to-cyan-700 text-slate-900 font-bold py-5 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-cyan-400/80 hover:shadow-3xl disabled:scale-100 disabled:shadow-none border-2 border-cyan-400/60 hover:border-pink-400 disabled:border-cyan-400/40 overflow-hidden group transform hover:-translate-y-1"
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
