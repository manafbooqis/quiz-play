import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function Difficulty() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const studentName = state?.studentName ?? "";
  const gameCode = state?.gameCode ?? "";
  const sessionId = state?.sessionId ?? "";
  const playerId = studentName;
  const questionsByDifficulty = state?.questionsByDifficulty || {};

  const hasSessionData = Boolean(studentName && gameCode);
  
  const [answeredIds, setAnsweredIds] = useState([]);

  useEffect(() => {
    if (!hasSessionData) return;
    const localKey = `quizplay_answered_questions_${gameCode}_${playerId}`;
    const stored = localStorage.getItem(localKey);
    if (stored) {
      setAnsweredIds(JSON.parse(stored));
    }
  }, [hasSessionData, gameCode, playerId]);

  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!hasSessionData || !sessionId) return;
    const fetchSession = async () => {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();
      if (data) setSession(data);
    };
    fetchSession();
  }, [hasSessionData, sessionId]);

  const maxQuestions =
    Number(state?.questionCount) ||
    Number(session?.question_count) ||
    Number(session?.questionCount) ||
    Number(state?.maxQuestions) ||
    1;

  useEffect(() => {
    if (!hasSessionData) return;
    
    if (answeredIds.length >= maxQuestions) {
      navigate("/student/final-results", { state: { ...state, questionCount: maxQuestions } });
    }
  }, [hasSessionData, answeredIds.length, maxQuestions, navigate, state]);

  if (!hasSessionData) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8 text-center">
          <h1 className="game-font text-3xl text-yellow-300 mb-4">Oops!</h1>
          <p className="text-slate-300 mb-6">You need to join a game first.</p>
          <button
            onClick={() => navigate("/student/join")}
            className="game-font bg-cyan-500 hover:bg-cyan-400 text-slate-900 py-3 px-6 rounded-xl transition"
          >
            Go to Join Page
          </button>
        </div>
      </div>
    );
  }

  const handleDifficultySelect = (difficulty, points) => {
    const bank = questionsByDifficulty[difficulty] || [];
    
    // Find first unanswered question
    const unansweredQuestion = bank.find(q => 
      !answeredIds.includes(q.id) && 
      !answeredIds.includes(q.question_id) && 
      !answeredIds.includes(q.qid)
    );

    if (unansweredQuestion) {
      const questionId = unansweredQuestion.id || unansweredQuestion.question_id || unansweredQuestion.qid;
      navigate("/student/question", {
        state: {
          ...state,
          currentDifficulty: difficulty,
          currentQuestionId: questionId,
          pointsPerQuestion: points,
          questionCount: maxQuestions,
        },
      });
    } else {
      alert(`No questions available for ${difficulty} difficulty. Please choose another.`);
    }
  };

  const getAvailableCount = (difficulty) => {
    const bank = questionsByDifficulty[difficulty] || [];
    return bank.filter(q => 
      !answeredIds.includes(q.id) && 
      !answeredIds.includes(q.question_id) && 
      !answeredIds.includes(q.qid)
    ).length;
  };

  const cards = [
    { label: "Easy", diff: "easy", points: 10, badge: "bg-emerald-400" },
    { label: "Medium", diff: "medium", points: 25, badge: "bg-yellow-300" },
    { label: "Hard", diff: "hard", points: 50, badge: "bg-red-400" },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-4xl bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="game-font text-3xl text-cyan-300">Pick Difficulty</h1>
            <p className="text-slate-300 mt-2">
              Answered: <span className="text-white font-semibold">{answeredIds.length}</span> / {maxQuestions}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          {cards.map((c) => {
            const availableCount = getAvailableCount(c.diff);
            const isExhausted = availableCount === 0;

            return (
              <div
                key={c.diff}
                className={`relative border rounded-2xl p-6 transition ${isExhausted ? 'bg-slate-800 border-slate-700 opacity-60' : 'bg-slate-900 border-slate-700'}`}
              >
                {!isExhausted && (
                  <div className={`absolute -top-4 left-1/2 -translate-x-1/2 ${c.badge} text-slate-900 font-bold rounded-full px-3 py-1 shadow`}>
                    +{c.points}
                  </div>
                )}

                <h2 className="game-font text-4xl text-white mt-10">{c.label}</h2>

                <button
                  onClick={() => handleDifficultySelect(c.diff, c.points)}
                  disabled={isExhausted}
                  className={`w-full mt-8 game-font py-3 rounded-xl transition ${isExhausted ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-yellow-300 hover:bg-yellow-200 text-slate-900'}`}
                >
                  {isExhausted ? "Exhausted" : "Select"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Difficulty;
