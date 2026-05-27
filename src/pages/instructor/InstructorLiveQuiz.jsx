import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { calculateLeaderboard } from "../../utils/leaderboard";

// Gives instructors a live view of quiz progress and controls.
function InstructorLiveQuiz() {
  const navigate = useNavigate();
  const { state } = useLocation();
  
  const gameCode = state?.gameCode ?? "";
  const sessionId = state?.sessionId ?? "";
  // Memoizes the question bank passed from session setup.
  const questionsByDifficulty = useMemo(
    () => state?.questionsByDifficulty ?? { easy: [], medium: [], hard: [] },
    [state?.questionsByDifficulty]
  );
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

  // Reads question text from generated or stored question shapes.
  const getQuestionText = (q) => {
    if (!q) return "";
    return q.question || q.question_text || q.text || q.prompt || "";
  };

  // Reads answer options from generated or stored question shapes.
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

  // Resolves the correct answer text for the instructor preview.
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
  const hasAutoFinishedRef = useRef(false);
  const finishInFlightRef = useRef(false);
  const hasEndedCurrentQuestionRef = useRef(false);
  const autoNextRoundRef = useRef(false);
  const endRoundRef = useRef(null);
  const nextRoundRef = useRef(null);

  // Calculates total available questions across all difficulties.
  const totalQuestions = useMemo(() => {
    return (questionsByDifficulty?.easy?.length || 0) +
           (questionsByDifficulty?.medium?.length || 0) +
           (questionsByDifficulty?.hard?.length || 0);
  }, [questionsByDifficulty]);

  // Lists used question IDs for the selected difficulty's bank.
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

  // Finds the next unused question for a difficulty.
  const getNextQuestion = (difficulty) => {
    const questions = questionsByDifficulty[difficulty] || [];
    const usedIds = getUsedQuestions(difficulty);
    return questions.find((q) => {
      const qid = q.id || q.question_id || q.qid;
      return qid && !usedIds.includes(qid);
    });
  };

  // Opens the instructor results view once with the latest known result data.
  const navigateToFinalResults = useCallback((overrides = {}) => {
    if (hasNavigatedToResultsRef.current) return;
    hasNavigatedToResultsRef.current = true;

    const resultStudents = overrides.students || students;
    const resultResponses = overrides.responses || responses;
    const resultSession = overrides.session || sessionData || {};

    navigate("/instructor/final-results", {
      state: {
        sessionId,
        gameCode,
        students: resultStudents,
        responses: resultResponses,
        questionsByDifficulty,
        questionCount: Number(
          resultSession?.question_count || resultSession?.questionCount || 0
        ),
      },
    });
  }, [
    gameCode,
    navigate,
    questionsByDifficulty,
    responses,
    sessionData,
    sessionId,
    students,
  ]);

  // Marks the quiz finished and opens the instructor results view.
  const finishQuiz = useCallback(async (overrides = {}) => {
    if (!sessionId || finishInFlightRef.current) return;

    finishInFlightRef.current = true;
    try {
      const { data, error: updateError } = await supabase
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

      setSessionData((prev) => ({ ...prev, ...data }));
      navigateToFinalResults({
        ...overrides,
        session: data || overrides.session,
      });

    } catch (err) {
      console.error("Error finishing quiz:", err);
      setError("Failed to finish quiz");
      finishInFlightRef.current = false;
    }
  }, [navigateToFinalResults, sessionId]);

  // Loads live quiz data and subscribes to session/response changes.
  useEffect(() => {
    if (!sessionId) {
      navigate("/instructor/session-official");
      return;
    }

    // Fetches session, players, and responses for the live dashboard.
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
  }, [sessionId, navigate, questionsByDifficulty]);

  // Keeps the instructor timer aligned with the session question end time.
  useEffect(() => {
    if (
      sessionData?.status !== "active" ||
      !sessionData?.current_question_ends_at ||
      !sessionData?.current_question_id
    ) {
      setInstructorTimeLeft(0);
      return undefined;
    }

    // Recomputes remaining question time from the shared end timestamp.
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

  // Navigates if the session was finished by another client or a realtime update.
  useEffect(() => {
    if (sessionData?.status !== "finished") return;
    navigateToFinalResults({ session: sessionData });
  }, [navigateToFinalResults, sessionData]);

  // Polls completion status and finalizes when every joined player is done.
  useEffect(() => {
    if (!sessionId || !sessionData || sessionData.status === "finished") return undefined;

    const isJoinedPlayer = (player) => {
      const status = String(
        player?.status || player?.player_status || player?.state || "joined"
      ).toLowerCase();
      return !["left", "removed", "inactive", "disconnected", "kicked"].includes(status);
    };

    const countAnsweredQuestionsForPlayer = (player, responseList) => {
      const playerKeys = [player?.id, player?.student_name]
        .filter(Boolean)
        .map(String);
      const answeredQuestionIds = new Set();

      responseList.forEach((response) => {
        if (!playerKeys.includes(String(response?.player_id))) return;
        const questionId = String(response?.question_id || "").trim();
        if (questionId) answeredQuestionIds.add(questionId);
      });

      return answeredQuestionIds.size;
    };

    const interval = setInterval(async () => {
      if (hasAutoFinishedRef.current || hasNavigatedToResultsRef.current) {
        clearInterval(interval);
        return;
      }

      const { data: freshSession, error: sessionError } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();

      if (sessionError || !freshSession) {
        if (sessionError) console.error("Polling: error fetching session", sessionError);
        return;
      }

      setSessionData(freshSession);

      if (freshSession.status === "finished") {
        clearInterval(interval);
        navigateToFinalResults({ session: freshSession });
        return;
      }

      const questionCount = Number(
        freshSession.question_count || freshSession.questionCount || 0
      );

      if (questionCount <= 0) return;

      const { data: freshStudents, error: playersError } = await supabase
        .from("session_players")
        .select("*")
        .eq("session_id", sessionId);

      if (playersError) {
        console.error("Polling: error fetching players", playersError);
        return;
      }

      const joinedPlayers = (freshStudents || []).filter(isJoinedPlayer);
      setStudents(freshStudents || []);

      if (joinedPlayers.length === 0) return;

      const { data: freshResponses, error: respError } = await supabase
        .from("responses")
        .select("*")
        .eq("session_id", sessionId);

      if (respError) {
        console.error("Polling: error fetching responses", respError);
        return;
      }

      setResponses(freshResponses || []);

      const allCompleted = joinedPlayers.every(
        (player) =>
          countAnsweredQuestionsForPlayer(player, freshResponses || []) >= questionCount
      );

      if (!allCompleted) return;

      clearInterval(interval);
      hasAutoFinishedRef.current = true;
      await finishQuiz({
        students: joinedPlayers,
        responses: freshResponses || [],
        session: freshSession,
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [finishQuiz, navigateToFinalResults, sessionData, sessionId]);

  // Check if round is truly active (has both status and question)
  const isRoundActive =
    sessionData?.status === "active" &&
    Boolean(sessionData?.current_question_id) &&
    Boolean(sessionData?.current_difficulty);

  // Starts a round using the currently selected difficulty.
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

  // Ends the active round and exposes round results to students.
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

  // Advances the shared session to the next difficulty-selection round.
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

  // Recalculates monitoring stats from the latest students and responses.
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

  // Allows auto-ending again when a new question starts.
  useEffect(() => {
    hasEndedCurrentQuestionRef.current = false;
  }, [sessionData?.current_question_id]);

  // Auto-ends the round when every joined student has answered.
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
      endRoundRef.current?.();
    }
  }, [
    answeredCount,
    totalStudents,
    sessionData?.status,
    sessionData?.current_question_id,
  ]);

  // Schedules automatic movement from round results to the next round.
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
        nextRoundRef.current?.();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [
    sessionData?.status,
    sessionData?.current_round,
    sessionData?.question_count,
    sessionData?.questionCount,
  ]);

  endRoundRef.current = endRound;
  nextRoundRef.current = nextRound;

  // Resets the automatic progression guard for a new round phase.
  useEffect(() => {
    if (
      sessionData?.status === "choosing_difficulty" ||
      (sessionData?.status === "active" && sessionData?.current_question_id)
    ) {
      autoNextRoundRef.current = false;
    }
  }, [sessionData?.status, sessionData?.current_question_id]);

  // Polls instructor data so the dashboard remains fresh.
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

  // Updates the monitor preview when round or difficulty changes.
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
                onClick={() => finishQuiz()}
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
