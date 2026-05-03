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
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl p-8 shadow-xl">
        <h1 className="game-font text-3xl text-center mb-6">Join Game</h1>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block mb-2">Your Name</label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Enter your name"
              className="w-full p-3 rounded-xl bg-slate-700 border border-slate-600 outline-none focus:border-cyan-400"
              required
            />
          </div>

          <div>
            <label className="block mb-2">Game Code</label>
            <input
              type="text"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              placeholder="Enter game code"
              className="w-full p-3 rounded-xl bg-slate-700 border border-slate-600 outline-none focus:border-cyan-400 uppercase"
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-700 text-slate-900 font-bold py-3 rounded-xl transition"
          >
            {loading ? "Joining..." : "Join"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default JoinGame;
