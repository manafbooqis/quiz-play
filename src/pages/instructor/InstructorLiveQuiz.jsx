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
  const questionsByDifficulty =
    state?.questionsByDifficulty ?? { easy: [], medium: [], hard: [] };
  const timePerQuestion = state?.timePerQuestion ?? 15;

  const [sessionData, setSessionData] = useState(null);
  const [students, setStudents] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState("easy");
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roundResults, setRoundResults] = useState(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const hasNavigatedToResultsRef = useRef(false);

  const totalQuestions = useMemo(() => {
    return (
      (questionsByDifficulty?.easy?.length || 0) +
      (questionsByDifficulty?.medium?.length || 0) +
      (questionsByDifficulty?.hard?.length || 0)
    );
  }, [questionsByDifficulty]);

  const getUsedQuestions = (difficulty) => {
    return responses
      .filter((r) => r.difficulty === difficulty)
      .map((r) => r.question_id);
  };

  const getNextQuestion = (difficulty) => {
    const questions = questionsByDifficulty[difficulty] || [];
    const usedIds = getUsedQuestions(difficulty);
    return questions.find((q) => !usedIds.includes(q.id));
  };

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

        const { data: players, error: playersError } = await supabase
          .from("session_players")
          .select("*")
          .eq("session_id", sessionId);

        if (playersError) throw playersError;

        setStudents(players || []);

        const { data: responseList, error: responsesError } = await supabase
          .from("responses")
          .select("*")
          .eq("session_id", sessionId)
          .order("answered_at", { ascending: true });

        if (responsesError) {
          console.error(
            "Error loading responses:",
            JSON.stringify(responsesError, null, 2)
          );
          console.error("Message:", responsesError.message);
          console.error("Details:", responsesError.details);
          console.error("Hint:", responsesError.hint);
          console.error("Code:", responsesError.code);
          throw responsesError;
        }

        setResponses(responseList || []);

        if (session.current_question_id && questionsByDifficulty) {
          const current = questionsByDifficulty[
            session.current_difficulty
          ]?.find((q) => q.id === session.current_question_id);

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

    const subscription = supabase
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          setSessionData((prev) => ({ ...prev, ...payload.new }));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "responses",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setResponses((prev) => [...prev, payload.new]);
          } else if (payload.eventType === "UPDATE") {
            setResponses((prev) =>
              prev.map((r) => (r.id === payload.new.id ? payload.new : r))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [sessionId, navigate]);

  useEffect(() => {
    if (!sessionId || !sessionData) return;

    const interval = setInterval(async () => {
      if (hasNavigatedToResultsRef.current) {
        clearInterval(interval);
        return;
      }

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

      const responsesByPlayer = {};

      (freshResponses || []).forEach((r) => {
        const pid = r.player_id;
        responsesByPlayer[pid] = (responsesByPlayer[pid] || 0) + 1;
      });

      let allCompleted = students.length > 0;

      students.forEach((student) => {
        const pid = student.id || student.student_name;
        const count = responsesByPlayer[pid] || 0;

        if (count < questionCount) {
          allCompleted = false;
        }
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

        try {
          await supabase
            .from("sessions")
            .update({
              status: "finished",
              quiz_finished_at: new Date().toISOString(),
            })
            .eq("id", sessionId);
        } catch (err) {
          console.error("Error updating session status:", err);
        }

        setResponses(freshResponses || []);

        navigate("/instructor/final-results", {
          state: {
            sessionId,
            gameCode,
            students,
            responses: freshResponses || [],
            questionsByDifficulty,
          },
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [
    sessionId,
    sessionData,
    students,
    navigate,
    gameCode,
    questionsByDifficulty,
  ]);

  const isRoundActive =
    sessionData?.status === "active" &&
    Boolean(sessionData?.current_question_id) &&
    Boolean(sessionData?.current_difficulty);

  const studentScores = useMemo(() => {
    const scores = {};

    students.forEach((student) => {
      const studentId = student.id || student.student_name;

      scores[studentId] = {
        name: getStudentName(student, 0),
        totalScore: 0,
        roundScore: 0,
        answered: false,
        rank: 0,
      };
    });

    responses.forEach((response) => {
      const studentId = response.player_id;

      if (scores[studentId]) {
        scores[studentId].totalScore += response.points_awarded;

        if (response.round_number === sessionData?.current_round) {
          scores[studentId].roundScore += response.points_awarded;
          scores[studentId].answered = true;
        }
      }
    });

    const sorted = Object.values(scores).sort(
      (a, b) => b.totalScore - a.totalScore
    );

    sorted.forEach((student, index) => {
      student.rank = index + 1;
    });

    return sorted;
  }, [students, responses, sessionData?.current_round]);

  const startRound = async () => {
    console.log("selectedDifficulty:", selectedDifficulty);
    console.log("questionsByDifficulty:", questionsByDifficulty);
    console.log("available questions:", questionsByDifficulty?.[selectedDifficulty]);

    const availableQuestions =
      questionsByDifficulty?.[selectedDifficulty] || [];

    if (availableQuestions.length === 0) {
      setError("No questions available for this difficulty.");
      return;
    }

    const nextQuestion = availableQuestions[0];

    const questionId =
      nextQuestion?.id ||
      nextQuestion?.question_id ||
      nextQuestion?.qid ||
      `${selectedDifficulty}-${Date.now()}`;

    if (!questionId) {
      setError("Selected question is missing an id.");
      return;
    }

    const normalizedQuestion = {
      ...nextQuestion,
      id: questionId,
    };

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

    const updatePayload = {
      status: "active",
      current_question_id: questionId,
      current_difficulty: selectedDifficulty,
      current_round: nextRound,
      show_round_results: false,
      current_question_started_at: new Date().toISOString(),
      current_question_ends_at: new Date(
        Date.now() + Number(timePerQuestion || 10) * 1000
      ).toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from("sessions")
        .update(updatePayload)
        .eq("id", finalSessionId)
        .select(
          "id, game_code, status, current_question_id, current_difficulty, current_round"
        )
        .single();

      if (error) {
        console.error("Start Round Supabase error full:", error);
        setError("Failed to start round.");
        return;
      }

      console.log("Start Round updated session:", data);

      if (!data?.current_question_id || !data?.current_difficulty) {
        console.error("Start Round failed verification:", data);
        setError("Round started but current question was not saved.");
        return;
      }

      setCurrentQuestion(normalizedQuestion);
      setRoundResults(null);
      setError("");
    } catch (err) {
      console.error("Start round caught error:", err);
      setError("Failed to start round");
    }
  };

  const endRound = async () => {
    try {
      const { error: updateError } = await supabase
        .from("sessions")
        .update({
          status: "round_results",
          show_round_results: true,
          current_question_ends_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (updateError) throw updateError;

      const roundResponses = responses.filter(
        (r) => r.round_number === sessionData?.current_round
      );

      setRoundResults(roundResponses);
    } catch (err) {
      console.error("Error ending round:", err);
      setError("Failed to end round");
    }
  };

  const nextRound = async () => {
    const nextRoundNumber = (sessionData?.current_round || 1) + 1;
    const totalRounds = Math.ceil(totalQuestions / 3);

    if (nextRoundNumber > totalRounds) {
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
            show_round_results: false,
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

  const finishQuiz = async () => {
    try {
      const { error: updateError } = await supabase
        .from("sessions")
        .update({
          status: "finished",
          quiz_finished_at: new Date().toISOString(),
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
        },
      });
    } catch (err) {
      console.error("Error finishing quiz:", err);
      setError("Failed to finish quiz");
    }
  };

  useEffect(() => {
    if (!sessionData?.question_count || students.length === 0) return;

    const questionCount = Number(sessionData.question_count);
    let allCompleted = true;
    const responsesByPlayer = {};

    students.forEach((s) => {
      const pId = s.student_name || s.id;
      const count = responses.filter((r) => r.player_id === pId).length;

      responsesByPlayer[pId] = count;

      if (count < questionCount) {
        allCompleted = false;
      }
    });

    console.log("Instructor completion check:", {
      totalStudents: students.length,
      questionCount,
      responsesByPlayer,
      allCompleted,
    });

    if (allCompleted && sessionData.status === "active") {
      console.log("All students completed quiz. Navigating to final results.");

      supabase
        .from("sessions")
        .update({
          status: "finished",
          quiz_finished_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .then(() => {
          navigate("/instructor/final-results", {
            state: {
              sessionId,
              gameCode,
              students,
              responses,
              questionsByDifficulty,
            },
          });
        })
        .catch((err) => console.error("Error setting session finished:", err));
    }
  }, [
    responses.length,
    students,
    sessionData?.question_count,
    sessionData?.status,
    navigate,
    sessionId,
    gameCode,
    questionsByDifficulty,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-700 text-xl font-semibold">
          Loading quiz...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold">
            Live Quiz Dashboard
          </h1>

          <p className="text-slate-500 mt-2">
            Game Code:{" "}
            <span className="font-semibold text-slate-800">{gameCode}</span>
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-2xl font-bold">Student Rankings</h2>
              <p className="text-sm text-slate-500 mt-1">
                Current student scores during the live quiz.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-100 border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">
              {studentScores.length} students
            </div>
          </div>

          <div className="space-y-3">
            {studentScores.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="font-semibold text-slate-700">
                  No students yet
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Rankings will appear after students join and answer.
                </p>
              </div>
            ) : (
              studentScores.map((student) => (
                <div
                  key={student.name}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-11 w-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center font-extrabold text-slate-800 shrink-0">
                        {student.rank}
                      </div>

                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">
                          {student.name}
                        </p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {student.answered ? "Answered" : "Waiting"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-2xl font-extrabold text-slate-900">
                        {student.totalScore}
                      </p>
                      <p className="text-xs text-slate-500">points</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            {!showEndConfirm ? (
              <button
                onClick={() => setShowEndConfirm(true)}
                className="w-full px-5 py-3.5 rounded-2xl bg-red-500 text-white hover:bg-red-600 transition font-bold"
              >
                End Quiz
              </button>
            ) : (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700 mb-4 text-center">
                  Are you sure you want to end the quiz?
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={finishQuiz}
                    className="w-full px-5 py-3 rounded-2xl bg-red-500 text-white hover:bg-red-600 transition font-bold"
                  >
                    Confirm End Quiz
                  </button>

                  <button
                    onClick={() => setShowEndConfirm(false)}
                    className="w-full px-5 py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition font-bold text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default InstructorLiveQuiz;