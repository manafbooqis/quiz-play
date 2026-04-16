import { useLocation, useNavigate } from "react-router-dom";

function FinalResults() {
  const navigate = useNavigate();
  const { state } = useLocation();

  if (!state?.studentName || !state?.gameCode) {
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

  const totalPoints = state.totalPoints ?? 0;
  const answersStatus = Array.isArray(state.answersStatus) ? state.answersStatus : [];
  const totalQuestions = state.totalQuestions ?? answersStatus.length ?? 3;

  const players = Array.isArray(state.players)
    ? state.players
    : ["Radi", "Sara", "Fahad", state.studentName];

  const otherScores = players
    .filter((n) => n !== state.studentName)
    .map((name, i) => ({
      name,
      score: Math.max(0, totalPoints + (i % 2 === 0 ? 40 : -30) - i * 10),
    }));

  const leaderboard = [...otherScores, { name: state.studentName, score: totalPoints }].sort(
    (a, b) => b.score - a.score
  );

  const rank = leaderboard.findIndex((x) => x.name === state.studentName) + 1;
  const rightList = leaderboard.slice(0, Math.min(leaderboard.length, 10));
  const correctCount = answersStatus.filter((x) => x === true).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white px-4 py-6 lg:px-6">
      {/* ✅ Mobile: stacked | Desktop: 3 columns */}
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-stretch lg:gap-6">
        {/* CENTER (Main results) */}
        <div className="order-1 lg:order-2 flex-1 flex items-center justify-center">
          <div className="w-full max-w-2xl bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-6 md:p-8 text-center">
            <h1 className="game-font text-3xl md:text-5xl text-cyan-300 mb-6 md:mb-8">
              Quiz Answer Results
            </h1>

            <div className="mx-auto bg-emerald-400 rounded-[32px] md:rounded-[40px] shadow-2xl px-6 md:px-8 py-8 md:py-10 text-slate-900 max-w-xl">
              <h2 className="game-font text-4xl md:text-5xl text-white mb-5 md:mb-6 break-words">
                {state.studentName}
              </h2>

              <p className="game-font text-2xl md:text-3xl text-white">
                Total Score: {totalPoints}
              </p>

              <p className="mt-5 md:mt-6 text-white font-semibold">
                Correct answers: {correctCount}/{totalQuestions}
              </p>

              <p className="mt-3 text-white font-semibold">Rank: #{rank}</p>

              <button
                onClick={() => navigate("/student/join")}
                className="w-full mt-6 game-font bg-yellow-300 hover:bg-yellow-200 text-slate-900 py-3 rounded-xl transition"
              >
                Join Another Quiz
              </button>
            </div>
          </div>
        </div>

        {/* LEFT (Question status) */}
        <div className="order-2 lg:order-1 lg:w-40 mt-6 lg:mt-0">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
            <h3 className="game-font text-xl text-pink-300 mb-3 text-center">
              Answers
            </h3>

            {/* ✅ Mobile: horizontal scroll | Desktop: vertical */}
            <div className="flex lg:flex-col gap-3 lg:gap-4 items-center lg:items-stretch justify-start overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {Array.from({ length: totalQuestions }).map((_, i) => {
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

        {/* RIGHT (Leaderboard) */}
        <aside className="order-3 lg:order-3 lg:w-80 mt-6 lg:mt-0">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 h-auto lg:h-full">
            <h2 className="game-font text-2xl mb-4 text-pink-300 text-center lg:text-left">
              Current Leaderboard
            </h2>

            <div className="space-y-3 max-h-[360px] lg:max-h-none overflow-y-auto pr-1">
              {rightList.map((p, idx) => (
                <div
                  key={`${p.name}-${idx}`}
                  className="bg-emerald-700/80 hover:bg-emerald-700 border border-emerald-300/20 rounded-2xl px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🎖️"}
                    </span>
                    <span className="game-font text-lg text-white truncate">
                      {p.name}
                    </span>
                  </div>
                  <span className="text-yellow-300 font-semibold">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default FinalResults;