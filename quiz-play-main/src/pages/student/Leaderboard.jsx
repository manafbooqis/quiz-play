import { useLocation, useNavigate } from "react-router-dom";

function Leaderboard() {
  const navigate = useNavigate();
  const { state } = useLocation();

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

  const { studentName, gameCode, score, total } = state;

  // Prototype leaderboard (mock). We'll replace this later with realtime data.
  const leaderboard = [
    { name: "Sara", score: 3 },
    { name: "Fahad", score: 2 },
    { name: studentName, score: score ?? 0 },
    { name: "Radi", score: 1 },
  ]
    .sort((a, b) => b.score - a.score)
    .map((p, idx) => ({ ...p, rank: idx + 1 }));

  const myRank =
    leaderboard.find((p) => p.name === studentName)?.rank ?? "-";

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="game-font text-4xl text-pink-300">Leaderboard</h1>
            <p className="text-slate-300 mt-2">
              Code: <span className="game-font text-yellow-300">{gameCode}</span>
              {typeof total === "number" ? (
                <>
                  {" "}
                  • Your score: <span className="text-white font-semibold">{score}</span>/{total}
                </>
              ) : null}
              {" "}
              • Your rank: <span className="text-white font-semibold">{myRank}</span>
            </p>
          </div>

          <button
            onClick={() => navigate("/student/result", { state })}
            className="w-full md:w-auto bg-transparent border border-slate-600 hover:bg-slate-700 py-3 px-6 rounded-xl transition"
          >
            Back to Results
          </button>
        </div>

        <div className="space-y-3">
          {leaderboard.map((p) => {
            const isMe = p.name === studentName;

            return (
              <div
                key={`${p.rank}-${p.name}`}
                className={[
                  "flex items-center justify-between rounded-2xl px-5 py-4 border",
                  isMe
                    ? "bg-slate-700 border-cyan-300"
                    : "bg-slate-900 border-slate-700",
                ].join(" ")}
              >
                <div className="flex items-center gap-4">
                  <div className="game-font text-2xl text-yellow-300 w-10">
                    #{p.rank}
                  </div>
                  <div>
                    <div className={isMe ? "text-cyan-200 font-semibold" : "text-white"}>
                      {p.name} {isMe ? "(You)" : ""}
                    </div>
                    <div className="text-slate-400 text-sm">Points</div>
                  </div>
                </div>

                <div className="game-font text-2xl text-cyan-300">{p.score}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col md:flex-row gap-3">
          <button
            onClick={() => navigate("/student/join")}
            className="w-full game-font bg-cyan-500 hover:bg-cyan-400 text-slate-900 py-3 rounded-xl transition"
          >
            Play Again
          </button>
          <button
            onClick={() => navigate("/")}
            className="w-full bg-transparent border border-slate-600 hover:bg-slate-700 py-3 rounded-xl transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default Leaderboard;