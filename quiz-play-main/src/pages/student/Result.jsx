import { useLocation, useNavigate } from "react-router-dom";

function Result() {
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

  const TOTAL_QUESTIONS = 3;

  const lastPoints = state?.lastPoints ?? 0;
  const totalPoints = state?.totalPoints ?? 0;
  const currentIndex = state?.questionIndex ?? 0;

  const nextIndex = currentIndex + 1;
  const isFinished = nextIndex >= TOTAL_QUESTIONS;

  const onNext = () => {
    if (isFinished) {
      navigate("/student/final-results", {
        state: {
          ...state,
          totalPoints,
          questionIndex: nextIndex,
          totalQuestions: TOTAL_QUESTIONS,
        },
      });
      return;
    }

    navigate("/student/difficulty", {
      state: {
        ...state,
        questionIndex: nextIndex,
        totalPoints,
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-4xl bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="game-font text-3xl text-cyan-300">Result</h1>
            <p className="text-slate-300 mt-2">
              Question {currentIndex + 1} / {TOTAL_QUESTIONS}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-600 rounded-2xl px-5 py-4 text-center">
            <p className="text-slate-300 text-sm">Total Score</p>
            <p className="game-font text-3xl text-yellow-300 mt-1">{totalPoints}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center">
          <div className="w-56 h-56 rounded-full bg-emerald-400 shadow-2xl flex items-center justify-center">
            <span className="game-font text-6xl text-white">+{lastPoints}</span>
          </div>

          <h2 className="game-font text-5xl mt-6">Good Job!</h2>

          <button
            onClick={onNext}
            className="w-full mt-8 game-font bg-yellow-300 hover:bg-yellow-200 text-slate-900 py-3 rounded-xl transition"
          >
            {isFinished ? "Finish Quiz" : "Next Question"}
          </button>

          <button
            onClick={() => navigate("/student/lobby", { state })}
            className="w-full mt-3 bg-transparent border border-slate-600 hover:bg-slate-700 py-3 rounded-xl transition"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

export default Result;