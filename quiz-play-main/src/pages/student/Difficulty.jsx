import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function Difficulty() {
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

  const totalQuestions = state.totalQuestions ?? 3;
  const timePerQuestion = state.timePerQuestion ?? 15;

  const totalAnswered = state.totalAnswered ?? 0;
  const totalPoints = state.totalPoints ?? 0;

  useEffect(() => {
    if (totalAnswered >= totalQuestions) {
      navigate("/student/final-results", { state });
    }
  }, [totalAnswered, totalQuestions, navigate, state]);

  if (totalAnswered >= totalQuestions) return null;


  const goToQuestion = (difficulty, points) => {
    navigate("/student/question", {
      state: {
        ...state,
        difficulty,
        pointsPerQuestion: points,
      },
    });
  };

  const cards = [
    { label: "Easy", diff: "easy", points: 10, badge: "bg-emerald-400" },
    { label: "Medium", diff: "medium", points: 25, badge: "bg-yellow-300" },
    { label: "Hard", diff: "hard", points: 50, badge: "bg-red-400" },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-4xl bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="game-font text-3xl text-cyan-300">Pick Difficulty</h1>
            <p className="text-slate-300 mt-2">
              Question{" "}
              <span className="text-white font-semibold">{totalAnswered + 1}</span> /{" "}
              <span className="text-white font-semibold">{totalQuestions}</span> • Score{" "}
              <span className="text-yellow-300 font-semibold">{totalPoints}</span> • Time{" "}
              <span className="text-white font-semibold">{timePerQuestion}s</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          {cards.map((c) => (
            <div
              key={c.diff}
              className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6"
            >
              {/* Top badge */}
              <div
                className={`absolute -top-4 left-1/2 -translate-x-1/2 ${c.badge} text-slate-900 font-bold rounded-full px-3 py-1 shadow`}
              >
                +{c.points}
              </div>

              <h2 className="game-font text-4xl text-white mt-10">{c.label}</h2>

              <button
                onClick={() => goToQuestion(c.diff, c.points)}
                className="w-full mt-8 game-font bg-yellow-300 hover:bg-yellow-200 text-slate-900 py-3 rounded-xl transition"
              >
                Select
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Difficulty;