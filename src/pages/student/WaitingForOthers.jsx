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

  const allReady = totalStudents > 0 && answeredCount >= totalStudents;

  return (
    <>
      {/* Rich Racing Background from RoundResults */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-t from-cyan-400/5 via-transparent to-pink-400/5 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute inset-0 bg-gradient-radial from-cyan-400/8 via-transparent to-transparent opacity-60" style={{ background: 'radial-gradient(circle at 30% 50%, rgba(6, 182, 212, 0.08) 0%, transparent 50%)' }} />
        <div className="absolute inset-0 bg-gradient-radial from-pink-400/8 via-transparent to-transparent opacity-60" style={{ background: 'radial-gradient(circle at 70% 50%, rgba(236, 72, 153, 0.08) 0%, transparent 50%)' }} />
        <div className="absolute inset-0 bg-gradient-radial from-yellow-400/4 via-transparent to-transparent opacity-50" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(250, 204, 21, 0.04) 0%, transparent 50%)' }} />
        
        <div className="absolute inset-0">
          <svg className="absolute top-0 left-0 w-1/3 h-full" viewBox="0 0 300 800" style={{ opacity: 0.7 }}>
            <defs>
              <linearGradient id="cyanTrack" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#0891b2" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0e7490" stopOpacity="0.4" />
              </linearGradient>
              <filter id="cyanGlow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <path d="M 50 100 Q 150 200 100 300 T 200 500 Q 250 600 150 700 L 100 800" stroke="url(#cyanTrack)" strokeWidth="8" fill="none" filter="url(#cyanGlow)" className="animate-pulse" style={{ animationDuration: '3s' }} />
            <path d="M 30 0 Q 130 200 30 400 T 50 800" stroke="#06b6d4" strokeWidth="4" fill="none" opacity="0.6" className="animate-pulse" style={{ animationDelay: '1s', animationDuration: '3s' }} />
            <path d="M 70 0 Q 170 200 70 400 T 90 800" stroke="#0891b2" strokeWidth="3" fill="none" opacity="0.4" className="animate-pulse" style={{ animationDelay: '2s', animationDuration: '3s' }} />
          </svg>
          
          <svg className="absolute top-0 right-0 w-1/3 h-full" viewBox="0 0 300 800" style={{ opacity: 0.6 }}>
            <defs>
              <linearGradient id="pinkTrack" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ec4899" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#db2777" stopOpacity="1" />
                <stop offset="100%" stopColor="#be185d" stopOpacity="0.5" />
              </linearGradient>
              <filter id="pinkGlow">
                <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <path d="M 250 100 Q 150 200 250 300 T 200 500 Q 150 600 250 700 L 200 800" stroke="url(#pinkTrack)" strokeWidth="8" fill="none" filter="url(#pinkGlow)" className="animate-pulse" style={{ animationDuration: '3s', animationDelay: '1.5s' }} />
            <path d="M 270 0 Q 170 200 270 400 T 250 800" stroke="#ec4899" strokeWidth="4" fill="none" opacity="0.6" className="animate-pulse" style={{ animationDelay: '2.5s', animationDuration: '3s' }} />
            <path d="M 230 0 Q 130 200 230 400 T 210 800" stroke="#db2777" strokeWidth="3" fill="none" opacity="0.4" className="animate-pulse" style={{ animationDelay: '3.5s', animationDuration: '3s' }} />
          </svg>
        </div>
        
        <div className="absolute top-1/4 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent animate-pulse" style={{ animationDuration: '2s' }} />
        <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-pink-400/60 to-transparent animate-pulse" style={{ animationDelay: '0.7s', animationDuration: '2s' }} />
        <div className="absolute top-3/4 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-yellow-300/40 to-transparent animate-pulse" style={{ animationDelay: '1.4s', animationDuration: '2s' }} />
      </div>

      <div className="fixed inset-0 bg-gradient-radial from-transparent via-slate-900/20 to-slate-900/40 pointer-events-none z-10" style={{ background: 'radial-gradient(circle at center, transparent 0%, rgba(15, 23, 42, 0.2) 50%, rgba(15, 23, 42, 0.4) 100%)' }} />

      <div className="relative min-h-screen flex items-center justify-center px-6 py-8 z-20">
        <div className="w-full max-w-4xl bg-slate-800/70 backdrop-blur-xl border-2 border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.15)] p-8 md:p-10">
        <div className="mb-10 text-center relative">
          {/* Subtle glow behind header */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/20 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-25" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-0 bg-teal-400 rounded-full animate-pulse opacity-30 blur-md" style={{ animationDuration: '3s' }} />
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 shadow-[0_0_30px_rgba(52,211,153,0.5)] flex items-center justify-center border-[3px] border-slate-800/80 backdrop-blur-sm">
              <svg className="w-12 h-12 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="game-font text-5xl md:text-6xl font-bold relative mb-4">
            <span className="absolute inset-0 blur-2xl bg-gradient-to-r from-emerald-400/50 via-cyan-400/40 to-emerald-400/50 animate-pulse" />
            <span className="relative bg-gradient-to-r from-emerald-300 via-cyan-200 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
              Answer Submitted!
            </span>
          </h1>
          <p className="text-cyan-100/80 text-xl md:text-2xl font-medium tracking-wide">
            Waiting for other students...
          </p>
        </div>

        {!allReady ? (
          <div className={`grid grid-cols-1 ${timeRemaining > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-8 mb-10`}>
            <div className="bg-slate-900/70 border-2 border-cyan-400/40 rounded-3xl p-6 text-center relative overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.15)] group">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/5 group-hover:from-cyan-500/30 transition-colors duration-500" />
              <div className="text-5xl md:text-6xl font-black text-cyan-300 mb-3 relative z-10 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                {answeredCount} <span className="text-3xl text-cyan-500/50">/</span> <span className="text-4xl text-cyan-200/80">{totalStudents}</span>
              </div>
              <div className="flex items-center justify-center gap-2 relative z-10">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                <p className="text-cyan-100 text-sm uppercase tracking-[0.2em] font-bold">Students Answered</p>
              </div>
            </div>

            <div className="bg-slate-900/70 border-2 border-amber-400/40 rounded-3xl p-6 text-center relative overflow-hidden shadow-[0_0_20px_rgba(251,191,36,0.15)] group">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-500/5 group-hover:from-amber-500/30 transition-colors duration-500" />
              <div className="text-5xl md:text-6xl font-black text-amber-300 mb-3 relative z-10 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]">
                {waitingStudents.length}
              </div>
              <div className="flex items-center justify-center gap-2 relative z-10">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]" style={{ animationDelay: '0.5s' }} />
                <p className="text-amber-100 text-sm uppercase tracking-[0.2em] font-bold">Waiting</p>
              </div>
            </div>

            {timeRemaining > 0 && (
              <div className="bg-slate-900/70 border-2 border-pink-400/40 rounded-3xl p-6 text-center relative overflow-hidden shadow-[0_0_20px_rgba(236,72,153,0.15)] group">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-rose-500/5 group-hover:from-pink-500/30 transition-colors duration-500" />
                <div className="text-5xl md:text-6xl font-black text-pink-300 mb-3 relative z-10 drop-shadow-[0_0_15px_rgba(236,72,153,0.5)]">
                  {formatTime(timeRemaining)}
                </div>
                <div className="flex items-center justify-center gap-2 relative z-10">
                  <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse shadow-[0_0_8px_rgba(236,72,153,0.8)]" style={{ animationDelay: '1s' }} />
                  <p className="text-pink-100 text-sm uppercase tracking-[0.2em] font-bold">Time Left</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gradient-to-r from-emerald-900/60 via-teal-900/60 to-emerald-900/60 border-2 border-emerald-400/60 rounded-3xl p-8 text-center mb-10 relative overflow-hidden shadow-[0_0_30px_rgba(52,211,153,0.2)]">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 via-teal-300/20 to-emerald-400/10 animate-pulse" style={{ animationDuration: '2s' }} />
            <h2 className="text-3xl md:text-4xl font-black text-emerald-300 mb-2 relative z-10 drop-shadow-md tracking-wide uppercase">All students are ready</h2>
            <p className="text-emerald-100/90 text-lg relative z-10 font-semibold tracking-wider">Moving to results...</p>
          </div>
        )}

        <div className="mb-10 relative">
          <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">
            <span>Progress</span>
            <span className={allReady ? "text-emerald-400" : "text-cyan-400"}>{totalStudents > 0 ? Math.round((answeredCount / totalStudents) * 100) : 0}%</span>
          </div>
          <div className="w-full bg-slate-900/90 rounded-full h-6 border border-slate-700/80 overflow-hidden shadow-inner p-1">
            <div 
              className={`h-full rounded-full transition-all duration-1000 relative flex items-center justify-end pr-2 ${allReady ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.5)]' : 'bg-gradient-to-r from-cyan-600 via-cyan-400 to-blue-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]'}`}
              style={{ width: `${totalStudents > 0 ? (answeredCount / totalStudents) * 100 : 0}%`, minWidth: '5%' }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" style={{ animationDuration: '1.5s' }} />
              <div className="w-2 h-2 rounded-full bg-white/80 shadow-[0_0_5px_white]" />
            </div>
          </div>
        </div>

        {/* Students Status Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Answered Students */}
          <div className="relative bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 border-2 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
            <div className="absolute inset-0 bg-cyan-500/5 rounded-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-cyan-500/20">
                <p className="font-bold text-cyan-300 text-xl flex items-center gap-3">
                  <span className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.8)]"></span>
                  Answered
                </p>
                <span className="bg-cyan-900/50 text-cyan-200 px-3 py-1 rounded-full text-sm font-bold border border-cyan-500/30">
                  {answeredStudents.length}
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-3">
                {answeredStudents.map(student => {
                  const isMe = student.id === playerId || student.student_name === studentName;
                  return (
                    <div 
                      key={student.id || student.student_name} 
                      className={`px-4 py-3 rounded-2xl flex items-center justify-between transition-all ${
                        isMe 
                          ? 'bg-cyan-900/60 border border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                          : 'bg-slate-800/80 border border-slate-700/80 hover:bg-slate-800'
                      }`}
                    >
                      <span className={`font-medium ${isMe ? 'text-cyan-100' : 'text-slate-200'}`}>
                        {student.student_name}
                      </span>
                      {isMe && (
                        <span className="text-xs font-black uppercase tracking-wider text-cyan-300 bg-cyan-950/80 px-2 py-1 rounded-md border border-cyan-500/50">
                          You
                        </span>
                      )}
                    </div>
                  );
                })}
                {answeredStudents.length === 0 && (
                  <div className="py-8 text-center text-slate-500/80 font-medium italic border-2 border-dashed border-slate-700/50 rounded-2xl">
                    Waiting for answers...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Waiting Students */}
          <div className="relative bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 border-2 border-amber-500/30 shadow-[0_0_20px_rgba(251,191,36,0.1)]">
            <div className="absolute inset-0 bg-amber-500/5 rounded-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-amber-500/20">
                <p className="font-bold text-amber-300 text-xl flex items-center gap-3">
                  <span className="w-3 h-3 bg-amber-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.8)]" style={{ animationDelay: '0.5s' }}></span>
                  Waiting
                </p>
                <span className="bg-amber-900/50 text-amber-200 px-3 py-1 rounded-full text-sm font-bold border border-amber-500/30">
                  {waitingStudents.length}
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-3">
                {waitingStudents.map(student => {
                  const isMe = student.id === playerId || student.student_name === studentName;
                  return (
                    <div 
                      key={student.id || student.student_name} 
                      className={`px-4 py-3 rounded-2xl flex items-center justify-between transition-all ${
                        isMe 
                          ? 'bg-amber-900/60 border border-amber-400/60 shadow-[0_0_15px_rgba(251,191,36,0.2)]' 
                          : 'bg-slate-800/80 border border-slate-700/80 hover:bg-slate-800'
                      }`}
                    >
                      <span className={`font-medium ${isMe ? 'text-amber-100' : 'text-slate-200'}`}>
                        {student.student_name}
                      </span>
                      {isMe && (
                        <span className="text-xs font-black uppercase tracking-wider text-amber-300 bg-amber-950/80 px-2 py-1 rounded-md border border-amber-500/50">
                          You
                        </span>
                      )}
                    </div>
                  );
                })}
                {waitingStudents.length === 0 && (
                  <div className="py-8 text-center text-slate-500/80 font-medium italic border-2 border-dashed border-slate-700/50 rounded-2xl">
                    Everyone has answered!
                  </div>
                )}
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
    </>
  );
}

export default WaitingForOthers;
