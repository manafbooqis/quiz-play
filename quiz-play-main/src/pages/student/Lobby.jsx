import { useLocation, useNavigate } from "react-router-dom";

function Lobby() {
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

  const { studentName, gameCode } = state;

  // Read instructor config (questionCount + timePerQuestion + players)
  const raw = localStorage.getItem(`quizplay_session_${gameCode}`);
  const config = raw ? JSON.parse(raw) : null;

  const totalQuestions = config?.questionCount ?? 3;
  const timePerQuestion = config?.timePerQuestion ?? 15;

  const players = config?.players
    ? [...config.players, studentName]
    : ["Radi", "Sara", "Fahad", studentName];

  const startQuiz = () => {
    navigate("/student/difficulty", {
      state: {
        studentName,
        gameCode,
        totalQuestions,
        timePerQuestion,
        players, // نفس أسماء الاختبار
        totalPoints: 0,
        totalAnswered: 0,
        usedCounts: { easy: 0, medium: 0, hard: 0 },
        answersStatus: [],
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-2xl bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="game-font text-3xl text-cyan-300">Waiting Room</h1>
            <p className="text-slate-300 mt-2">
              Hi <span className="text-white font-semibold">{studentName}</span>
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Questions: {totalQuestions} • Time: {timePerQuestion}s
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-600 rounded-2xl px-5 py-4 text-center">
            <p className="text-slate-300 text-sm">Game Code</p>
            <p className="game-font text-3xl text-yellow-300 mt-1">{gameCode}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
          <p className="text-slate-300">
            Waiting for the instructor to start the quiz...
          </p>
          <div className="mt-4 h-2 w-full bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-cyan-400 animate-pulse" />
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="game-font text-2xl text-pink-300">Players</h2>
          <span className="text-slate-300 text-sm">{players.length} joined</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {players.map((p, idx) => (
            <div
              key={`${p}-${idx}`}
              className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3"
            >
              <span className="text-white">{p}</span>
            </div>
          ))}
        </div>

        {/* Temporary start button (later instructor triggers this) */}
        <button
          onClick={startQuiz}
          className="w-full mt-8 game-font bg-yellow-300 hover:bg-yellow-200 text-slate-900 py-3 rounded-xl transition"
        >
          Start Quiz (Temporary)
        </button>

        <button
          onClick={() => navigate("/")}
          className="w-full mt-3 bg-transparent border border-slate-600 hover:bg-slate-700 py-3 rounded-xl transition"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default Lobby;