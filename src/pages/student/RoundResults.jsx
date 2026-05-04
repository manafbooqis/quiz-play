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

    // Setup real-time subscription for session status changes
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
        if (updatedSession.status === "active") {
          // Next round started
          navigate("/student/question", {
            state: {
              studentName,
              gameCode,
              sessionId: updatedSession.id,
              currentRound: updatedSession.current_round
            }
          });
        } else if (updatedSession.status === "finished") {
          // Quiz finished
          navigate("/student/final-results", {
            state: {
              studentName,
              gameCode,
              sessionId: updatedSession.id
            }
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [gameCode, studentName, sessionId, currentRound, navigate]);

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

        {/* Phase 1: Continue Button */}
        <div className="text-center">
          <div className="p-4 rounded-xl border border-slate-600 bg-slate-700/50 mb-6">
            <p className="text-slate-300">
              <span className="font-semibold">Waiting for next round...</span>
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Click Continue when ready to proceed
            </p>
          </div>
          
          <button
            onClick={() => {
              if (answeredCount >= questionCount) {
                navigate("/student/final-results", {
                  state: {
                    studentName,
                    gameCode,
                    sessionId,
                    questionCount
                  }
                });
              } else {
                navigate("/student/difficulty", {
                  state: {
                    studentName,
                    gameCode,
                    sessionId,
                    currentRound: currentRound + 1,
                    questionCount,
                    questionsByDifficulty: state?.questionsByDifficulty
                  }
                });
              }
            }}
            className="game-font bg-cyan-500 hover:bg-cyan-400 text-slate-900 py-3 px-8 rounded-xl transition font-semibold"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoundResults;
