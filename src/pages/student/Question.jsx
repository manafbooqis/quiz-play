import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function Question() {
  const navigate = useNavigate();
  const { state } = useLocation();
  
  const studentName = state?.studentName ?? "";
  const gameCode = state?.gameCode ?? "";
  const sessionId = state?.sessionId ?? "";
  const currentRound = state?.currentRound ?? 1;
  const currentQuestionId = state?.currentQuestionId ?? null;
  const currentDifficulty = state?.currentDifficulty ?? null;
  const playerId = studentName;
  
  const [sessionData, setSessionData] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const maxQuestions =
    Number(state?.questionCount) ||
    Number(sessionData?.question_count) ||
    Number(sessionData?.questionCount) ||
    Number(state?.maxQuestions) ||
    1;

  useEffect(() => {
    if (!gameCode || !studentName) {
      navigate("/student/join");
      return;
    }

    async function loadSessionAndQuestion() {
      try {
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("game_code", gameCode)
          .single();

        if (sessionError) throw sessionError;
        setSessionData(session);

        if (session.status === "round_results") {
          navigate("/student/round-results", {
            state: { studentName, gameCode, sessionId: session.id, currentRound: session.current_round }
          });
          return;
        }

        if (session.status === "finished") {
          navigate("/student/final-results", {
            state: { studentName, gameCode, sessionId: session.id }
          });
          return;
        }

        if (session.status === "waiting") {
          navigate("/student/lobby", {
            state: { studentName, gameCode }
          });
          return;
        }

        if (session.status === "active") {
          const difficulty = currentDifficulty || session.current_difficulty || "easy";
          const questionId = currentQuestionId || session.current_question_id;

          const localKey = `quizplay_session_${gameCode}`;
          const raw = localStorage.getItem(localKey);
          const config = raw ? JSON.parse(raw) : null;
          
          const isValidBank = (b) => b && Object.keys(b).length > 0 && Object.values(b).some((arr) => Array.isArray(arr) && arr.length > 0);

          const questionsByDifficulty = 
            (isValidBank(state?.questionsByDifficulty) ? state.questionsByDifficulty : null) || 
            (isValidBank(session.questions_by_difficulty) ? session.questions_by_difficulty : null) || 
            (isValidBank(session.questionsByDifficulty) ? session.questionsByDifficulty : null) || 
            (isValidBank(config?.questionsByDifficulty) ? config.questionsByDifficulty : null) || 
            (isValidBank(config?.questions_by_difficulty) ? config.questions_by_difficulty : null) || 
            {};

          const bank = questionsByDifficulty?.[difficulty] || [];
          const foundQuestion = bank.find((q) =>
            q.id === questionId ||
            q.question_id === questionId ||
            q.qid === questionId
          );

          console.log("Question state:", state);
          console.log("Question session:", session);
          console.log("Question id:", questionId);
          console.log("Difficulty:", difficulty);
          console.log("Question bank:", bank);
          console.log("Found question:", foundQuestion);

          if (foundQuestion) {
            setCurrentQuestion(foundQuestion);
          } else {
            setError("Current question could not be loaded.");
          }
        }

      } catch (err) {
        console.error("Error loading session:", err);
        setError("Failed to load session data");
      } finally {
        setLoading(false);
      }
    }

    loadSessionAndQuestion();

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

        if (updatedSession.status === "round_results") {
          navigate("/student/round-results", {
            state: { studentName, gameCode, sessionId: updatedSession.id, currentRound: updatedSession.current_round }
          });
        } else if (updatedSession.status === "finished") {
          navigate("/student/final-results", {
            state: { studentName, gameCode, sessionId: updatedSession.id }
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [gameCode, studentName, sessionId, currentRound, navigate]);

  useEffect(() => {
    if (sessionData?.current_question_ends_at && !hasAnswered) {
      const interval = setInterval(() => {
        const now = new Date();
        const endTime = new Date(sessionData.current_question_ends_at);
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeLeft(remaining);

        if (remaining === 0 && !hasAnswered) {
          if (selectedAnswer !== null) {
            handleSubmit();
          } else {
            setSelectedAnswer(-1); // Force an incorrect answer instead of null
            handleSubmit(-1);
          }
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [sessionData?.current_question_ends_at, hasAnswered, selectedAnswer]);

  useEffect(() => {
    if (sessionId && sessionData?.current_question_id) {
      checkIfAlreadyAnswered();
    }
  }, [sessionId, sessionData?.current_question_id]);

  const checkIfAlreadyAnswered = async () => {
    try {
      const targetQuestionId = currentQuestionId || sessionData?.current_question_id;
      if (!targetQuestionId) return;

      const { data: existingResponse } = await supabase
        .from("responses")
        .select("*")
        .eq("session_id", sessionId)
        .eq("question_id", targetQuestionId)
        .eq("player_id", studentName)
        .maybeSingle();

      if (existingResponse) {
        setHasAnswered(true);
        setSelectedAnswer(existingResponse.selected_answer);
        
        const localKey = `quizplay_answered_questions_${gameCode}_${playerId}`;
        const stored = localStorage.getItem(localKey);
        const answered = stored ? JSON.parse(stored) : [];
        if (!answered.includes(targetQuestionId)) {
          answered.push(targetQuestionId);
          localStorage.setItem(localKey, JSON.stringify(answered));
        }

        const reachedLimit = answered.length >= maxQuestions;

        if (reachedLimit) {
          navigate("/student/final-results", {
            state: { ...state, studentName, gameCode, sessionId, currentRound: sessionData.current_round, questionCount: maxQuestions }
          });
        } else {
          navigate("/student/difficulty", {
            state: { ...state, studentName, gameCode, sessionId, currentRound: sessionData.current_round, questionCount: maxQuestions }
          });
        }
      }
    } catch (err) {
      // No existing response is fine
    }
  };

  const handleSubmit = async (answerOverride = null) => {
    if (hasAnswered || isSubmitting) return;

    if (!currentQuestion) {
      setError("Question is still loading. Please wait.");
      return;
    }

    const finalAnswer = answerOverride !== null ? answerOverride : selectedAnswer;

    if (finalAnswer === null || finalAnswer === undefined) {
      setError("Please select an answer before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      const correctAnswer =
        currentQuestion.correctAnswer ??
        currentQuestion.correct_answer ??
        currentQuestion.correct_option ??
        0;

      const isCorrect = Number(selectedAnswer) === Number(correctAnswer);
      const pointsAwarded = isCorrect ? 100 : 0;

      const targetQuestionId = currentQuestion.id || currentQuestionId || sessionData.current_question_id;

      const responsePayload = {
        session_id: sessionId,
        question_id: targetQuestionId,
        player_id: playerId || studentName,
        round_number: currentRound || 1,
        selected_answer: finalAnswer,
        is_correct: isCorrect,
        points_awarded: pointsAwarded,
      };

      console.log("Selected answer before submit:", finalAnswer);
      console.log("Current question before submit:", currentQuestion);
      console.log("Response insert payload:", responsePayload);

      const { error: upsertError } = await supabase
        .from("responses")
        .upsert(responsePayload, {
          onConflict: "session_id,question_id,player_id"
        });

      if (upsertError) throw upsertError;

      setHasAnswered(true);

      const { data: playerRecord } = await supabase
        .from("session_players")
        .select("*")
        .eq("session_id", sessionId)
        .eq("student_name", studentName)
        .maybeSingle();

      if (playerRecord) {
        const newTotalScore = (playerRecord.total_score || 0) + pointsAwarded;
        await supabase
          .from("session_players")
          .update({ total_score: newTotalScore })
          .eq("id", playerRecord.id);
      }

      // Add to local storage
      const localKey = `quizplay_answered_questions_${gameCode}_${playerId}`;
      const stored = localStorage.getItem(localKey);
      const answered = stored ? JSON.parse(stored) : [];
      if (!answered.includes(targetQuestionId)) {
        answered.push(targetQuestionId);
        localStorage.setItem(localKey, JSON.stringify(answered));
      }

      const reachedLimit = answered.length >= maxQuestions;

      if (reachedLimit) {
        navigate("/student/final-results", {
          state: {
            ...state,
            studentName,
            gameCode,
            sessionId,
            currentRound: sessionData.current_round,
            questionCount: maxQuestions
          }
        });
      } else {
        navigate("/student/difficulty", {
          state: {
            ...state,
            studentName,
            gameCode,
            sessionId,
            currentRound: sessionData.current_round,
            questionCount: maxQuestions
          }
        });
      }

    } catch (err) {
      console.error("Error submitting answer:", err);
      setError(err.message || "Failed to submit answer");
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-xl font-semibold">Loading question...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Error</h1>
          <p className="text-slate-300 mb-6">{error}</p>
          <button
            onClick={() => setError("")}
            className="px-4 py-2 rounded-xl bg-cyan-500 text-white hover:bg-cyan-600 transition font-semibold"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-yellow-300 mb-4">Waiting for Question</h1>
          <p className="text-slate-300 mb-6">The instructor will start the next question soon.</p>
        </div>
      </div>
    );
  }

  const options = currentQuestion.options || currentQuestion.choices || [];

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-3xl bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="game-font text-3xl text-cyan-300">Question</h1>
            <p className="text-slate-300 mt-1">
              Round {currentRound} • Difficulty:{" "}
              <span className="text-white capitalize">{sessionData?.current_difficulty || "unknown"}</span>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-slate-900 border border-slate-600 rounded-2xl px-5 py-3 text-center">
              <p className="text-slate-300 text-sm">Time</p>
              <p className="game-font text-2xl text-yellow-300">{formatTime(timeLeft)}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
          <p className="game-font text-2xl mb-4">{currentQuestion.question || currentQuestion.q || currentQuestion.question_text}</p>
          <p className="text-slate-400 text-sm">Choose one answer.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {options.map((option, index) => (
            <button
              type="button"
              key={index}
              onClick={() => setSelectedAnswer(index)}
              disabled={hasAnswered}
              className={[
                "text-left rounded-xl p-4 transition border-2",
                hasAnswered ? "cursor-not-allowed" : "hover:bg-slate-700",
                "bg-slate-900",
                selectedAnswer === index
                  ? "border-cyan-400 bg-cyan-900/30"
                  : "border-slate-700"
              ].join(" ")}
            >
              <span className="text-white font-medium">
                {String.fromCharCode(65 + index)}. {option}
              </span>
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={hasAnswered || isSubmitting || selectedAnswer === null || !currentQuestion}
            className="px-8 py-3 rounded-xl bg-cyan-500 text-slate-900 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 transition font-bold text-lg"
          >
            Submit Answer
          </button>
        </div>

        {hasAnswered && (
          <div className="mt-6 p-4 rounded-xl border border-cyan-200 bg-cyan-900/20 text-center">
            <p className="text-cyan-200">
              Answer submitted! Waiting for other students...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Question;
