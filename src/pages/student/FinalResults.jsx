import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function FinalResults() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const studentName = state?.studentName ?? "";
  const gameCode = state?.gameCode ?? "";
  const sessionId = state?.sessionId ?? "";
  const questionCount = state?.questionCount ?? state?.maxQuestions ?? 0;

  const [players, setPlayers] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId && !gameCode) {
      setLoading(false);
      return;
    }

    async function loadResults() {
      try {
        // Resolve session UUID from gameCode if sessionId not available
        let resolvedSessionId = sessionId;
        if (!resolvedSessionId && gameCode) {
          const { data: sessionRow } = await supabase
            .from("sessions")
            .select("id")
            .eq("game_code", gameCode)
            .maybeSingle();
          resolvedSessionId = sessionRow?.id ?? "";
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
      } catch (err) {
        console.error("Error loading final results:", err);
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, [sessionId, gameCode]);

  if (!studentName || !gameCode) {
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

  // Calculate per-player scores from real responses
  const scoreMap = {};
  responses.forEach((r) => {
    const pid = r.player_id;
    if (!scoreMap[pid]) scoreMap[pid] = { score: 0, correct: 0, total: 0 };
    scoreMap[pid].score += Number(r.points_awarded || 0);
    scoreMap[pid].total += 1;
    if (r.is_correct) scoreMap[pid].correct += 1;
  });

  // Build leaderboard from real players only
  const leaderboard = players
    .map((p) => {
      const name = p.student_name || p.name || p.full_name || "Unknown";
      const data = scoreMap[p.id] || scoreMap[name] || scoreMap[p.student_name] || { score: p.total_score || 0, correct: 0, total: 0 };
      return { name, score: data.score, correct: data.correct, total: data.total };
    })
    .sort((a, b) => b.score - a.score);

  // This student's data
  const myData = scoreMap[studentName] || { score: 0, correct: 0, total: 0 };
  const totalPoints = myData.score;
  const correctCount = myData.correct;
  const totalAnswered = myData.total || questionCount;

  const rank = leaderboard.findIndex((x) => x.name === studentName) + 1;

  // Build answersStatus from real responses for this student
  const myResponses = responses
    .filter((r) => r.player_id === studentName)
    .sort((a, b) => (a.round_number || 0) - (b.round_number || 0));
  const answersStatus = myResponses.map((r) => r.is_correct);

  return (
    <div className="min-h-screen bg-slate-900 text-white px-4 py-6 lg:px-6">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-stretch lg:gap-6">
        {/* CENTER – Main results */}
        <div className="order-1 lg:order-2 flex-1 flex items-center justify-center">
          <div className="w-full max-w-2xl bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-6 md:p-8 text-center">
            <h1 className="game-font text-3xl md:text-5xl text-cyan-300 mb-6 md:mb-8">
              Quiz Answer Results
            </h1>

            <div className="mx-auto bg-emerald-400 rounded-[32px] md:rounded-[40px] shadow-2xl px-6 md:px-8 py-8 md:py-10 text-slate-900 max-w-xl">
              <h2 className="game-font text-4xl md:text-5xl text-white mb-5 md:mb-6 break-words">
                {studentName}
              </h2>

              <p className="game-font text-2xl md:text-3xl text-white">
                Total Score: {totalPoints}
              </p>

              <p className="mt-5 md:mt-6 text-white font-semibold">
                Correct answers: {correctCount}/{totalAnswered}
              </p>

              <p className="mt-3 text-white font-semibold">
                {rank > 0 ? `Rank: #${rank}` : "—"}
              </p>

              <button
                onClick={() => navigate("/student/join")}
                className="w-full mt-6 game-font bg-yellow-300 hover:bg-yellow-200 text-slate-900 py-3 rounded-xl transition"
              >
                Join Another Quiz
              </button>
            </div>
          </div>
        </div>

        {/* LEFT – Question status */}
        <div className="order-2 lg:order-1 lg:w-40 mt-6 lg:mt-0">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
            <h3 className="game-font text-xl text-pink-300 mb-3 text-center">
              Answers
            </h3>

            <div className="flex lg:flex-col gap-3 lg:gap-4 items-center lg:items-stretch justify-start overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {Array.from({ length: Math.max(answersStatus.length, questionCount || 0) }).map((_, i) => {
                const ok = answersStatus[i] === true;
                const wrong = answersStatus[i] === false;

                return (
                  <div
                    key={i}
                    className={[
                      "shrink-0 w-14 h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 flex items-center justify-center rounded-xl shadow",
                      ok ? "bg-emerald-400" : wrong ? "bg-red-500" : "bg-slate-600",
                    ].join(" ")}
                  >
                    <span className="game-font text-2xl md:text-3xl lg:text-4xl text-white">
                      {i + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT – Real leaderboard */}
        <aside className="order-3 lg:order-3 lg:w-80 mt-6 lg:mt-0">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 h-auto lg:h-full">
            <h2 className="game-font text-2xl mb-4 text-pink-300 text-center lg:text-left">
              Current Leaderboard
            </h2>

            {leaderboard.length === 0 ? (
              <p className="text-slate-400 text-sm text-center">No participants found.</p>
            ) : (
              <div className="space-y-3 max-h-[360px] lg:max-h-none overflow-y-auto pr-1">
                {leaderboard.map((p, idx) => (
                  <div
                    key={`${p.name}-${idx}`}
                    className="bg-emerald-700/80 hover:bg-emerald-700 border border-emerald-300/20 rounded-2xl px-4 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🎖️"}
                      </span>
                      <span className="game-font text-lg text-white truncate">{p.name}</span>
                    </div>
                    <span className="text-yellow-300 font-semibold">{p.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default FinalResults;
