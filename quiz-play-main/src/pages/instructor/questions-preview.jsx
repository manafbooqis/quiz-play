import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function QuestionsPreview() {
  const navigate = useNavigate();
  const { state } = useLocation();

  if (!state?.gameCode) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">No session found</h1>
          <p className="text-slate-500 mb-6">Go back to Session page first.</p>
          <button
            onClick={() => navigate("/instructor/session-official")}
            className="w-full px-5 py-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 transition font-bold"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  const gameCode = state.gameCode;

  const raw = localStorage.getItem(`quizplay_session_${gameCode}`);
  const session = raw ? JSON.parse(raw) : null;

  const questionsByDifficulty = session?.questionsByDifficulty ?? {
    easy: [],
    medium: [],
    hard: [],
  };

  const [difficulty, setDifficulty] = useState("easy");
  const list = questionsByDifficulty[difficulty] ?? [];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const current = list[selectedIndex];

  const tabs = [
    { key: "easy", label: "Easy" },
    { key: "medium", label: "Medium" },
    { key: "hard", label: "Hard" },
  ];

  // When switching difficulty, reset question selection
  const safeSelectedIndex = useMemo(() => {
    if (!list.length) return 0;
    return Math.min(selectedIndex, list.length - 1);
  }, [list.length, selectedIndex]);

  const currentSafe = list[safeSelectedIndex];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">AI Questions Preview</h1>
            <p className="text-slate-500 mt-1">
              Game Code: <span className="font-semibold">{gameCode}</span>
            </p>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition font-semibold"
          >
            Back
          </button>
        </div>

        {/* Difficulty Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setDifficulty(t.key);
                setSelectedIndex(0);
              }}
              className={[
                "px-4 py-2 rounded-2xl border transition font-semibold",
                difficulty === t.key
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: questions list */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 h-[520px] overflow-y-auto">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">
              Questions ({list.length})
            </p>

            {list.length === 0 ? (
              <div className="text-slate-500 text-sm">No questions found.</div>
            ) : (
              <div className="space-y-2">
                {list.map((q, idx) => (
                  <button
                    key={q.id ?? `${difficulty}-${idx}`}
                    onClick={() => setSelectedIndex(idx)}
                    className={[
                      "w-full text-left px-4 py-3 rounded-2xl border transition",
                      safeSelectedIndex === idx
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    Q{idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Center: question + answers */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6">
            {!currentSafe ? (
              <div className="text-slate-500">Select a question to preview.</div>
            ) : (
              <>
                <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">
                  {difficulty.toUpperCase()} • Question {safeSelectedIndex + 1}
                </p>

                <h2 className="text-xl font-bold mb-6">{currentSafe.q}</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(currentSafe.choices || []).map((choice, i) => {
                    const isCorrect = i === currentSafe.correctIndex;

                    return (
                      <div
                        key={`${choice}-${i}`}
                        className={[
                          "rounded-2xl border px-4 py-3",
                          isCorrect
                            ? "border-emerald-400 bg-emerald-50"
                            : "border-slate-200 bg-white",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">
                            {String.fromCharCode(65 + i)}.
                          </span>
                          {isCorrect ? (
                            <span className="text-emerald-600 font-semibold text-sm">
                              Correct
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-slate-900">{choice}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuestionsPreview;