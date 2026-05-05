import { useEffect, useState, useRef } from "react";
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

function RoundResults() {
  const navigate = useNavigate();
  const { state } = useLocation();
  
  const studentName = state?.studentName ?? "";
  const gameCode = state?.gameCode ?? "";
  const sessionId = state?.sessionId ?? "";
  const currentRound = state?.currentRound ?? 1;
  
  // Get result data from navigation state (Phase 1)
  const pointsAwarded = state?.pointsAwarded ?? 0;
  const isCorrect = state?.isCorrect ?? false;
  const selectedAnswer = state?.selectedAnswer ?? null;
  const currentDifficulty = state?.currentDifficulty ?? "";
  const currentQuestion = state?.currentQuestion ?? null;
  const questionCount = state?.questionCount ?? 1;
  
  const [sessionData, setSessionData] = useState(null);
  const [roundResults, setRoundResults] = useState([]);
  const [myResult, setMyResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [answeredStudents, setAnsweredStudents] = useState([]);
  const [waitingStudents, setWaitingStudents] = useState([]);
  const [allReady, setAllReady] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownStartedRef = useRef(false);
  const countdownNavigationDoneRef = useRef(false);
  const previousRoundRef = useRef(currentRound);

  // Polling logic for all-students sync
  useEffect(() => {
    if (!gameCode || !studentName || !sessionId || !currentRound) return;

    const pollInterval = setInterval(async () => {
      try {
        // Load all students in session
        const { data: players, error: playersError } = await supabase
          .from("session_players")
          .select("*")
          .eq("session_id", sessionId);

        if (playersError) throw playersError;
        setTotalStudents(players.length);

        // Load responses for current round
        const { data: responses, error: responsesError } = await supabase
          .from("responses")
          .select("*")
          .eq("session_id", sessionId)
          .eq("round_number", Number(currentRound));

        if (responsesError) throw responsesError;

        // Determine which students have answered
        const answered = [];
        const waiting = [];

        players.forEach(player => {
          const hasResponse = responses.some(response => 
            response.player_id === player.student_name || 
            response.player_id === player.id
          );
          
          if (hasResponse) {
            answered.push({
              studentName: player.student_name,
              total_score: player.total_score || 0
            });
          } else {
            waiting.push({
              studentName: player.student_name,
              total_score: player.total_score || 0
            });
          }
        });

        setAnsweredStudents(answered);
        setWaitingStudents(waiting);
        setAllReady(players.length > 0 && waiting.length === 0);

        console.log("[RoundResults] sync", {
          currentRound,
          totalStudents: players.length,
          answeredStudents: answered.length,
          allReady: waiting.length === 0
        });

      } catch (err) {
        console.error("Error polling round results:", err);
      }
    }, 1000); // Poll every 1 second

    return () => clearInterval(pollInterval);
  }, [gameCode, studentName, sessionId, currentRound]);

  // Start countdown when allReady becomes true
  useEffect(() => {
    if (!allReady || countdownStartedRef.current) return;
    
    countdownStartedRef.current = true;
    setCountdown(3);
  }, [allReady]);

  // Countdown timer - only decrement countdown
  useEffect(() => {
    if (countdown === 0) return;
    
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [countdown]);

  // Navigation after countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && allReady && !countdownNavigationDoneRef.current) {
      countdownNavigationDoneRef.current = true;
      
      if (Number(currentRound) >= Number(questionCount)) {
        navigate("/student/final-results", {
          state: { studentName, gameCode, sessionId, questionCount }
        });
      } else {
        const sentTimePerQuestion = Number(state?.timePerQuestion) ||
                                   Number(state?.time_per_question) ||
                                   Number(sessionData?.time_per_question) ||
                                   10;
        
        console.log("[TimerFlow] RoundResults -> Difficulty", { sentTimePerQuestion });
        
        navigate("/student/difficulty", {
          state: {
            studentName,
            gameCode,
            sessionId,
            currentRound: Number(currentRound) + 1,
            questionCount,
            questionsByDifficulty: state?.questionsByDifficulty,
            timePerQuestion: sentTimePerQuestion
          }
        });
      }
    }
  }, [countdown, allReady, currentRound, questionCount, navigate, studentName, gameCode, sessionId, state]);

  // Reset refs when currentRound changes
  useEffect(() => {
    if (previousRoundRef.current !== currentRound) {
      countdownStartedRef.current = false;
      countdownNavigationDoneRef.current = false;
      setCountdown(0);
      previousRoundRef.current = currentRound;
    }
  }, [currentRound]);

  useEffect(() => {
    if (!gameCode || !studentName) {
      navigate("/student/join");
      return;
    }

    async function loadData() {
      try {
        // Load session data
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("game_code", gameCode)
          .single();

        if (sessionError) throw sessionError;
        setSessionData(session);

        // Get my answered count
        const localKey = `quizplay_answered_questions_${gameCode}_${studentName}`;
        const stored = localStorage.getItem(localKey);
        const answered = stored ? JSON.parse(stored) : [];
        setAnsweredCount(answered.length);

        // Load current round responses for ranking
        const { data: responses, error: responsesError } = await supabase
          .from("responses")
          .select("*")
          .eq("session_id", session.id)
          .eq("round_number", currentRound);

        if (responsesError) throw responsesError;

        // Load students for names
        const { data: players, error: playersError } = await supabase
          .from("session_players")
          .select("*")
          .eq("session_id", session.id);

        if (playersError) throw playersError;

        // Create student name mapping
        const studentMap = {};
        players.forEach(player => {
          studentMap[player.id] = getStudentName(player, 0);
          studentMap[player.student_name] = getStudentName(player, 0);
        });

        // Process results with names and rankings
        const processedResults = responses.map(response => ({
          ...response,
          studentName: studentMap[response.player_id] || response.player_id
        })).sort((a, b) => b.points_awarded - a.points_awarded);

        setRoundResults(processedResults);

        // Find my result
        const myResponse = processedResults.find(r => 
          r.player_id === studentName || 
          r.studentName === studentName
        );
        setMyResult(myResponse);

      } catch (err) {
        console.error("Error loading round results:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [gameCode, studentName, sessionId, currentRound]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-xl font-semibold">Loading results...</div>
      </div>
    );
  }

  const myRank = myResult ? roundResults.findIndex(r => r.player_id === myResult.player_id) + 1 : 0;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-4xl bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="game-font text-4xl text-cyan-300 mb-4">Round Results</h1>
          <div className="flex items-center justify-center gap-4 text-slate-300">
            <span>Round {currentRound}</span>
            <span>•</span>
            <span>Game Code: {gameCode}</span>
          </div>
        </div>

        {/* My Result Card (Phase 1 - from navigation state) */}
        <div className="mb-8 bg-gradient-to-r from-cyan-600 to-blue-600 border-2 border-cyan-400 rounded-2xl p-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl ${
              isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
            }`}>
              {isCorrect ? '✓' : '✗'}
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Your Result</h2>
          <div className="flex items-center justify-center gap-6">
            <div>
              <p className="text-3xl font-bold">{pointsAwarded}</p>
              <p className="text-cyan-100">Points earned</p>
            </div>
            <div className="w-px h-12 bg-cyan-400"></div>
            <div>
              <p className="text-2xl font-bold capitalize">{currentDifficulty}</p>
              <p className="text-cyan-100">Difficulty</p>
            </div>
          </div>
          
          {/* Question Details */}
          {currentQuestion && (
            <div className="mt-6 text-left bg-white/10 rounded-xl p-4">
              <p className="text-lg font-semibold mb-2">Question:</p>
              <p className="text-cyan-100 mb-3">{currentQuestion.question_text || currentQuestion.questionText}</p>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-cyan-200">Your Answer:</p>
                  <p className="text-white">
                    {selectedAnswer === 0 ? 'A' : selectedAnswer === 1 ? 'B' : selectedAnswer === 2 ? 'C' : selectedAnswer === 3 ? 'D' : '-'}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-emerald-200">Correct Answer:</p>
                  <p className="text-white">
                    {currentQuestion.correct_answer === 0 ? 'A' : currentQuestion.correct_answer === 1 ? 'B' : currentQuestion.correct_answer === 2 ? 'C' : currentQuestion.correct_answer === 3 ? 'D' : '-'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top Performers */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-center mb-6 text-cyan-300">Top Performers</h2>
          <div className="space-y-3">
            {roundResults.slice(0, 5).map((result, index) => (
              <div 
                key={result.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition ${
                  result.player_id === myResult?.player_id
                    ? "border-cyan-400 bg-cyan-900/30"
                    : "border-slate-600 bg-slate-700/50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold">
                      {result.studentName}
                      {result.player_id === myResult?.player_id && (
                        <span className="ml-2 text-cyan-400">(You)</span>
                      )}
                    </p>
                    <p className="text-sm text-slate-400">
                      {result.is_correct ? "Correct answer" : "Wrong answer"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-xl">{result.points_awarded}</p>
                  <p className="text-sm text-slate-400">points</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Full Results */}
        {roundResults.length > 5 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-center mb-4 text-slate-300">All Results</h3>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {roundResults.slice(5).map((result) => (
                <div 
                  key={result.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition ${
                    result.player_id === myResult?.player_id
                      ? "border-cyan-400 bg-cyan-900/30"
                      : "border-slate-700 bg-slate-700/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-sm font-bold">
                      {roundResults.findIndex(r => r.id === result.id) + 1}
                    </span>
                    <span className={result.player_id === myResult?.player_id ? "text-cyan-400 font-semibold" : ""}>
                      {result.studentName}
                      {result.player_id === myResult?.player_id && " (You)"}
                    </span>
                  </div>
                  <span className="font-bold">{result.points_awarded} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Phase 2: All Students Sync */}
        <div className="text-center">
          <div className={`p-4 rounded-xl border mb-6 ${
            allReady 
              ? "border-emerald-400 bg-emerald-900/20" 
              : "border-slate-600 bg-slate-700/50"
          }`}>
            <p className={allReady ? "text-emerald-300" : "text-slate-300"}>
              <span className="font-semibold">
                {allReady ? "All students are ready" : "Waiting for students..."}
              </span>
            </p>
            <p className={`${allReady ? "text-emerald-400" : "text-slate-400"} text-sm mt-1`}>
              {allReady 
                ? countdown > 0 ? `Starting next round in ${countdown}...` : "Starting next round"
                : `Answered: ${answeredStudents.length} / ${totalStudents}`
              }
            </p>
          </div>

          {/* Students List */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-slate-300">Students Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {/* Answered Students */}
              <div>
                <p className="font-semibold text-emerald-400 mb-2">Answered ({answeredStudents.length})</p>
                <div className="space-y-1">
                  {[...answeredStudents, ...waitingStudents]
                    .sort((a, b) => b.total_score - a.total_score)
                    .filter(student => answeredStudents.some(as => as.studentName === student.studentName))
                    .map(student => (
                      <div key={student.studentName} className="flex justify-between p-2 rounded bg-emerald-900/20 border border-emerald-800/50">
                        <span className={student.studentName === studentName ? "text-cyan-400 font-semibold" : "text-emerald-300"}>
                          {student.studentName}
                          {student.studentName === studentName && " (You)"}
                        </span>
                        <span className="text-emerald-400">{student.total_score} pts</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Waiting Students */}
              <div>
                <p className="font-semibold text-amber-400 mb-2">Waiting ({waitingStudents.length})</p>
                <div className="space-y-1">
                  {waitingStudents
                    .sort((a, b) => b.total_score - a.total_score)
                    .map(student => (
                      <div key={student.studentName} className="flex justify-between p-2 rounded bg-amber-900/20 border border-amber-800/50">
                        <span className={student.studentName === studentName ? "text-cyan-400 font-semibold" : "text-amber-300"}>
                          {student.studentName}
                          {student.studentName === studentName && " (You)"}
                        </span>
                        <span className="text-amber-400">{student.total_score} pts</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoundResults;
