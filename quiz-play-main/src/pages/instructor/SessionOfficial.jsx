import { useLocation, useNavigate } from "react-router-dom";

function SessionOfficial() {
  const navigate = useNavigate();
  const { state } = useLocation();

  if (!state?.gameCode) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            No session data found
          </h1>
          <p className="text-slate-500 mb-6">
            Please go back to the setup page and create a session first.
          </p>
          <button
            onClick={() => navigate("/instructor/dashboard-official")}
            className="w-full px-5 py-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 transition font-bold"
          >
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  const {
    gameCode,
    fileName: fileNameFromState,
    questionCount: questionCountFromState,
    timePerQuestion: timePerQuestionFromState,
    studentsJoined,
  } = state;

  const raw = localStorage.getItem(`quizplay_session_${gameCode}`);
  const session = raw ? JSON.parse(raw) : null;

  const fileName = fileNameFromState ?? session?.fileName ?? "No file uploaded";
  const questionCount = questionCountFromState ?? session?.questionCount ?? 5;
  const timePerQuestion =
    timePerQuestionFromState ?? session?.timePerQuestion ?? 5;

  const students =
    session?.players?.length
      ? session.players
      : studentsJoined > 0
      ? ["Radi", "Sara", "Fahad"]
      : [];

  function handleStartQuiz() {
    if (students.length === 0) return;

    navigate("/instructor/live-official", {
      state: {
        gameCode,
        fileName,
        questionCount,
        timePerQuestion,
        students,
      },
    });
  }

  function handleBackToSetup() {
    navigate("/instructor/dashboard-official");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Session Summary */}
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
            <h2 className="text-2xl font-bold mb-6">Session Summary</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  File Name
                </p>
                <p className="font-semibold text-slate-900 break-words">
                  {fileName}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  Game Code
                </p>
                <p className="text-2xl font-extrabold tracking-[0.15em] text-slate-900">
                  {gameCode}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  Number of Questions
                </p>
                <p className="text-2xl font-bold text-slate-900">
                  {questionCount}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  Time per Question
                </p>
                <p className="text-2xl font-bold text-slate-900">
                  {timePerQuestion}s
                </p>
              </div>
            </div>
          </div>

          {/* Session Controls */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-7 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Session Controls
            </p>

            <div className="mt-6 rounded-3xl bg-slate-50 border border-slate-200 p-5 mb-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Students Joined
              </p>

              <div className="mt-3 flex items-end justify-between">
                <p className="text-4xl font-extrabold text-slate-900">
                  {students.length}
                </p>
                <p className="text-sm text-slate-500">
                  {students.length === 1 ? "student" : "students"}
                </p>
              </div>
            </div>

            <button
              onClick={handleStartQuiz}
              disabled={students.length === 0}
              className={[
                "w-full px-5 py-3.5 rounded-2xl transition font-bold",
                students.length > 0
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed",
              ].join(" ")}
            >
              Start Quiz
            </button>

            <button
              onClick={() =>
                navigate("/instructor/questions-preview", {
                  state: { ...state, gameCode },
                })
              }
              className="w-full mt-3 px-5 py-3.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition font-semibold"
            >
              Preview Questions
            </button>

            <button
              onClick={handleBackToSetup}
              className="w-full mt-3 px-5 py-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition font-semibold"
            >
              Back to Setup
            </button>
          </div>
        </div>

        {/* Students Box */}
        <div className="mt-6 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl font-bold">Joined Students</h2>
            <span className="text-sm text-slate-500">
              {students.length} {students.length === 1 ? "student" : "students"}
            </span>
          </div>

          {students.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-slate-500">No students joined yet.</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {students.map((student, index) => (
                  <div
                    key={`${student}-${index}`}
                    className="rounded-2xl bg-white border border-slate-200 px-4 py-3"
                  >
                    <p className="font-medium text-slate-900">{student}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        
      </div>
    </div>
  );
}

export default SessionOfficial;