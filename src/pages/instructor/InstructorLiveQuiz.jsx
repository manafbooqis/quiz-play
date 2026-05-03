import { useEffect, useState, useMemo, useRef } from "react";
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

function InstructorLiveQuiz() {
  const navigate = useNavigate();
  const { state } = useLocation();
  
  const gameCode = state?.gameCode ?? "";
  const sessionId = state?.sessionId ?? "";
  const questionsByDifficulty = state?.questionsByDifficulty ?? { easy: [], medium: [], hard: [] };
  const timePerQuestion = state?.timePerQuestion ?? 15;
  
  const [sessionData, setSessionData] = useState(null);
  const [students, setStudents] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState("easy");
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roundResults, setRoundResults] = useState(null);
  const [instructorTimeLeft, setInstructorTimeLeft] = useState(0);

  // Prevent repeated navigation to results
  const hasNavigatedToResultsRef = useRef(false);

  // Calculate total questions
  const totalQuestions = useMemo(() => {
    return (questionsByDifficulty?.easy?.length || 0) +
           (questionsByDifficulty?.medium?.length || 0) +
           (questionsByDifficulty?.hard?.length || 0);
  }, [questionsByDifficulty]);

  // Used question ids for this difficulty's bank (responses do not store difficulty)
  const getUsedQuestions = (difficulty) => {
    const questions = questionsByDifficulty[difficulty] || [];
    const idSet = new Set(
      questions
        .map((q) => q.id || q.question_id || q.qid)
        .filter(Boolean)
    );
    return responses
      .filter((r) => idSet.has(r.question_id))
      .map((r) => r.question_id);
  };

  const getNextQuestion = (difficulty) => {
    const questions = questionsByDifficulty[difficulty] || [];
    const usedIds = getUsedQuestions(difficulty);
    return questions.find((q) => {
      const qid = q.id || q.question_id || q.qid;
      return qid && !usedIds.includes(qid);
    });
  };

  // Load session data and setup real-time subscription
  useEffect(() => {
    if (!sessionId) {
      navigate("/instructor/session-official");
      return;
    }

    async function loadSession() {
      try {
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (sessionError) throw sessionError;
        setSessionData(session);

        // Load students
        const { data: players, error: playersError } = await supabase
          .from("session_players")
          .select("*")
          .eq("session_id", sessionId);

        if (playersError) throw playersError;
        setStudents(players || []);

        // Load responses
        const { data: responseList, error: responsesError } = await supabase
          .from("responses")
          .select("*")
          .eq("session_id", sessionId)
          .order("answered_at", { ascending: true });

        if (responsesError) {
          console.error("Error loading responses:", JSON.stringify(responsesError, null, 2));
          console.error("Message:", responsesError.message);
          console.error("Details:", responsesError.details);
          console.error("Hint:", responsesError.hint);
          console.error("Code:", responsesError.code);
          throw responsesError;
        }
        setResponses(responseList || []);

        // Set current question if active
        if (session.current_question_id && questionsByDifficulty) {
          const current = questionsByDifficulty[session.current_difficulty]?.find(q => q.id === session.current_question_id);
          setCurrentQuestion(current);
          setSelectedDifficulty(session.current_difficulty || "easy");
        }

      } catch (err) {
        console.error("Error loading session:", JSON.stringify(err, null, 2));
        console.error("Message:", err.message);
        console.error("Details:", err.details);
        console.error("Hint:", err.hint);
        console.error("Code:", err.code);
        setError("Failed to load session data");
      } finally {
        setLoading(false);
      }
    }

    loadSession();

    // Setup real-time subscription
    const subscription = supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`
      }, (payload) => {
        const row = payload.new;
        if (!row) return;
        setSessionData((prev) => ({ ...prev, ...row }));
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'responses',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setResponses(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
          setResponses(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [sessionId, navigate]);

  // Same per-question window as students: current_question_ends_at − now (full time each question).
  useEffect(() => {
    if (
      sessionData?.status !== "active" ||
      !sessionData?.current_question_ends_at ||
      !sessionData?.current_question_id
    ) {
      setInstructorTimeLeft(0);
      return undefined;
    }

    function tick() {
      const end = new Date(sessionData.current_question_ends_at).getTime();
      setInstructorTimeLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [
    sessionData?.status,
    sessionData?.current_question_ends_at,
    sessionData?.current_question_id,
  ]);

  // Polling-based completion check — runs every 2 seconds
  useEffect(() => {
    if (!sessionId || !sessionData) return;

    const interval = setInterval(async () => {
      if (hasNavigatedToResultsRef.current) {
        clearInterval(interval);
        return;
      }

      // Fetch fresh responses from Supabase
      const { data: freshResponses, error: respError } = await supabase
        .from("responses")
        .select("*")
        .eq("session_id", sessionId);

      if (respError) {
        console.error("Polling: error fetching responses", respError);
        return;
      }

      const questionCount = Number(
        sessionData.question_count || sessionData.questionCount || 3
      );

      // Count responses per player
      const responsesByPlayer = {};
      (freshResponses || []).forEach((r) => {
        const pid = r.player_id;
        responsesByPlayer[pid] = (responsesByPlayer[pid] || 0) + 1;
      });

      // Check every joined student
      let allCompleted = students.length > 0;
      students.forEach((student) => {
        const pid = student.id || student.student_name;
        const count = responsesByPlayer[pid] || 0;
        if (count < questionCount) allCompleted = false;
      });

      console.log("Instructor completion check:", {
        sessionId,
        questionCount,
        students,
        freshResponses,
        responsesByPlayer,
        allCompleted,
      });

      if (allCompleted) {
        clearInterval(interval);
        if (hasNavigatedToResultsRef.current) return;
        hasNavigatedToResultsRef.current = true;

        console.log("All students completed quiz. Navigating to final results.");

        // Update session status to finished
        try {
          await supabase
            .from("sessions")
            .update({ status: "finished", quiz_finished_at: new Date().toISOString() })
            .eq("id", sessionId);
        } catch (err) {
          console.error("Error updating session status:", err);
        }

        // Update local responses state before navigating
        setResponses(freshResponses || []);

        navigate("/instructor/final-results", {
          state: {
            sessionId,
            gameCode,
            students,
            responses: freshResponses || [],
            questionsByDifficulty,
            questionCount: Number(sessionData.question_count || sessionData.questionCount || 0),
          },
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [sessionId, sessionData, students, navigate, gameCode, questionsByDifficulty]);

  // Check if round is truly active (has both status and question)
  const isRoundActive =
    sessionData?.status === "active" &&
    Boolean(sessionData?.current_question_id) &&
    Boolean(sessionData?.current_difficulty);

  // Calculate student scores
  const studentScores = useMemo(() => {
    const scores = {};
    students.forEach(student => {
      const studentId = student.id || student.student_name;
      scores[studentId] = {
        name: getStudentName(student, 0),
        totalScore: 0,
        roundScore: 0,
        answered: false,
        rank: 0
      };
    });

    responses.forEach(response => {
      const studentId = response.player_id;
      if (scores[studentId]) {
        scores[studentId].totalScore += response.points_awarded;
        if (response.round_number === sessionData?.current_round) {
          scores[studentId].roundScore += response.points_awarded;
          scores[studentId].answered = true;
        }
      }
    });

    // Calculate ranks
    const sorted = Object.values(scores).sort((a, b) => b.totalScore - a.totalScore);
    sorted.forEach((student, index) => {
      student.rank = index + 1;
    });

    return sorted;
  }, [students, responses, sessionData?.current_round]);

  // Start round with selected difficulty
  const startRound = async () => {
    // Log selected question details
    console.log("selectedDifficulty:", selectedDifficulty);
    console.log("questionsByDifficulty:", questionsByDifficulty);
    console.log("available questions:", questionsByDifficulty?.[selectedDifficulty]);
    
    const availableQuestions = questionsByDifficulty?.[selectedDifficulty] || [];

    if (availableQuestions.length === 0) {
      setError("No questions available for this difficulty.");
      return;
    }

    const nextQuestion = getNextQuestion(selectedDifficulty);

    if (!nextQuestion) {
      setError("No unused questions left for this difficulty.");
      return;
    }
    
    // Determine questionId safely
    const questionId =
      nextQuestion?.id ||
      nextQuestion?.question_id ||
      nextQuestion?.qid ||
      `${selectedDifficulty}-${Date.now()}`;
    
    if (!questionId) {
      setError("Selected question is missing an id.");
      return;
    }
    
    // Create normalized question if needed
    const normalizedQuestion = {
      ...nextQuestion,
      id: questionId,
    };
    
    // Resolve session ID if missing
    let finalSessionId = sessionId;
    
    if (!finalSessionId && gameCode) {
      const { data: resolvedSession, error: resolveError } = await supabase
        .from("sessions")
        .select("id, game_code, status")
        .eq("game_code", gameCode)
        .maybeSingle();

      if (resolveError) {
        console.error("Resolve session error:", resolveError);
        setError("Failed to resolve session.");
        return;
      }

      finalSessionId = resolvedSession?.id;
    }

    if (!finalSessionId) {
      setError("Missing session id. Cannot start round.");
      return;
    }

    console.log("gameCode:", gameCode);
    console.log("sessionId before update:", finalSessionId);
    console.log("selectedDifficulty:", selectedDifficulty);
    console.log("nextQuestion:", nextQuestion);
    console.log("questionId:", questionId);
    const nextRound = Number(sessionData?.current_round || 1);

    const secondsPerQuestion = Number(
      sessionData?.time_per_question ?? timePerQuestion ?? 10
    );

    const updatePayload = {
      status: "active",
      current_question_id: questionId,
      current_difficulty: selectedDifficulty,
      current_round: nextRound,
      show_round_results: false,
      current_question_started_at: new Date().toISOString(),
      current_question_ends_at: new Date(
        Date.now() + secondsPerQuestion * 1000
      ).toISOString(),
    };
    
    try {
      const { data, error } = await supabase
        .from("sessions")
        .update(updatePayload)
        .eq("id", finalSessionId)
        .select("*")
        .single();

      if (error) {
        console.error("Start Round Supabase error full:", error);
        setError("Failed to start round.");
        return;
      }

      console.log("Start Round updated session:", data);
      
      // Check if question was actually saved
      if (!data?.current_question_id || !data?.current_difficulty) {
        console.error("Start Round failed verification:", data);
        setError("Round started but current question was not saved.");
        return;
      }

      setSessionData((prev) => ({
        ...prev,
        ...data,
        current_question_started_at: data.current_question_started_at,
        current_question_ends_at: data.current_question_ends_at,
        current_question_id: data.current_question_id,
        current_difficulty: data.current_difficulty,
        time_per_question: data.time_per_question ?? prev?.time_per_question,
      }));
      setInstructorTimeLeft(
        Math.max(
          0,
          Math.floor(
            (new Date(data.current_question_ends_at).getTime() - Date.now()) /
              1000
          )
        )
      );
      
      setCurrentQuestion(normalizedQuestion);
      setRoundResults(null);
      setError("");

    } catch (err) {
      console.error("Start round caught error:", err);
      setError("Failed to start round");
    }
  };

  // End current round and show results
  const endRound = async () => {
    try {
      const { error: updateError } = await supabase
        .from("sessions")
        .update({
          status: "round_results",
          show_round_results: true,
          current_question_ends_at: new Date().toISOString()
        })
        .eq("id", sessionId);

      if (updateError) throw updateError;

      // Calculate round results
      const roundResponses = responses.filter(r => r.round_number === sessionData?.current_round);
      setRoundResults(roundResponses);

    } catch (err) {
      console.error("Error ending round:", err);
      setError("Failed to end round");
    }
  };

  // Move to next round
  const nextRound = async () => {
    const nextRoundNumber = (sessionData?.current_round || 1) + 1;
    const maxRounds = Number(
      sessionData?.question_count ?? sessionData?.questionCount ?? 1
    );

    if (nextRoundNumber > maxRounds) {
      await finishQuiz();
    } else {
      try {
        const { error: updateError } = await supabase
          .from("sessions")
          .update({
            status: "waiting",
            current_round: nextRoundNumber,
            current_question_id: null,
            current_difficulty: null,
            show_round_results: false
          })
          .eq("id", sessionId);

        if (updateError) throw updateError;
        
        setCurrentQuestion(null);
        setRoundResults(null);
        setSelectedDifficulty("easy");

      } catch (err) {
        console.error("Error moving to next round:", err);
        setError("Failed to move to next round");
      }
    }
  };

  // Finish quiz manually
  const finishQuiz = async () => {
    try {
      const { error: updateError } = await supabase
        .from("sessions")
        .update({
          status: "finished",
          quiz_finished_at: new Date().toISOString()
        })
        .eq("id", sessionId);

      if (updateError) throw updateError;
      
      navigate("/instructor/final-results", {
        state: {
          sessionId,
          gameCode,
          students,
          responses,
          questionsByDifficulty,
          questionCount: Number(sessionData?.question_count || sessionData?.questionCount || 0),
        }
      });

    } catch (err) {
      console.error("Error finishing quiz:", err);
      setError("Failed to finish quiz");
    }
  };

  // Instructor completion check
  useEffect(() => {
    if (!sessionData?.question_count || students.length === 0) return;

    const questionCount = Number(sessionData.question_count);
    let allCompleted = true;
    const responsesByPlayer = {};

    students.forEach(s => {
      const pId = s.student_name || s.id;
      const count = responses.filter(r => r.player_id === pId).length;
      responsesByPlayer[pId] = count;
      if (count < questionCount) {
        allCompleted = false;
      }
    });

    console.log("Instructor completion check:", {
      totalStudents: students.length,
      questionCount,
      responsesByPlayer,
      allCompleted
    });

    if (allCompleted && sessionData.status === "active") {
      console.log("All students completed quiz. Navigating to final results.");
      
      supabase
        .from("sessions")
        .update({
          status: "finished",
          quiz_finished_at: new Date().toISOString()
        })
        .eq("id", sessionId)
        .then(() => {
          navigate("/instructor/final-results", {
            state: {
              sessionId,
              gameCode,
              students,
              responses,
              questionsByDifficulty
            }
          });
        })
        .catch(err => console.error("Error setting session finished:", err));
    }
  }, [responses.length, students, sessionData?.question_count, sessionData?.status, navigate, sessionId, gameCode, questionsByDifficulty]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-700 text-xl font-semibold">Loading quiz...</div>
      </div>
    );
  }

  const answeredCount = responses.filter(r => 
    r.round_number === sessionData?.current_round && 
    r.question_id === sessionData?.current_question_id
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Live Quiz Control</h1>
            <p className="text-slate-500 mt-2">
              Game Code: <span className="font-semibold">{gameCode}</span> • 
              Round: {sessionData?.current_round || 1} • 
              Status: <span className="font-semibold capitalize">{sessionData?.status || 'waiting'}</span>
            </p>
          </div>
          <button
            onClick={() => navigate("/instructor/session-official")}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition font-semibold"
          >
            Back to Session
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Students Panel */}
          <div className="xl:col-span-2 space-y-6">
            {/* Current Question */}
            {currentQuestion && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Current Question</h2>
                  <div className="flex items-center gap-3">
                    {sessionData?.status === "active" &&
                      sessionData?.current_question_id && (
                        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-semibold text-sm tabular-nums">
                          {Math.floor(instructorTimeLeft / 60)}:
                          {(instructorTimeLeft % 60).toString().padStart(2, "0")}{" "}
                          left
                        </span>
                      )}
                    <span className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-900 font-semibold text-sm">
                      {selectedDifficulty}
                    </span>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-lg font-medium mb-3">{currentQuestion.q}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentQuestion.choices?.map((choice, index) => (
                      <div key={index} className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                        <span className="font-semibold">{String.fromCharCode(65 + index)}.</span> {choice}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Answered: {answeredCount} / {students.length}
                  </p>
                </div>
              </div>
            )}

            {/* Students Rankings */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-4">Student Rankings</h2>
              <div className="space-y-3">
                {studentScores.map((student) => (
                  <div key={student.name} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                        {student.rank}
                      </div>
                      <div>
                        <p className="font-semibold">{student.name}</p>
                        <p className="text-sm text-slate-500">
                          {student.answered ? "Answered" : "Waiting"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{student.totalScore}</p>
                      <p className="text-sm text-slate-500">total points</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>


            {roundResults && sessionData?.status === "round_results" && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <h2 className="text-xl font-bold mb-4">Round Results</h2>
                <div className="space-y-3">
                  {studentScores
                    .filter(s => s.roundScore > 0)
                    .sort((a, b) => b.roundScore - a.roundScore)
                    .map((student) => (
                      <div key={student.name} className="flex items-center justify-between p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                        <div className="flex items-center gap-4">
                          <span className="text-2xl">
                            {student.rank === 1 ? "🥇" : student.rank === 2 ? "🥈" : student.rank === 3 ? "🥉" : "🎖️"}
                          </span>
                          <div>
                            <p className="font-semibold">{student.name}</p>
                            <p className="text-sm text-slate-500">+{student.roundScore} points this round</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{student.totalScore}</p>
                          <p className="text-sm text-slate-500">total</p>
                        </div>
                      </div>
                    ))}
                </div>
                <button
                  onClick={nextRound}
                  className="w-full mt-4 px-4 py-3 rounded-xl bg-cyan-500 text-white hover:bg-cyan-600 transition font-semibold"
                >
                  Next Round
                </button>
              </div>
            )}
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            {/* Difficulty Selection */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-4">Select Difficulty</h2>
              <div className="space-y-3">
                {["easy", "medium", "hard"].map((difficulty) => {
                  const available = questionsByDifficulty[difficulty]?.length || 0;
                  const used = getUsedQuestions(difficulty).length;
                  const remaining = available - used;
                  
                  return (
                    <button
                      key={difficulty}
                      onClick={() => setSelectedDifficulty(difficulty)}
                      disabled={remaining === 0}
                      className={[
                        "w-full p-4 rounded-xl border transition font-semibold",
                        selectedDifficulty === difficulty
                          ? "bg-slate-900 text-white border-slate-900"
                          : remaining === 0
                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <span className="capitalize">{difficulty}</span>
                        <span className="text-sm">
                          {remaining}/{available} available
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Round Controls */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-4">Round Controls</h2>
              
              {sessionData?.status === "active" && !isRoundActive && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-sm text-amber-800">Round is not started yet. Select a difficulty and start round.</p>
                  </div>
                </div>
              )}
              {isRoundActive && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-sm text-amber-800">Round in progress...</p>
                    <p className="text-xs text-amber-600 mt-1">
                      {answeredCount} of {students.length} students answered
                    </p>
                  </div>
                </div>
              )}
              {sessionData?.status === "round_results" && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <p className="text-sm text-emerald-800">Round completed!</p>
                  </div>
                  <button
                    onClick={nextRound}
                    className="w-full px-4 py-3 rounded-xl bg-cyan-500 text-white hover:bg-cyan-600 transition font-semibold"
                  >
                    Next Round
                  </button>
                </div>
              )}
            </div>

            {/* Quiz Controls */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-4">Quiz Controls</h2>
              <button
                onClick={finishQuiz}
                className="w-full px-4 py-3 rounded-xl bg-red-500 text-white hover:bg-red-600 transition font-semibold"
              >
                End Quiz
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InstructorLiveQuiz;
