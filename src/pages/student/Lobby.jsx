import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function getTextValue(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function getStudentName(student, index) {
  if (!student) {
    return `Student ${index + 1}`;
  }

  if (typeof student === "string") {
    return student;
  }

  if (typeof student !== "object") {
    return `Student ${index + 1}`;
  }

  const candidates = [
    student.student_name,
    student.name,
    student.full_name,
    student.nickname,
    student.display_name,
  ];

  for (const candidate of candidates) {
    const text = getTextValue(candidate);
    if (text) return text;
  }

  return `Student ${index + 1}`;
}

function Lobby() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [sessionData, setSessionData] = useState(null);

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

  // Setup real-time session monitoring
  useEffect(() => {
    if (!gameCode) return;

    // Load initial session data
    async function loadSession() {
      try {
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("game_code", gameCode)
          .single();

        if (sessionError && sessionError.code !== 'PGRST116') {
          console.error("Session error:", sessionError);
          return;
        }

        if (session) {
          setSessionData(session);
          console.log("Lobby session status:", session.status);
          console.log("Lobby current question:", session.current_question_id);

          // If session is already active, navigate to question page
          if (session.status === "active") {
            const saved = localStorage.getItem(`quizplay_session_${gameCode}`);
            const savedSession = saved ? JSON.parse(saved) : null;
            const questionsByDifficulty = savedSession?.questionsByDifficulty || savedSession?.questions_by_difficulty || session.questions_by_difficulty;
            
            console.log("Navigating student to difficulty page (initial load)");
            navigate("/student/difficulty", {
              state: {
                studentName,
                gameCode,
                sessionId: session.id,
                currentRound: session.current_round || 1,
                currentQuestionId: session.current_question_id,
                currentDifficulty: session.current_difficulty,
                questionsByDifficulty
              }
            });
          }
        }
      } catch (err) {
        console.error("Error loading session:", JSON.stringify(err, null, 2));
        console.error("Message:", err.message);
        console.error("Details:", err.details);
        console.error("Hint:", err.hint);
        console.error("Code:", err.code);
      }
    }

    loadSession();

    // Setup real-time subscription
    const subscription = supabase
      .channel(`session-${gameCode}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `game_code=eq.${gameCode}`
      }, (payload) => {
        console.log("Lobby received session update:", payload);
        const updatedSession = payload.new;
        setSessionData(updatedSession);
        console.log("Lobby updated session status:", updatedSession.status);
        console.log("Lobby updated current question:", updatedSession.current_question_id);

        // Auto-navigate when quiz starts
        if (updatedSession.status === "active" && updatedSession.current_question_id) {
          const saved = localStorage.getItem(`quizplay_session_${gameCode}`);
          const savedSession = saved ? JSON.parse(saved) : null;
          const questionsByDifficulty = savedSession?.questionsByDifficulty || savedSession?.questions_by_difficulty || updatedSession.questions_by_difficulty;

          console.log("Lobby navigating to difficulty page");
          console.log("Lobby gameCode:", gameCode);
          console.log("Lobby loaded session:", updatedSession);
          console.log("Lobby session status:", updatedSession.status);
          console.log("Lobby current question:", updatedSession.current_question_id);
          console.log("Lobby navigating to difficulty");
          
          navigate("/student/difficulty", {
            state: {
              studentName,
              gameCode,
              sessionId: updatedSession.id,
              currentRound: updatedSession.current_round || 1,
              currentQuestionId: updatedSession.current_question_id,
              currentDifficulty: updatedSession.current_difficulty,
              questionsByDifficulty
            }
          });
        }
      })
      .subscribe();

    // Fallback polling in case real-time doesn't fire
    const pollingInterval = setInterval(async () => {
      try {
        const { data: session, error: pollError } = await supabase
          .from("sessions")
          .select("id, game_code, status, current_question_id, current_difficulty, current_round")
          .eq("game_code", gameCode)
          .single();

        if (!pollError && session) {
          console.log("Lobby polling session:", session);
          if (session.status === "active" && session.current_question_id) {
            const saved = localStorage.getItem(`quizplay_session_${gameCode}`);
            const savedSession = saved ? JSON.parse(saved) : null;
            const questionsByDifficulty = savedSession?.questionsByDifficulty || savedSession?.questions_by_difficulty;

            console.log("Lobby polling: navigating to difficulty page");
            navigate("/student/difficulty", {
              state: {
                studentName,
                gameCode,
                sessionId: session.id,
                currentRound: session.current_round || 1,
                currentQuestionId: session.current_question_id,
                currentDifficulty: session.current_difficulty,
                questionsByDifficulty
              }
            });
          }
        }
      } catch (err) {
        console.error("Lobby polling error:", err);
      }
    }, 2000);

    return () => {
      supabase.removeChannel(subscription);
      clearInterval(pollingInterval);
    };
  }, [gameCode, studentName, navigate]);

  // Read instructor config (questionCount + timePerQuestion + players)
  const raw = localStorage.getItem(`quizplay_session_${gameCode}`);
  const config = raw ? JSON.parse(raw) : null;

  const totalQuestions = config?.questionCount ?? 3;
  const timePerQuestion = config?.timePerQuestion ?? 15;

  const normalizePlayers = (playersArray) => {
  if (!Array.isArray(playersArray)) return [];
  return playersArray.map((player, index) => getStudentName(player, index));
};

const players = Array.from(
  new Set([
    ...(config?.players ? normalizePlayers(config.players) : ["Radi", "Sara", "Fahad"]),
    studentName,
  ])
);

  return (
  <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
    {/* background */}
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(236,72,153,0.18),_transparent_35%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#020617_100%)]" />

    {/* floating particles */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-20 left-20 h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
      <div className="absolute top-36 right-28 h-2 w-2 rounded-full bg-pink-400 animate-pulse" />
      <div className="absolute bottom-28 left-1/4 h-1.5 w-1.5 rounded-full bg-cyan-300 animate-bounce" />
      <div className="absolute bottom-40 right-1/4 h-1.5 w-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
    </div>

    {/* HUD borders */}
    <div className="pointer-events-none absolute inset-0 opacity-30">
      <div className="absolute inset-6 rounded-[36px] border border-cyan-500/20" />
      <div className="absolute inset-10 rounded-[32px] border border-pink-500/10 animate-pulse" />
    </div>

    <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-3xl rounded-[30px] border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
        {/* top section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-8">
          <div>
            <p className="text-xs tracking-[0.35em] text-cyan-300 uppercase animate-pulse">
              Multiplayer Lobby
            </p>

            <h1 className="game-font text-4xl md:text-5xl mt-2 text-cyan-300 font-black drop-shadow-[0_0_18px_rgba(34,211,238,0.75)]">
              Waiting Room
            </h1>

            <p className="text-slate-300 mt-3">
              Welcome back{" "}
              <span className="font-bold text-white">{studentName}</span>
            </p>

            <p className="text-slate-400 text-sm mt-1">
              Questions: {totalQuestions} • Time: {timePerQuestion}s
            </p>
          </div>

          <div className="rounded-3xl border border-cyan-500/20 bg-slate-950/80 px-6 py-5 text-center shadow-[0_0_20px_rgba(34,211,238,0.08)]">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
              Game Code
            </p>

            <p className="game-font text-4xl mt-2 tracking-[0.28em] text-yellow-300">
              {gameCode}
            </p>
          </div>
        </div>

        {/* waiting status */}
        <div className="rounded-3xl border border-cyan-500/15 bg-slate-950/70 p-6 mb-7">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
            <p className="font-semibold text-cyan-200">
              Waiting for instructor to start the quiz...
            </p>
          </div>

          <div className="mt-5 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full w-1/2 bg-cyan-400 animate-pulse" />
          </div>

          <p className="text-xs text-slate-500 mt-3">
            Stay ready — the game can begin at any moment.
          </p>
        </div>

        {/* players */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="game-font text-2xl text-pink-300">Players</h2>

          <div className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-slate-300">
            {players.length} joined
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {players.map((p, idx) => {
            const name = getStudentName(p, idx);
            const isCurrentUser = name === studentName;

            return (
              <div
                key={`${name}-${idx}`}
                className={[
                  "rounded-2xl border px-4 py-4 transition",
                  isCurrentUser
                    ? "border-cyan-400/30 bg-cyan-500/10 shadow-[0_0_18px_rgba(34,211,238,0.08)]"
                    : "border-white/5 bg-white/5 hover:bg-white/10",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{name}</span>

                  {isCurrentUser && (
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                      You
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* bottom action */}
        <button
          onClick={() => navigate("/")}
          className="w-full mt-7 rounded-2xl border border-white/10 bg-white/5 py-3 font-semibold text-slate-200 transition hover:bg-white/10"
        >
          Leave Lobby
        </button>
      </div>
    </div>
  </div>
);
}

export default Lobby;
