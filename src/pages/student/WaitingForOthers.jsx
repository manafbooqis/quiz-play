import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function WaitingForOthers() {
  const navigate = useNavigate();
  const { state } = useLocation();
  
  const studentName = state?.studentName ?? "";
  const gameCode = state?.gameCode ?? "";
  const sessionId = state?.sessionId ?? "";
  const currentRound = state?.currentRound ?? 1;
  
  const [sessionData, setSessionData] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    if (!gameCode || !studentName) {
      navigate("/student/join");
      return;
    }

    // Load initial session data
    async function loadSession() {
      try {
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("game_code", gameCode)
          .single();

        if (sessionError) throw sessionError;
        setSessionData(session);

        if (session.status === "finished" || session.current_phase === "final_results") {
          navigate("/student/final-results", {
            state: {
              studentName,
              gameCode: session.game_code || gameCode,
              sessionId: session.id,
            },
            replace: true,
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
        if (updatedSession.status === "round_results") {
          navigate("/student/round-results", {
            state: {
              studentName,
              gameCode,
              sessionId: updatedSession.id,
              currentRound: updatedSession.current_round
            }
          });
        } else if (updatedSession.status === "finished") {
          navigate("/student/final-results", {
            state: {
              studentName,
              gameCode,
              sessionId: updatedSession.id
            }
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
  }, [gameCode, studentName, sessionId, navigate]);

  // Update timer
  useEffect(() => {
    if (sessionData?.current_question_ends_at) {
      const interval = setInterval(() => {
        const now = new Date();
        const endTime = new Date(sessionData.current_question_ends_at);
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeRemaining(remaining);

        if (remaining === 0 && sessionData.status === "active") {
          // Time's up, navigate to round results
          navigate("/student/round-results", {
            state: {
              studentName,
              gameCode,
              sessionId: sessionData.id,
              currentRound: sessionData.current_round
            }
          });
        }
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
  ]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-2xl bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-cyan-500 flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="game-font text-3xl text-cyan-300 mb-4">Waiting for Others</h1>
          <p className="text-slate-300 text-lg">
            Your answer has been submitted! Waiting for other students to complete the question.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
            <div className="text-3xl font-bold text-cyan-300 mb-2">
              {answeredCount} / {totalStudents}
            </div>
            <p className="text-slate-400">Students Answered</p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
            <div className="text-3xl font-bold text-yellow-300 mb-2">
              {formatTime(timeRemaining)}
            </div>
            <p className="text-slate-400">Time Remaining</p>
          </div>
        </div>

        <div className="mb-8">
          <div className="w-full bg-slate-700 rounded-full h-3 mb-4">
            <div 
              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${totalStudents > 0 ? (answeredCount / totalStudents) * 100 : 0}%` }}
            />
          </div>
          <p className="text-slate-400 text-sm">
            {totalStudents > 0 ? Math.round((answeredCount / totalStudents) * 100) : 0}% completed
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
            <h3 className="text-lg font-semibold text-cyan-300 mb-2">Round {currentRound}</h3>
            <p className="text-slate-400">Current question in progress</p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
            <h3 className="text-lg font-semibold text-cyan-300 mb-2">Game Code</h3>
            <p className="text-2xl font-bold text-yellow-300">{gameCode}</p>
          </div>
        </div>

        <div className="mt-8 p-4 rounded-2xl border border-cyan-200 bg-cyan-900/20">
          <p className="text-cyan-200 text-sm">
            <span className="font-semibold">Tip:</span> Stay on this page. You'll automatically move to the results when everyone has answered or time runs out.
          </p>
        </div>
      </div>
    </div>
  );
}

export default WaitingForOthers;
