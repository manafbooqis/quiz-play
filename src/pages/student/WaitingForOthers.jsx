import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function isFinalSessionStatus(session) {
  return session?.status === "finished" || session?.current_phase === "final_results";
}

function WaitingForOthers() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const locationState = state || {};
  
  const studentName = locationState.studentName ?? "";
  const gameCode = locationState.gameCode ?? "";
  const sessionId = locationState.sessionId ?? "";
  const currentRound = locationState.currentRound ?? 1;
  const savedSessionRaw = gameCode ? localStorage.getItem(`quizplay_session_${gameCode}`) : null;
  const savedSession = savedSessionRaw ? JSON.parse(savedSessionRaw) : null;
  const savedPlayerId = gameCode && studentName ? localStorage.getItem(`quizplay_player_${gameCode}_${studentName}`) : "";
  const playerId =
    locationState.playerId ||
    locationState.sessionPlayerId ||
    savedSession?.playerId ||
    savedSession?.sessionPlayerId ||
    savedPlayerId ||
    studentName;
  
  const [sessionData, setSessionData] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [answeredStudents, setAnsweredStudents] = useState([]);
  const [waitingStudents, setWaitingStudents] = useState([]);
  
  const navDoneRef = useRef(false);

  useEffect(() => {
    if (!gameCode || !studentName) {
      navigate("/student/join");
      return;
    }

    let isMounted = true;

    // Polling function
    async function checkStatus() {
      if (!isMounted) return;
      try {
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("game_code", gameCode)
          .single();

        if (sessionError) throw sessionError;
        if (!isMounted) return;
        setSessionData(session);

        if (isFinalSessionStatus(session)) {
          if (!navDoneRef.current) {
            navDoneRef.current = true;
            navigate("/student/final-results", {
              state: {
                ...locationState,
                studentName,
                playerId,
                sessionPlayerId: playerId,
                gameCode: session.game_code || gameCode,
                sessionId: session.id,
              },
              replace: true,
            });
          }
          return;
        }

        // Load students count
        const { data: players, error: playersError } = await supabase
          .from("session_players")
          .select("*")
          .eq("session_id", session.id);

        if (playersError) throw playersError;

        // Load current round responses
        const { data: responses, error: responsesError } = await supabase
          .from("responses")
          .select("*")
          .eq("session_id", session.id)
          .eq("round_number", session.current_round || currentRound);

        if (responsesError) throw responsesError;

        if (isMounted) {
          setTotalStudents(players?.length || 0);
          setAnsweredCount(responses?.length || 0);

          const answered = [];
          const waiting = [];

          players?.forEach(p => {
            const hasAnswered = responses?.some(r => r.player_id === p.id || r.player_id === p.student_name);
            if (hasAnswered) {
              answered.push(p);
            } else {
              waiting.push(p);
            }
          });

          setAnsweredStudents(answered);
          setWaitingStudents(waiting);

          // Check if we should transition
          const allAnswered = players?.length > 0 && responses?.length >= players?.length;
          
          if ((allAnswered || session.status === "round_results") && !navDoneRef.current) {
            navDoneRef.current = true;
            navigate("/student/round-results", {
              state: {
                ...locationState,
                studentName,
                playerId,
                sessionPlayerId: playerId,
                gameCode,
                sessionId: session.id,
                currentRound: session.current_round || currentRound
              }
            });
          }
        }

      } catch (err) {
        console.error("Error loading session status:", err);
      }
    }

    checkStatus();
    const pollInterval = setInterval(checkStatus, 1000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [gameCode, studentName, sessionId, navigate, playerId, currentRound, locationState]);

  // Update timer strictly for display
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
  }, [sessionData?.current_question_ends_at]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center px-6 py-4 relative overflow-hidden">
      {/* Background styling to match project */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-cyan-400/5 via-transparent to-pink-400/5 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute inset-0 bg-gradient-radial from-cyan-400/8 via-transparent to-transparent opacity-60" style={{ background: 'radial-gradient(circle at 30% 50%, rgba(6, 182, 212, 0.08) 0%, transparent 50%)' }} />
      </div>

      <div className="w-full max-w-4xl bg-slate-800/80 backdrop-blur-xl border border-slate-600/50 rounded-3xl shadow-2xl p-6 md:p-8 z-10">
        <div className="mb-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="game-font text-3xl md:text-4xl text-cyan-300 mb-2 drop-shadow-md">Answer Submitted!</h1>
          <p className="text-slate-300 text-lg md:text-xl">
            Waiting for other students...
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 text-center relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10" />
            <div className="text-3xl md:text-4xl font-bold text-cyan-300 mb-2 relative z-10">
              {answeredCount} / {totalStudents}
            </div>
            <p className="text-slate-400 text-sm uppercase tracking-wider font-semibold relative z-10">Students Answered</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-amber-500/10" />
            <div className="text-3xl md:text-4xl font-bold text-yellow-300 mb-2 relative z-10 animate-pulse">
              {formatTime(timeRemaining)}
            </div>
            <p className="text-slate-400 text-sm uppercase tracking-wider font-semibold relative z-10">Time Remaining</p>
          </div>
        </div>

        <div className="mb-8">
          <div className="w-full bg-slate-900/80 rounded-full h-4 mb-3 border border-slate-700 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-400 h-full rounded-full transition-all duration-700 relative"
              style={{ width: `${totalStudents > 0 ? (answeredCount / totalStudents) * 100 : 0}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Students Status Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Answered Students */}
          <div className="relative bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-emerald-400/30">
            <div className="absolute inset-0 bg-emerald-400/5 rounded-2xl" />
            <div className="relative z-10">
              <p className="font-bold text-emerald-300 mb-3 flex items-center gap-2 text-lg">
                <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                Answered ({answeredStudents.length})
              </p>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {answeredStudents.map(student => (
                  <div key={student.id || student.student_name} className="px-3 py-2 rounded-xl bg-emerald-900/20 border border-emerald-800/40 text-emerald-200">
                    {student.student_name} {(student.id === playerId || student.student_name === studentName) && "(You)"}
                  </div>
                ))}
                {answeredStudents.length === 0 && <p className="text-slate-500 text-sm italic">No one has answered yet</p>}
              </div>
            </div>
          </div>

          {/* Waiting Students */}
          <div className="relative bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-amber-400/30">
            <div className="absolute inset-0 bg-amber-400/5 rounded-2xl" />
            <div className="relative z-10">
              <p className="font-bold text-amber-300 mb-3 flex items-center gap-2 text-lg">
                <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]"></span>
                Waiting ({waitingStudents.length})
              </p>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {waitingStudents.map(student => (
                  <div key={student.id || student.student_name} className="px-3 py-2 rounded-xl bg-amber-900/20 border border-amber-800/40 text-amber-200">
                    {student.student_name} {(student.id === playerId || student.student_name === studentName) && "(You)"}
                  </div>
                ))}
                {waitingStudents.length === 0 && <p className="text-slate-500 text-sm italic">Everyone has answered</p>}
              </div>
            </div>
          </div>
        </div>
        
        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(15, 23, 42, 0.5);
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(71, 85, 105, 0.8);
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(100, 116, 139, 1);
          }
        `}} />
      </div>
    </div>
  );
}

export default WaitingForOthers;
