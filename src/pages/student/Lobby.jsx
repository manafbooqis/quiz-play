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

  // Clear any existing round timers when entering lobby
  useEffect(() => {
    const studentName = state?.studentName;
    const gameCode = state?.gameCode;
    
    if (studentName && gameCode) {
      const timerKey = `quizplay_round_timer_${gameCode}_${studentName}`;
      localStorage.removeItem(timerKey);
    }
  }, [state?.studentName, state?.gameCode]);

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
                questionsByDifficulty,
                timePerQuestion,
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
                questionsByDifficulty,
                timePerQuestion,
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

  const totalQuestions =
    config?.questionCount ?? config?.question_count ?? 3;
  const timePerQuestion =
    config?.timePerQuestion ?? config?.time_per_question ?? 15;

  const normalizePlayers = (playersArray) => {
    if (!Array.isArray(playersArray)) return [];
    return playersArray.map((player, index) => getStudentName(player, index));
  };

  // Only show real players — never use fake fallback names
  const players = config?.players
      ? [...new Set([...normalizePlayers(config.players), studentName])]
      : [studentName];

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
              Quiz rounds: {totalQuestions} • Time per question:{" "}
              {timePerQuestion}s
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

        <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3">
          <p className="text-white">You joined as: {studentName}</p>
          <p className="text-slate-400 text-sm mt-2">Other players are hidden for privacy.</p>
        </div>

        {/* Waiting for instructor to start the quiz */}

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
