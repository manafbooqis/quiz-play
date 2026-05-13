import { useEffect, useState, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { calculateLeaderboard } from "../../utils/leaderboard";

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

  // Phase 3: Instructor monitoring state
  const [selectedMonitorDifficulty, setSelectedMonitorDifficulty] = useState("easy");
  const [currentRound, setCurrentRound] = useState(1);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [liveRanking, setLiveRanking] = useState([]);
  const [previewQuestion, setPreviewQuestion] = useState(null);

  // Helper functions for different question shapes
  const getQuestionText = (q) => {
    if (!q) return "";
    return q.question || q.question_text || q.text || q.prompt || "";
  };

  const getOptions = (q) => {
    if (!q) return [];
    if (Array.isArray(q.options)) return q.options;
    if (Array.isArray(q.answers)) return q.answers;
    if (Array.isArray(q.choices)) return q.choices;
    if (q.option_a || q.A) {
      return [
        q.option_a || q.A || "",
        q.option_b || q.B || "",
        q.option_c || q.C || "",
        q.option_d || q.D || ""
      ].filter(Boolean);
    }
    return [];
  };

  const getCorrectAnswer = (q) => {
    if (!q) return "No correct answer found";
    
    let correct = null;
    if (q.correct_answer !== undefined && q.correct_answer !== null && q.correct_answer !== "") correct = q.correct_answer;
    else if (q.correctAnswer !== undefined && q.correctAnswer !== null && q.correctAnswer !== "") correct = q.correctAnswer;
    else if (q.correct_option !== undefined && q.correct_option !== null && q.correct_option !== "") correct = q.correct_option;
    else if (q.answer !== undefined && q.answer !== null && q.answer !== "") correct = q.answer;

    if (correct === null) {
      return "No correct answer found";
    }

    const options = getOptions(q);
    
    if (typeof correct === 'number' || (!isNaN(parseInt(correct)) && String(parseInt(correct)) === String(correct))) {
      const index = parseInt(correct);
      if (index >= 0 && index < options.length && options[index]) {
        return options[index];
      }
    }
    
    if (typeof correct === 'string') {
      const upperCorrect = correct.trim().toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(upperCorrect)) {
        const index = ['A', 'B', 'C', 'D'].indexOf(upperCorrect);
        if (index >= 0 && index < options.length && options[index]) {
          return options[index];
        }
      }
      return correct;
    }
    
    return String(correct);
  };

  // Prevent repeated navigation to results
  const hasNavigatedToResultsRef = useRef(false);
  const hasEndedCurrentQuestionRef = useRef(false);
  const autoNextRoundRef = useRef(false);

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
          console.error("Error loading responses:", responsesError.message);
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
        console.error("Error loading session:", err.message);
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

      if (allCompleted) {
        clearInterval(interval);
        if (hasNavigatedToResultsRef.current) return;
        hasNavigatedToResultsRef.current = true;

        
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

  // Start round with selected difficulty
  const startRound = async () => {
        
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
            status: "choosing_difficulty",
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
        console.error("Error moving to next round — message:", err?.message);
        console.error("Error moving to next round — details:", err?.details);
        console.error("Error moving to next round — hint:", err?.hint);
        console.error("Error moving to next round — code:", err?.code);
        console.error("Error moving to next round — full:", JSON.stringify(err, null, 2));
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
          quiz_finished_at: new Date().toISOString(),
          show_round_results: false,
          current_question_ends_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .select("*")
        .single();

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

  // Phase 3: Monitoring calculations
  useEffect(() => {
    if (!sessionData || !students || !responses) return;

    // Calculate current round
    const currentRound =
      Number(sessionData?.current_round) ||
      Math.max(...responses.map(r => Number(r.round_number) || 0), 1) ||
      1;
    setCurrentRound(currentRound);

    // Calculate answered count for current round (unique students)
    const answeredStudents = new Set();
    responses.forEach(r => {
      if (Number(r.round_number) === Number(currentRound)) {
        answeredStudents.add(r.player_id);
      }
    });
    setAnsweredCount(answeredStudents.size);
    setTotalStudents(students.length);

    // Calculate live ranking from the same shared final-score rule.
    const ranking = calculateLeaderboard(
      students,
      responses,
      Number(sessionData?.question_count || sessionData?.questionCount || 0),
      sessionData || {}
    ).map((student) => ({
      studentName: student.name,
      totalScore: student.score,
    }));
    
    setLiveRanking(ranking);

  }, [sessionData, students, responses]);

  // Reset the end round ref when a new question starts
  useEffect(() => {
    hasEndedCurrentQuestionRef.current = false;
  }, [sessionData?.current_question_id]);

  // Auto end round when everyone has answered
  useEffect(() => {
    if (
      sessionData?.status === "active" &&
      sessionData?.current_question_id &&
      totalStudents > 0 &&
      answeredCount >= totalStudents &&
      !hasEndedCurrentQuestionRef.current
    ) {
      console.log("[EndRoundTriggered]", {
        answeredCount,
        totalStudents,
        currentQuestionId: sessionData.current_question_id,
      });

      hasEndedCurrentQuestionRef.current = true;
      endRound();
    }
  }, [
    answeredCount,
    totalStudents,
    sessionData?.status,
    sessionData?.current_question_id,
  ]);

  // Automatic progression to next question
  useEffect(() => {
    if (
      sessionData?.status === "round_results" &&
      Number(sessionData?.current_round || 1) < Number(sessionData?.question_count || sessionData?.questionCount || 1) &&
      !autoNextRoundRef.current
    ) {
      console.log("[AutoNextRoundScheduled]", { currentRound: sessionData?.current_round });
      autoNextRoundRef.current = true;

      const timer = setTimeout(() => {
        console.log("[AutoNextRoundFired]", { currentRound: sessionData?.current_round });
        nextRound();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [
    sessionData?.status,
    sessionData?.current_round,
    sessionData?.question_count,
    sessionData?.questionCount,
  ]);

  // Reset the automatic progression ref when entering choosing_difficulty or a new active question
  useEffect(() => {
    if (
      sessionData?.status === "choosing_difficulty" ||
      (sessionData?.status === "active" && sessionData?.current_question_id)
    ) {
      autoNextRoundRef.current = false;
    }
  }, [sessionData?.status, sessionData?.current_question_id]);

  // Simple polling for instructor data refresh
  useEffect(() => {
    if (!sessionId) return;

    const interval = setInterval(async () => {
      try {
        // Load fresh students
        const { data: freshStudents } = await supabase
          .from("session_players")
          .select("*")
          .eq("session_id", sessionId);

        // Load fresh responses
        const { data: freshResponses } = await supabase
          .from("responses")
          .select("*")
          .eq("session_id", sessionId)
          .order("answered_at", { ascending: true });

        // Load fresh session data
        const { data: freshSession } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        // Update states
        if (freshStudents) setStudents(freshStudents);
        if (freshResponses) setResponses(freshResponses);
        if (freshSession) setSessionData(freshSession);

      } catch {
        // Silently handle polling errors
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionId]);

  // Update preview question when session data changes
  useEffect(() => {
    const questionIndex = Math.max(0, Number(currentRound || 1) - 1);
    const bank =
      sessionData?.questions_by_difficulty ||
      sessionData?.questionsByDifficulty ||
      {};
    const previewList = bank[selectedMonitorDifficulty] || [];
    setPreviewQuestion(previewList[questionIndex] || null);
  }, [
    selectedMonitorDifficulty,
    currentRound,
    sessionData?.questions_by_difficulty,
    sessionData?.questionsByDifficulty
  ]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-700 text-xl font-semibold">Loading quiz...</div>
      </div>
    );
  }

  void currentQuestion;
  void roundResults;
  void instructorTimeLeft;
  void totalQuestions;
  void isRoundActive;
  void startRound;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Live Quiz Control</h1>
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
            
            {/* Phase 3: Live Rankings */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-4">Live Rankings</h2>
              <div className="space-y-3">
                {liveRanking.map((student, index) => (
                  <div key={student.studentName} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{student.studentName}</p>
                        <p className="text-sm text-slate-500">
                          {responses.some(r => 
                            Number(r.round_number) === Number(currentRound) && 
                            (String(r.player_id) === String(student.studentName) || String(r.player_id) === String(student.id))
                          ) ? "Answered" : "Waiting"}
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

            {/* Current Question Preview */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Current Question Preview</h2>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold text-sm">
                    Question {currentRound}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-900 font-semibold text-sm">
                    Answered: {answeredCount} / {totalStudents}
                  </span>
                </div>
              </div>

              {/* Difficulty Tabs */}
              <div className="flex gap-2 mb-4">
                {["easy", "medium", "hard"].map((difficulty) => (
                  <button
                    key={difficulty}
                    onClick={() => setSelectedMonitorDifficulty(difficulty)}
                    className={`px-4 py-2 rounded-lg font-semibold capitalize transition ${
                      selectedMonitorDifficulty === difficulty
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {difficulty}
                  </button>
                ))}
              </div>

              {/* Preview Question */}
              {previewQuestion ? (
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold mb-3">{getQuestionText(previewQuestion)}</p>
                    
                    {/* Options */}
                    {(() => {
                      const options = getOptions(previewQuestion);
                      return options.length > 0 ? (
                        <div className="space-y-2">
                          <div className="p-2 rounded bg-slate-50">A) {options[0] || ""}</div>
                          <div className="p-2 rounded bg-slate-50">B) {options[1] || ""}</div>
                          <div className="p-2 rounded bg-slate-50">C) {options[2] || ""}</div>
                          <div className="p-2 rounded bg-slate-50">D) {options[3] || ""}</div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                  
                  {/* Correct Answer */}
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="font-semibold text-emerald-800">Correct Answer:</p>
                    <p className="text-emerald-700">
                      {getCorrectAnswer(previewQuestion)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>No active question yet</p>
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
