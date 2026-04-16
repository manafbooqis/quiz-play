import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function Question() {
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

  const gameCode = state.gameCode;

  const raw = localStorage.getItem(`quizplay_session_${gameCode}`);
  const session = raw ? JSON.parse(raw) : null;

  const totalQuestions = state.totalQuestions ?? session?.questionCount ?? 3;
  const timePerQuestion = state.timePerQuestion ?? session?.timePerQuestion ?? 15;

  const difficulty = state.difficulty ?? "medium";
  const pointsPerQuestion = state.pointsPerQuestion ?? 10;

  const totalAnswered = state.totalAnswered ?? 0;
  const totalPoints = state.totalPoints ?? 0;

  const usedCounts = state.usedCounts ?? { easy: 0, medium: 0, hard: 0 };
  const answersStatus = Array.isArray(state.answersStatus) ? state.answersStatus : [];

  const questionsByDifficulty = useMemo(() => {
    const fallback = { easy: [], medium: [], hard: [] };
    return session?.questionsByDifficulty ?? fallback;
  }, [session]);

  const list = questionsByDifficulty[difficulty] ?? questionsByDifficulty.medium ?? [];
  const localIndex = usedCounts[difficulty] ?? 0;

  const current =
    list[localIndex] ?? {
      q: "Fallback question: 2 + 3 = ?",
      choices: ["4", "5", "6", "7"],
      correctIndex: 1,
    };

  const [timeLeft, setTimeLeft] = useState(timePerQuestion);
  const [locked, setLocked] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);

  useEffect(() => {
    setTimeLeft(timePerQuestion);
  }, [timePerQuestion]);

  useEffect(() => {
    if (locked) return;

    if (timeLeft <= 0) {
      handleAnswer(null);
      return;
    }

    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timeLeft, locked]);

  function handleAnswer(index) {
    if (locked) return;

    setLocked(true);
    setSelectedIndex(index);

    const correct = index !== null && index === current.correctIndex;

    const earned = correct ? pointsPerQuestion : 0;
    const newTotal = totalPoints + earned;

    const updatedAnswersStatus = [...answersStatus, correct];

    const updatedUsedCounts = {
      ...usedCounts,
      [difficulty]: (usedCounts[difficulty] ?? 0) + 1,
    };

    const nextTotalAnswered = totalAnswered + 1;

    setTimeout(() => {
      if (nextTotalAnswered >= totalQuestions) {
        navigate("/student/final-results", {
          state: {
            ...state,
            totalPoints: newTotal,
            answersStatus: updatedAnswersStatus,
            usedCounts: updatedUsedCounts,
            totalAnswered: nextTotalAnswered,
            totalQuestions,
            timePerQuestion,
          },
        });
      } else {
        navigate("/student/difficulty", {
          state: {
            ...state,
            totalPoints: newTotal,
            answersStatus: updatedAnswersStatus,
            usedCounts: updatedUsedCounts,
            totalAnswered: nextTotalAnswered,
            totalQuestions,
            timePerQuestion,
          },
        });
      }
    }, 900);
  }

  const progress = Math.max(0, (timeLeft / timePerQuestion) * 100);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-3xl bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="game-font text-3xl text-cyan-300">Question</h1>
            <p className="text-slate-300 mt-1">
              Q {totalAnswered + 1} / {totalQuestions} • Difficulty:{" "}
              <span className="text-white">{difficulty}</span> • Earn{" "}
              <span className="text-yellow-300 font-semibold">+{pointsPerQuestion}</span>{" "}
              if correct
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-600 rounded-2xl px-5 py-3 text-center">
            <p className="text-slate-300 text-sm">Score</p>
            <p className="game-font text-3xl text-yellow-300">{totalPoints}</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between text-slate-300 text-sm mb-2">
            <span>Time</span>
            <span className="text-white font-semibold">{timeLeft}s</span>
          </div>
          <div className="h-3 w-full bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
          <p className="game-font text-2xl">{current.q}</p>
          <p className="text-slate-400 mt-2 text-sm">Pick one answer.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(current.choices || []).map((c, i) => {
            const chosen = selectedIndex === i;

            const answeredCorrectly =
              locked && selectedIndex !== null && selectedIndex === current.correctIndex;

            const showChosenGreen = locked && chosen && answeredCorrectly;
            const showChosenRed = locked && chosen && !answeredCorrectly;

            const classes = [
              "text-left rounded-xl px-4 py-4 transition border-2",
              locked ? "cursor-not-allowed" : "hover:bg-slate-800",
              "bg-slate-900",
              !showChosenGreen && !showChosenRed ? "border-slate-700" : "",
              showChosenGreen ? "border-emerald-400" : "",
              showChosenRed ? "border-red-400" : "",
            ].join(" ");

            return (
              <button
                key={`${c}-${i}`}
                onClick={() => handleAnswer(i)}
                disabled={locked}
                className={classes}
              >
                <span className="text-white">{c}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Question;