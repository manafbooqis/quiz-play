import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import {
  supabase,
  getProfile,
  getSessionById,
  getSessionPlayers,
} from "../../lib/supabase";

function SessionOfficial() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const params = useParams();

  const gameCode = state?.gameCode || params.gameCode || params.code || "";
  const localSessionKey = gameCode ? `quizplay_session_${gameCode}` : "";

  const [sessionData, setSessionData] = useState(() => state || null);
  const [sessionPlayers, setSessionPlayers] = useState([]);
  const [loading, setLoading] = useState(() => !state);
  const [copyMessage, setCopyMessage] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [authError, setAuthError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const fallbackSession = useMemo(() => {
    // Fresh navigation state must beat localStorage so a new upload never inherits an old cached bank.
    if (state && gameCode && (state.gameCode === gameCode || !state.gameCode)) {
      return {
        ...state,
        gameCode,
        id: state.sessionId ?? state.id,
        fileName: state.fileName,
        questionCount: state.questionCount,
        timePerQuestion: state.timePerQuestion,
        players: state.students || state.players || [],
        questionsByDifficulty:
          state.questionsByDifficulty ?? state.questions_by_difficulty,
        questions_by_difficulty:
          state.questions_by_difficulty ?? state.questionsByDifficulty,
        isGuest: state.isGuest ?? false,
        localOnly: state.localOnly ?? false,
      };
    }

    if (gameCode && localSessionKey) {
      try {
        const raw = localStorage.getItem(localSessionKey);
        const parsed = raw ? JSON.parse(raw) : null;

        if (parsed) {
          return parsed;
        }
      } catch (error) {
        console.error("Failed to read local session:", error);
      }
    }

    if (!state || !gameCode) {
      return null;
    }

    return {
      gameCode,
      fileName: state.fileName,
      questionCount: state.questionCount,
      timePerQuestion: state.timePerQuestion,
      players: state.students || [],
      questionsByDifficulty: state.questionsByDifficulty,
      isGuest: state.isGuest ?? false,
      localOnly: state.localOnly ?? false,
    };
  }, [gameCode, localSessionKey, state]);

  useEffect(() => {
    let isMounted = true;

    async function handleUserState(user) {
      if (!isMounted) {
        return;
      }

      setIsLoggedIn(!!user);
      setAuthError("");

      if (!user) {
        setTeacherName("");
        setTeacherEmail("");
        return;
      }

      const isAnonymous =
        user.is_anonymous === true || user.user_metadata?.is_guest === true;

      if (isAnonymous) {
        setTeacherName("Guest Instructor");
        setTeacherEmail("Guest Account");
        return;
      }

      setTeacherEmail(user.email || "");

      try {
        const { data: profile, error } = await getProfile(user.id);

        if (error) {
          throw error;
        }

        const name =
          profile?.full_name ||
          profile?.name ||
          user.user_metadata?.full_name ||
          "Instructor";

        setTeacherName(String(name));
      } catch (error) {
        console.error("Failed to load teacher profile:", error);
        setTeacherName("Instructor");
      }
    }

    async function loadAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await handleUserState(session?.user ?? null);
    }

    loadAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_, session) => {
        handleUserState(session?.user ?? null);
      }
    );

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadSessionData() {
      if (!gameCode) {
        setLoading(false);
        return;
      }

      if (state && (state.gameCode === gameCode || !state.gameCode)) {
        setSessionData({
          ...state,
          game_code: state.gameCode ?? gameCode,
          gameCode,
          id: state.sessionId ?? state.id,
          questions_by_difficulty:
            state.questions_by_difficulty ?? state.questionsByDifficulty,
          questionsByDifficulty:
            state.questionsByDifficulty ?? state.questions_by_difficulty,
        });
        setLoading(false);
        return;
      }

      if (fallbackSession?.localOnly) {
        setSessionData(fallbackSession);
        setLoading(false);
        return;
      }

      setAuthError("");

      try {
        setLoading(true);

        const sessionRow = await getSessionById(gameCode);

        if (!sessionRow) {
          throw new Error("Session not found");
        }

        if (!isMounted) {
          return;
        }

        if (sessionRow) {
          setSessionData(sessionRow);
        } else if (fallbackSession) {
          setSessionData(fallbackSession);
        } else {
          setSessionData(null);
        }
      } catch (error) {
        console.error("Error reading session:", error);

        if (!isMounted) {
          return;
        }

        setSessionData(fallbackSession);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadSessionData();

    return () => {
      isMounted = false;
    };
  }, [fallbackSession, gameCode, state]);

  useEffect(() => {
    if (!gameCode || sessionData?.localOnly || fallbackSession?.localOnly) {
      return;
    }

    let isMounted = true;

    async function loadPlayers() {
      try {
        const { data: players, error: playersError } =
          await getSessionPlayers(gameCode);

        if (playersError) {
          throw playersError;
        }

        if (isMounted) {
          setSessionPlayers(Array.isArray(players) ? players : []);
        }
      } catch (error) {
        console.error("Error reading session players:", error);

        if (isMounted) {
          setSessionPlayers([]);
        }
      }
    }

    loadPlayers();

    const intervalId = setInterval(loadPlayers, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [gameCode, sessionData?.localOnly, fallbackSession?.localOnly]);

  useEffect(() => {
    if (!gameCode || !sessionData) {
      return;
    }

    try {
      localStorage.setItem(
        `quizplay_session_${gameCode}`,
        JSON.stringify({
          ...sessionData,
          gameCode,
          questionsByDifficulty:
            sessionData.questions_by_difficulty ||
            sessionData.questionsByDifficulty,
          questions_by_difficulty:
            sessionData.questions_by_difficulty ||
            sessionData.questionsByDifficulty,
        })
      );
    } catch (error) {
      console.error("Failed to sync session locally:", error);
    }
  }, [gameCode, sessionData]);

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

      if (text) {
        return text;
      }
    }

    return `Student ${index + 1}`;
  }

  function getStudentInitial(student, index) {
    const name = getStudentName(student, index).trim();
    return name ? name.charAt(0).toUpperCase() : "?";
  }

  function normalizeStudent(student, index) {
    if (student && typeof student === "object" && !Array.isArray(student)) {
      return {
        id: student.id ?? index,
        session_id: student.session_id ?? null,
        name: getStudentName(student, index),
        joined_at:
          student.joined_at || student.joinedAt || new Date().toISOString(),
      };
    }

    return {
      id: index,
      session_id: null,
      name: getStudentName(student, index),
      joined_at: new Date().toISOString(),
    };
  }

  const isMissingGameCode = !gameCode;
  const isPageLoading = !isMissingGameCode && loading;

  if (isMissingGameCode) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            No session data found
          </h1>
          <p className="text-slate-500 mb-6">
            Please go back and create a session first.
          </p>
          <button
            onClick={() => navigate("/instructor/dashboard-official")}
            className="w-full px-5 py-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 transition font-bold"
          >
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="text-slate-700 text-xl font-semibold">
          Loading session...
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            Session not found
          </h1>
          <p className="text-slate-500 mb-6">This session does not exist.</p>
          <button
            onClick={() => navigate("/instructor/dashboard-official")}
            className="w-full px-5 py-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 transition font-bold"
          >
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  const fileName =
    sessionData.file_name ?? sessionData.fileName ?? "No file uploaded";

  const questionCount =
    sessionData.question_count ?? sessionData.questionCount ?? 5;

  const timePerQuestion =
    sessionData.time_per_question ?? sessionData.timePerQuestion ?? 5;

  const questionsByDifficulty =
    sessionData.questionsByDifficulty ||
    sessionData.questions_by_difficulty ||
    {
      easy: [],
      medium: [],
      hard: [],
    };

  const totalQuestions =
    (questionsByDifficulty?.easy?.length || 0) +
    (questionsByDifficulty?.medium?.length || 0) +
    (questionsByDifficulty?.hard?.length || 0);

  const rawStudents = sessionPlayers.length
    ? sessionPlayers
    : Array.isArray(sessionData.players)
    ? sessionData.players
    : [];

  const students = rawStudents.map((student, index) =>
    normalizeStudent(student, index)
  );

  const isLocalOnlySession = Boolean(sessionData.localOnly);

  const joinUrl = `${window.location.origin}${
    import.meta.env.BASE_URL
  }student/join?code=${gameCode}`;

  const displayName = teacherName || "Guest";
  const initials = displayName.trim().charAt(0).toUpperCase();

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopyMessage("Link copied!");
      setTimeout(() => setCopyMessage(""), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
      setCopyMessage("Copy failed.");
      setTimeout(() => setCopyMessage(""), 2000);
    }
  }

  async function handleLogout() {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      setMenuOpen(false);
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
      setAuthError("Failed to log out. Please try again.");
    }
  }

  async function handleStartQuiz() {
    if (students.length === 0) return;

    if (totalQuestions === 0) {
      setAuthError("Add at least one question before starting the quiz.");
      return;
    }

    let startingDifficulty = "easy";
    let startingQuestion = questionsByDifficulty.easy?.[0];

    if (!startingQuestion) {
      startingDifficulty = "medium";
      startingQuestion = questionsByDifficulty.medium?.[0];
    }

    if (!startingQuestion) {
      startingDifficulty = "hard";
      startingQuestion = questionsByDifficulty.hard?.[0];
    }

    if (!startingQuestion) {
      setAuthError("Add at least one question before starting the quiz.");
      return;
    }

    const questionId =
      startingQuestion.id ||
      startingQuestion.question_id ||
      startingQuestion.qid ||
      `${startingDifficulty}-${Date.now()}`;

    const finalSessionId = sessionData?.id || sessionData?.sessionId;

    try {
      const updatePayload = {
        status: "active",
        current_question_id: questionId,
        current_difficulty: startingDifficulty,
        current_round: 1,
        show_round_results: false,
        current_question_started_at: new Date().toISOString(),
        current_question_ends_at: new Date(
          Date.now() + Number(timePerQuestion || 10) * 1000
        ).toISOString(),
      };

      if (
        !sessionData?.questions_by_difficulty ||
        Object.keys(sessionData?.questions_by_difficulty || {}).length === 0
      ) {
        updatePayload.questions_by_difficulty = questionsByDifficulty;
      }

      const { error } = await supabase
        .from("sessions")
        .update(updatePayload)
        .eq("id", finalSessionId);

      if (error) {
        console.error("Error starting quiz:", error);
        setAuthError("Failed to start quiz.");
        return;
      }

      navigate("/instructor/live-quiz", {
        state: {
          sessionId: finalSessionId,
          gameCode,
          fileName,
          questionCount,
          timePerQuestion,
          students,
          questionsByDifficulty,
        },
      });
    } catch (error) {
      console.error("Error starting quiz:", error);
      setAuthError("Failed to start quiz.");
    }
  }

  function handleManageQuestions() {
    navigate("/instructor/questions-preview", {
      state: {
        sessionId: sessionData?.id ?? sessionData?.sessionId ?? state?.sessionId,
        gameCode,
        fileName,
        questionCount,
        timePerQuestion,
        students,
        questionsByDifficulty,
        fromSession: true,
      },
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold mt-1">
              Session Dashboard
            </h1>

            <p className="text-slate-500 mt-2">
              Share the QR code, review students, and start the quiz.
            </p>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm hover:bg-slate-50 transition"
            >
              <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                {initials}
              </div>

              <div className="text-left min-w-0 max-w-[180px]">
                <p className="font-bold text-slate-900 truncate">
                  {displayName}
                </p>
                <p className="text-sm text-slate-500 truncate">
                  {isLoggedIn ? teacherEmail : "Guest Mode"}
                </p>
              </div>

              <span className="text-slate-400">▼</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-lg p-3 z-20">
                <div className="px-2 py-2 border-b border-slate-100">
                  <p className="font-semibold truncate">{displayName}</p>
                  <p className="text-sm text-slate-500 truncate">
                    {isLoggedIn ? teacherEmail : "Guest Mode"}
                  </p>
                </div>

                <div className="pt-2">
                  {isLoggedIn ? (
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-600 font-semibold transition"
                    >
                      Logout
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate("/instructor/login");
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold transition"
                    >
                      Login
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {!isLoggedIn && (
          <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-800">
            Guest mode is active. Log in to save your session.
          </div>
        )}

        {isLocalOnlySession && (
          <div className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4 text-cyan-900">
            This session is stored locally on this device.
          </div>
        )}

        {authError && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {authError}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Session Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  File
                </p>
                <p className="font-semibold text-slate-900 break-words">
                  {fileName}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  Join Code
                </p>
                <p className="text-2xl font-extrabold tracking-[0.15em] text-slate-900">
                  {gameCode}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  Questions &amp; bank
                </p>
                <p className="text-2xl font-bold text-slate-900">
                  {questionCount} Questions
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {questionCount} per difficulty in bank ({questionCount * 3}{" "}
                  total)
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  Time per question
                </p>
                <p className="text-2xl font-bold text-slate-900">
                  {timePerQuestion}s
                </p>
              </div>

              <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-4">
                  Share with Students
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-col items-center justify-center min-h-[210px]">
                    <QRCodeCanvas value={joinUrl} size={150} />

                    <p className="text-xs text-slate-500 mt-4 text-center">
                      Scan to join
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={handleCopyLink}
                      className="px-5 py-3 rounded-3xl bg-white border border-slate-200 hover:bg-slate-100 transition font-bold"
                    >
                      Copy Link
                    </button>

                    <button
                      onClick={handleManageQuestions}
                      className="px-5 py-3 rounded-3xl bg-white border border-slate-200 hover:bg-slate-100 transition font-bold"
                    >
                      Review or Edit Questions
                    </button>

                    <button
                      onClick={() => navigate("/instructor/dashboard-official")}
                      className="px-5 py-3 rounded-3xl bg-white border border-slate-200 hover:bg-slate-100 transition font-bold"
                    >
                      Back to Setup
                    </button>
                  </div>
                </div>

                {copyMessage && (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 text-sm">
                    {copyMessage}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-7 shadow-sm h-fit">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold">Joined Students</h2>
                <p className="text-slate-500 text-sm mt-1">
                  Students currently in this session.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-100 border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
                {students.length}
              </div>
            </div>

            <div className="space-y-3">
              {students.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                  <p className="font-semibold text-slate-700">
                    No students yet
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Share the QR code or link with students.
                  </p>
                </div>
              ) : (
                students.map((student, index) => (
                  <div
                    key={`${getStudentName(student, index)}-${
                      student.id ?? index
                    }`}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 shrink-0">
                        {getStudentInitial(student, index)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 truncate">
                          {getStudentName(student, index)}
                        </p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          Ready to play
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {students.length === 0 && (
              <p className="mt-4 text-sm text-slate-500 text-center">
                Waiting for at least one student.
              </p>
            )}

            {totalQuestions === 0 && (
              <p className="mt-4 text-sm text-red-600 font-semibold text-center">
                Add at least one question before starting.
              </p>
            )}

            <button
              onClick={handleStartQuiz}
              disabled={students.length === 0 || totalQuestions === 0}
              className={[
                "mt-6 w-full px-5 py-3.5 rounded-2xl transition font-bold",
                students.length > 0 && totalQuestions > 0
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed",
              ].join(" ")}
            >
              Start Quiz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SessionOfficial;
