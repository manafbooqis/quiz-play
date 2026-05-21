import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

/**
 * Checks whether a session should show final results.
 * @param {object} session - Session row from Supabase.
 * @returns {boolean} True when the quiz has finished.
 */
function isFinalSessionStatus(session) {
  return session?.status === "finished" || session?.current_phase === "final_results";
}

/**
 * Checks whether a session should show round results.
 * @param {object} session - Session row from Supabase.
 * @returns {boolean} True when round results are active.
 */
function isRoundResultsSessionStatus(session) {
  return (
    session?.status === "round_results" ||
    session?.current_phase === "round_results" ||
    session?.show_round_results === true
  );
}

// Keeps a student on a waiting screen after submitting an answer.
function WaitingForOthers() {
  const navigate = useNavigate();
  const { state } = useLocation();
  
  const studentName = state?.studentName ?? "";
  const gameCode = state?.gameCode ?? "";
  const sessionId = state?.sessionId ?? "";
  const currentRound = state?.currentRound ?? 1;
  const savedSessionRaw = gameCode ? localStorage.getItem(`quizplay_session_${gameCode}`) : null;
  const savedSession = savedSessionRaw ? JSON.parse(savedSessionRaw) : null;
  const savedPlayerId = gameCode && studentName ? localStorage.getItem(`quizplay_player_${gameCode}_${studentName}`) : "";
  const playerId =
    state?.playerId ||
    state?.sessionPlayerId ||
    savedSession?.playerId ||
    savedSession?.sessionPlayerId ||
    savedPlayerId ||
    studentName;
  
  const [sessionData, setSessionData] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);

  // Builds the navigation payload for the shared round-results page.
  const buildRoundResultsState = useCallback((session) => ({
    ...state,
    studentName,
    playerId,
    sessionPlayerId: playerId,
    gameCode: session?.game_code || gameCode,
    sessionId: session?.id || sessionId,
    currentRound: session?.current_round || currentRound,
  }), [state, studentName, playerId, gameCode, sessionId, currentRound]);

  // Loads session progress and subscribes to phase and response changes.
  useEffect(() => {
    if (!gameCode || !studentName) {
      navigate("/student/join");
      return;
    }

    // Loads initial session data plus current response counts.
    async function loadSession() {
      try {
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("game_code", gameCode)
          .single();

        if (sessionError) throw sessionError;
        setSessionData(session);

        if (isFinalSessionStatus(session)) {
          navigate("/student/final-results", {
            state: {
              studentName,
              playerId,
              sessionPlayerId: playerId,
              gameCode: session.game_code || gameCode,
              sessionId: session.id,
            },
            replace: true,
          });
          return;
        }

        if (isRoundResultsSessionStatus(session)) {
          navigate("/student/round-results", {
            state: buildRoundResultsState(session),
          });
          return;
        }

        // Load students count
        const { data: players, error: playersError } = await supabase
          .from("session_players")
          .select("*")
          .eq("session_id", session.id);

        if (playersError) throw playersError;
        setTotalStudents(players?.length || 0);

        // Load current round responses
        const { data: responses, error: responsesError } = await supabase
          .from("responses")
          .select("*")
          .eq("session_id", session.id)
          .eq("round_number", session.current_round || 1);

        if (responsesError) throw responsesError;
        setAnsweredCount(responses?.length || 0);

      } catch (err) {
        console.error("Error loading session:", err);
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
        const updatedSession = payload.new;
        setSessionData(prev => ({ ...prev, ...updatedSession }));

        // Navigate based on status changes
        if (isFinalSessionStatus(updatedSession)) {
          navigate("/student/final-results", {
            state: {
              studentName,
              playerId,
              sessionPlayerId: playerId,
              gameCode: updatedSession.game_code || gameCode,
              sessionId: updatedSession.id
            },
            replace: true,
          });
        } else if (isRoundResultsSessionStatus(updatedSession)) {
          navigate("/student/round-results", {
            state: buildRoundResultsState(updatedSession)
          });
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'responses',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAnsweredCount(prev => prev + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [gameCode, studentName, sessionId, navigate, playerId, buildRoundResultsState]);

  // Polls session phase as a fallback when realtime updates lag.
  useEffect(() => {
    if (!gameCode || !studentName) return undefined;

    // Refreshes session phase and redirects when results become available.
    const pollSessionPhase = async () => {
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .select("*")
        .eq("game_code", gameCode)
        .maybeSingle();

      if (sessionError || !session) {
        return;
      }

      setSessionData(session);

      if (isFinalSessionStatus(session)) {
        navigate("/student/final-results", {
          state: {
            studentName,
            playerId,
            sessionPlayerId: playerId,
            gameCode: session.game_code || gameCode,
            sessionId: session.id,
          },
          replace: true,
        });
        return;
      }

      if (isRoundResultsSessionStatus(session)) {
        navigate("/student/round-results", {
          state: buildRoundResultsState(session),
        });
      }
    };

    const interval = setInterval(pollSessionPhase, 1500);
    return () => clearInterval(interval);
  }, [
    gameCode,
    studentName,
    playerId,
    navigate,
    buildRoundResultsState,
  ]);

  // Updates the remaining question time while the student waits.
  useEffect(() => {
    if (sessionData?.current_question_ends_at) {
      const interval = setInterval(() => {
        const now = new Date();
        const endTime = new Date(sessionData.current_question_ends_at);
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeRemaining(remaining);

      }, 1000);

      return () => clearInterval(interval);
    }
  }, [
    sessionData?.current_question_ends_at,
    sessionData?.status,
    sessionData?.id,
    sessionData?.current_round,
    navigate,
    studentName,
    gameCode,
    playerId,
  ]);

  // Formats remaining seconds for the waiting timer display.
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6 py-4">
      <div className="w-full max-w-2xl bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-5 md:p-6 text-center">
        <div className="mb-5">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="game-font text-2xl md:text-3xl text-cyan-300 mb-3">Waiting for Others</h1>
          <p className="text-slate-300 text-base md:text-lg">
            Your answer has been submitted! Waiting for other students to complete the question.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
            <div className="text-2xl md:text-3xl font-bold text-cyan-300 mb-1">
              {answeredCount} / {totalStudents}
            </div>
            <p className="text-slate-400">Students Answered</p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
            <div className="text-2xl md:text-3xl font-bold text-yellow-300 mb-1">
              {formatTime(timeRemaining)}
            </div>
            <p className="text-slate-400">Time Remaining</p>
          </div>
        </div>

        <div className="mb-5">
          <div className="w-full bg-slate-700 rounded-full h-3 mb-3">
            <div 
              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${totalStudents > 0 ? (answeredCount / totalStudents) * 100 : 0}%` }}
            />
          </div>
          <p className="text-slate-400 text-sm">
            {totalStudents > 0 ? Math.round((answeredCount / totalStudents) * 100) : 0}% completed
          </p>
        </div>

        <div className="space-y-3">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
            <h3 className="text-lg font-semibold text-cyan-300 mb-2">Round {currentRound}</h3>
            <p className="text-slate-400">Current question in progress</p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
            <h3 className="text-lg font-semibold text-cyan-300 mb-2">Game Code</h3>
            <p className="text-2xl font-bold text-yellow-300">{gameCode}</p>
          </div>
        </div>

        <div className="mt-5 p-3 rounded-2xl border border-cyan-200 bg-cyan-900/20">
          <p className="text-cyan-200 text-sm">
            <span className="font-semibold">Tip:</span> Stay on this page. You'll automatically move to the results when everyone has answered or time runs out.
          </p>
        </div>
      </div>
    </div>
  );
}

export default WaitingForOthers;
