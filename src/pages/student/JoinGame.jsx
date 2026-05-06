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
      const { data: sessionData, error: sessionError } =
        await getSessionById(trimmedCode);

      if (sessionError) {
        throw sessionError;
      }

      if (!sessionData) {
        setError("Session not found. Check the game code.");
        setLoading(false);
        return;
      }

      const { data: existingPlayer, error: playerError } =
        await getSessionPlayers(trimmedCode);

      if (playerError) {
        throw playerError;
      }

      const matchingPlayer = Array.isArray(existingPlayer)
        ? existingPlayer.find((player) => player.name === trimmedName)
        : null;

      if (!matchingPlayer) {
        const { error: insertError } = await insertSessionPlayer({
          session_id: sessionData.id,
          student_name: trimmedName,
          joined_at: new Date().toISOString(),
        });

        if (insertError) {
          throw insertError;
        }
      }

      const { data: updatedPlayers, error: refreshedPlayersError } =
        await getSessionPlayers(trimmedCode);

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
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* animated background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(236,72,153,0.18),_transparent_35%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#020617_100%)]" />

      {/* floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-16 left-20 h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
        <div className="absolute top-40 right-32 h-2 w-2 rounded-full bg-pink-400 animate-pulse" />
        <div className="absolute bottom-24 left-1/4 h-1.5 w-1.5 rounded-full bg-cyan-300 animate-bounce" />
        <div className="absolute bottom-36 right-1/4 h-1.5 w-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
      </div>

      {/* moving HUD border */}
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute inset-6 rounded-[36px] border border-cyan-500/20" />
        <div className="absolute inset-10 rounded-[32px] border border-pink-500/10 animate-pulse" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="rounded-[30px] border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
            <p className="text-center text-xs tracking-[0.35em] text-cyan-300 uppercase animate-pulse">
              Player Entrance
            </p>

            <h1 className="game-font text-center text-4xl md:text-5xl mt-3 font-black tracking-wide text-cyan-300 drop-shadow-[0_0_18px_rgba(34,211,238,0.8)] animate-pulse">
              Join Game
            </h1>

            <p className="mt-3 text-center text-sm text-slate-300">
              Enter your player name and game code to join the arena.
            </p>

            <form onSubmit={handleJoin} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-300">
                  Your Name
                </label>

                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full rounded-2xl border border-cyan-500/20 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-400 focus:shadow-[0_0_18px_rgba(34,211,238,0.25)]"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-300">
                  Game Code
                </label>

                <input
                  type="text"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  placeholder="Enter game code"
                  className="w-full rounded-2xl border border-cyan-500/20 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-400 focus:shadow-[0_0_18px_rgba(34,211,238,0.25)] uppercase tracking-[0.35em] font-bold"
                  required
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-2xl border border-cyan-400/20 bg-cyan-400/90 py-3 font-black text-slate-950 transition hover:scale-[1.02] hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="absolute inset-0 bg-white/10 opacity-0 transition group-hover:opacity-100" />
                <span className="relative">
                  {loading ? "Joining..." : "Enter Arena"}
                </span>
              </button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Waiting for host access
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JoinGame;