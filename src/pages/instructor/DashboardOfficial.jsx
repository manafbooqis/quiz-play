import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  supabase,
  getProfile,
  upsertProfile,
  getSessionsByOwner,
} from "../../lib/supabase";

function DashboardOfficial() {
  const navigate = useNavigate();

  const gameCode = useMemo(() => {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const nums = "23456789";
    const pick = (s) => s[Math.floor(Math.random() * s.length)];
    return `${pick(letters)}${pick(letters)}${pick(nums)}${pick(nums)}`;
  }, []);

  const [selectedFile, setSelectedFile] = useState(null);
  const [questionCount, setQuestionCount] = useState(5);
  const [timePerQuestion, setTimePerQuestion] = useState(5);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [teacherSessions, setTeacherSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [savedQuestionBanks, setSavedQuestionBanks] = useState([]);
  const [selectedQuestionBank, setSelectedQuestionBank] = useState(null);
  const [useExistingBank, setUseExistingBank] = useState(false);

  const MIN_QUESTIONS = 3;
  const MAX_QUESTIONS = 20;
  const MIN_TIME = 5;
  const MAX_TIME = 30;

  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndLoadUser() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          navigate("/instructor/login");
          return;
        }

        const user = session.user;

        if (!isMounted) return;

        const isAnonymousUser =
          user.is_anonymous || user.user_metadata?.is_anonymous === true;

        setCurrentUser(user);
        setTeacherEmail(user.email || "");
        setError("");

        try {
          const { data: profile, error: profileError } = await getProfile(
            user.id
          );

          if (profileError) {
            throw profileError;
          }

          let name;
          if (isAnonymousUser) {
            name = "Guest Instructor";
          } else {
            name =
              profile?.full_name ||
              profile?.name ||
              user.user_metadata?.full_name ||
              "Instructor";
          }

          setTeacherName(name);

          const { error: upsertError } = await upsertProfile({
            id: user.id,
            full_name: name,
            email: user.email,
            role: "instructor",
            is_guest: isAnonymousUser || undefined,
            updated_at: new Date().toISOString(),
          });

          if (upsertError) {
            console.warn("Failed to update teacher profile:", upsertError);
          }
        } catch (profileError) {
          console.error("Failed to load teacher profile:", profileError);
          setTeacherName(isAnonymousUser ? "Guest Instructor" : "Instructor");
        }
      } catch (authError) {
        console.error("Auth check failed:", authError);
        navigate("/instructor/login");
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    }

    checkAuthAndLoadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_, session) => {
        if (!session?.user) {
          navigate("/instructor/login");
        }
      }
    );

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (!currentUser?.id) return;

    async function loadSessions() {
      setIsLoadingSessions(true);

      try {
        const { data, error: sessionsError } = await getSessionsByOwner(
          currentUser.id
        );

        if (sessionsError) {
          console.warn("Failed to load instructor sessions:", sessionsError);
          setTeacherSessions([]);
          return;
        }

        setTeacherSessions(data ?? []);
      } catch (err) {
        console.error("Failed to load instructor sessions:", err);
        setTeacherSessions([]);
      } finally {
        setIsLoadingSessions(false);
      }
    }

    async function loadSavedQuestionBanks() {
      try {
        const { data, error } = await supabase
          .from("sessions")
          .select("*")
          .eq("owner_uid", currentUser.id)
          .not("questions_by_difficulty", "is", null)
          .order("created_at", { ascending: false })
          .limit(50);

        if (!error && data) {
          const validBanks = data.filter(
            (s) =>
              s.questions_by_difficulty &&
              Object.keys(s.questions_by_difficulty).length > 0
          );

          const uniqueBanksMap = new Map();

          for (const bank of validBanks) {
            const stableKey = bank.file_name
              ? `${bank.file_name}_${bank.question_count}`
              : JSON.stringify(bank.questions_by_difficulty).substring(0, 100);

            if (!uniqueBanksMap.has(stableKey)) {
              uniqueBanksMap.set(stableKey, bank);
            }
          }

          const uniqueBanks = Array.from(uniqueBanksMap.values()).slice(0, 10);
          setSavedQuestionBanks(uniqueBanks);
          console.log("Loaded unique saved question banks:", uniqueBanks);
        }
      } catch (err) {
        console.error("Failed to load saved question banks:", err);
      }
    }

    loadSessions();
    loadSavedQuestionBanks();
  }, [currentUser?.id]);

  function increaseQuestions() {
    setQuestionCount((prev) => Math.min(prev + 1, MAX_QUESTIONS));
  }

  function decreaseQuestions() {
    setQuestionCount((prev) => Math.max(prev - 1, MIN_QUESTIONS));
  }

  function increaseTime() {
    setTimePerQuestion((prev) => Math.min(prev + 5, MAX_TIME));
  }

  function decreaseTime() {
    setTimePerQuestion((prev) => Math.max(prev - 5, MIN_TIME));
  }

  function generateMockQuestions(n, fileName) {
    const easyBanks = [
      {
        q: "What is the main purpose of a software product?",
        opts: [
          "To solve a specific problem or provide a service",
          "To consume electricity",
          "To make hardware heavier",
          "To randomly crash computers",
        ],
        a: 0,
      },
      {
        q: "Why is usability important in software products?",
        opts: [
          "It makes the code run faster",
          "It ensures users can easily navigate and use the application",
          "It reduces the size of the database",
          "It eliminates all bugs automatically",
        ],
        a: 1,
      },
      {
        q: "What does software quality help improve?",
        opts: [
          "User satisfaction and system reliability",
          "Hardware manufacturing speed",
          "Internet bandwidth limits",
          "Keyboard typing speed",
        ],
        a: 0,
      },
    ];

    const mediumBanks = [
      {
        q: "Why should software products be tested before release?",
        opts: [
          "To identify and fix defects before users encounter them",
          "To increase the file size of the application",
          "To make developers work overtime",
          "To slow down the release process",
        ],
        a: 0,
      },
      {
        q: "What is the difference between functional and non-functional requirements?",
        opts: [
          "Functional defines what the system does, non-functional defines how well it does it",
          "Functional is for backend, non-functional is for frontend",
          "There is no difference",
          "Functional requirements are optional",
        ],
        a: 0,
      },
      {
        q: "Why is user feedback important during software development?",
        opts: [
          "It helps align the product with actual user needs and expectations",
          "It acts as a placeholder for real code",
          "It automatically generates documentation",
          "It writes the unit tests",
        ],
        a: 0,
      },
    ];

    const hardBanks = [
      {
        q: "How can maintainability affect the long-term success of a software product?",
        opts: [
          "It allows for easier updates, bug fixes, and feature additions over time",
          "It prevents users from uninstalling the app",
          "It forces the software to run strictly offline",
          "It eliminates the need for future developers",
        ],
        a: 0,
      },
      {
        q: "Why does scalability matter for software products?",
        opts: [
          "It ensures the system can handle increased load without performance degradation",
          "It makes the UI look bigger on large screens",
          "It reduces the electricity usage to zero",
          "It limits the number of users to a fixed amount",
        ],
        a: 0,
      },
      {
        q: "How can poor requirement analysis affect software product quality?",
        opts: [
          "It leads to building a product that does not meet user needs and requires expensive rework",
          "It makes the code compile faster",
          "It increases the application's graphical resolution",
          "It forces the application to be written in Assembly",
        ],
        a: 0,
      },
    ];

    const make = (difficultyLabel, bank) =>
      Array.from({ length: Math.max(n, bank.length) }, (_, i) => {
        const item = bank[i % bank.length];

        return {
          id: `${difficultyLabel.toLowerCase()}-${i + 1}`,
          question: item.q,
          options: item.opts,
          correctAnswer: item.a,
          difficulty: difficultyLabel.toLowerCase(),
        };
      }).slice(0, n);

    return {
      easy: make("Easy", easyBanks),
      medium: make("Medium", mediumBanks),
      hard: make("Hard", hardBanks),
    };
  }

  async function fetchAiQuestions({ sessionId, sessionGameCode }) {
    const url = "/api/generate-questions";

    const payload = {
      sessionId,
      gameCode: sessionGameCode,
      fileName: selectedFile.name,
      questionCount,
      timePerQuestion,
    };

    console.log("AI request URL:", url);
    console.log("AI request payload:", payload);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("AI response status:", response.status);
    console.log("AI response ok:", response.ok);

    if (!response.ok) {
      const errorText = await response.text();

      console.error("AI request failed");
      console.error("URL:", url);
      console.error("Status:", response.status);
      console.error("Response text:", errorText);

      throw new Error(
        errorText || `AI request failed with status ${response.status}`
      );
    }

    const json = await response.json();

    if (!json.questions || typeof json.questions !== "object") {
      throw new Error("AI returned invalid question data.");
    }

    return json.questions;
  }

  async function handleGoToSession() {
    if (useExistingBank) {
      if (!selectedQuestionBank) {
        setError("Please select an existing question bank to use.");
        return;
      }
    } else {
      if (!selectedFile) {
        setError("Please upload a file before creating a session.");
        return;
      }
    }

    if (!currentUser) {
      setError("User must be logged in to create a session.");
      navigate("/instructor/login");
      return;
    }

    try {
      setIsCreatingSession(true);
      setError("");
      setInfoMessage("");

      const isGuestUser =
        currentUser.is_anonymous || currentUser.user_metadata?.is_guest === true;

      const sessionFileName = useExistingBank
        ? selectedQuestionBank.file_name || "Existing Bank"
        : selectedFile.name;

      const sessionQuestionCount = useExistingBank
        ? selectedQuestionBank.question_count
        : questionCount;

      const sessionTimePerQuestion = useExistingBank
        ? selectedQuestionBank.time_per_question
        : timePerQuestion;

      let questionsByDifficulty;

      if (useExistingBank && selectedQuestionBank) {
        console.log("Selected existing question bank:", selectedQuestionBank);
        console.log("Using existing question bank, skipping AI generation.");

        questionsByDifficulty =
          selectedQuestionBank.questions_by_difficulty ||
          selectedQuestionBank.questionsByDifficulty;

        setInfoMessage("Using existing question bank.");
      } else {
        questionsByDifficulty = generateMockQuestions(
          questionCount,
          selectedFile.name
        );
      }

      if (!questionsByDifficulty || typeof questionsByDifficulty !== "object") {
        questionsByDifficulty = { easy: [], medium: [], hard: [] };
      }

      const sessionPayload = {
        game_code: gameCode,
        file_name: sessionFileName,
        question_count: sessionQuestionCount,
        time_per_question: sessionTimePerQuestion,
        status: "waiting",
        owner_uid: currentUser.id,
        owner_email: isGuestUser ? null : currentUser.email || null,
        owner_name: isGuestUser
          ? "Guest Instructor"
          : teacherName || "Instructor",
        is_guest: isGuestUser,
        questions_by_difficulty: questionsByDifficulty,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert(sessionPayload)
        .select()
        .single();

      if (sessionError) {
        console.error(
          "Create session Supabase error:",
          JSON.stringify(sessionError, null, 2)
        );

        throw sessionError;
      }

      if (!useExistingBank) {
        const useAi = import.meta.env.VITE_USE_AI_QUESTIONS === "true";

        if (useAi) {
          setInfoMessage("Generating questions using AI...");

          try {
            const aiQuestions = await fetchAiQuestions({
              sessionId: session.id,
              sessionGameCode: session.game_code,
            });

            if (aiQuestions && typeof aiQuestions === "object") {
              questionsByDifficulty = aiQuestions;
              setInfoMessage("AI-generated questions loaded successfully.");

              await supabase
                .from("sessions")
                .update({ questions_by_difficulty: questionsByDifficulty })
                .eq("id", session.id);
            } else {
              setInfoMessage("AI returned invalid data. Using fallback questions.");
            }
          } catch (aiError) {
            console.warn(
              "AI generation failed, falling back to local questions:",
              aiError
            );

            setInfoMessage("AI generation failed. Using fallback questions.");
          }
        } else {
          setInfoMessage("Session saved successfully.");
        }
      }

      localStorage.setItem(
        `quizplay_session_${session.game_code}`,
        JSON.stringify({
          ...session,
          gameCode: session.game_code,
          questionsByDifficulty,
          questions_by_difficulty: questionsByDifficulty,
        })
      );

      navigate("/instructor/session-official", {
        state: {
          sessionId: session.id,
          gameCode: session.game_code,
          fileName: sessionFileName,
          questionCount: sessionQuestionCount,
          timePerQuestion: sessionTimePerQuestion,
          studentsJoined: 0,
          questionsByDifficulty,
          isGuest: isGuestUser,
          localOnly: false,
        },
      });
    } catch (err) {
      console.error("Error creating session:", err);
      setError(`Failed to create session: ${err.message || "Unknown error"}`);
    } finally {
      setIsCreatingSession(false);
    }
  }

  async function handleLogout() {
    try {
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      setMenuOpen(false);
      navigate("/instructor/login");
    } catch (err) {
      console.error("Logout error:", err);
      setError("Failed to log out. Please try again.");
    }
  }

  const displayName = teacherName || "Instructor";
  const initials = displayName.trim().charAt(0).toUpperCase();

  const isGuestUser =
    currentUser?.is_anonymous || currentUser?.user_metadata?.is_guest === true;

  const displayEmail = isGuestUser ? "Guest Account" : teacherEmail || "";

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 flex items-center justify-center">
        <p className="text-slate-500 font-semibold">Checking login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            
            <h1 className="text-3xl md:text-4xl font-extrabold mt-1">
              Instructor Dashboard
            </h1>

            <p className="text-slate-500 mt-2">
              Upload your file, set the quiz options, then create a session for students.
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
                  {displayEmail}
                </p>
              </div>

              <span className="text-slate-400">▼</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-lg p-3 z-20">
                <div className="px-2 py-2 border-b border-slate-100">
                  <p className="font-semibold truncate">{displayName}</p>
                  <p className="text-sm text-slate-500 truncate">
                    {displayEmail}
                  </p>
                </div>

                {isGuestUser && (
                  <div className="mt-2 px-3 py-2 text-xs text-amber-700 bg-amber-50 rounded-xl">
                    Guest session - sessions are saved locally
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-2 w-full text-left px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-600 font-semibold transition"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {infoMessage && (
          <div className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4 text-cyan-900">
            {infoMessage}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Quiz Setup</h2>
              <p className="text-slate-500 text-sm mt-1">
                Choose how you want to create this quiz.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">
                    Use Existing Question Bank
                  </p>

                  <p className="text-sm text-slate-500 mt-1">
                    Reuse a previously generated set of questions.
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useExistingBank}
                    onChange={(e) => setUseExistingBank(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  Enable
                </label>
              </div>

              {useExistingBank && (
                <div className="mt-4 space-y-3">
                  {savedQuestionBanks.length === 0 ? (
                    <div className="rounded-2xl bg-white border border-slate-200 p-4 text-sm text-slate-500">
                      No existing question banks found. Please create one by
                      uploading a file first.
                    </div>
                  ) : (
                    savedQuestionBanks.map((bank) => (
                      <div
                        key={bank.id}
                        onClick={() => setSelectedQuestionBank(bank)}
                        className={[
                          "rounded-2xl border p-4 cursor-pointer transition",
                          selectedQuestionBank?.id === bank.id
                            ? "border-slate-900 bg-white shadow-sm"
                            : "border-slate-200 bg-white hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <div className="flex justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-bold truncate">
                              {bank.file_name || "Untitled"}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Created:{" "}
                              {new Date(bank.created_at).toLocaleDateString()} •
                              Code: {bank.game_code}
                            </p>
                          </div>

                          <p className="text-sm font-bold text-slate-600">
                            {bank.question_count} Qs
                          </p>
                        </div>

                        {selectedQuestionBank?.id === bank.id && (
                          <div className="mt-3 rounded-xl bg-slate-900 text-white text-center py-2 text-sm font-bold">
                            Selected
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {!useExistingBank && (
              <>
                <div className="mb-6">
                  <p className="text-sm font-bold mb-3 text-slate-700">
                    Upload File
                  </p>

                  <label className="block w-full rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 cursor-pointer hover:bg-slate-100 transition">
                    <input
                      type="file"
                      accept=".txt,.md,.doc,.docx,.pdf,.csv,.json,.html"
                      className="hidden"
                      onChange={(event) =>
                        setSelectedFile(event.target.files?.[0] ?? null)
                      }
                    />

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <p className="font-bold">Choose a file for the quiz</p>
                        <p className="text-sm text-slate-500 mt-1">
                          Upload a file to create quiz questions.
                        </p>
                      </div>

                      <div className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-bold shadow-sm">
                        Choose File
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl bg-white border border-slate-200 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                        Selected File
                      </p>
                      <p className="font-semibold truncate">
                        {selectedFile
                          ? selectedFile.name
                          : "No file uploaded yet"}
                      </p>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm font-bold text-slate-700 mb-3">
                      Number of Questions
                    </p>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={decreaseQuestions}
                        className="h-12 w-12 rounded-xl bg-white border border-slate-200 text-xl font-bold hover:bg-slate-100"
                      >
                        -
                      </button>

                      <div className="flex-1 rounded-xl bg-white border border-slate-200 text-center py-3">
                        <p className="text-xs text-slate-500">Selected</p>
                        <p className="text-2xl font-extrabold">
                          {questionCount}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={increaseQuestions}
                        className="h-12 w-12 rounded-xl bg-white border border-slate-200 text-xl font-bold hover:bg-slate-100"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm font-bold text-slate-700 mb-3">
                      Time per Question
                    </p>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={decreaseTime}
                        className="h-12 w-12 rounded-xl bg-white border border-slate-200 text-xl font-bold hover:bg-slate-100"
                      >
                        -
                      </button>

                      <div className="flex-1 rounded-xl bg-white border border-slate-200 text-center py-3">
                        <p className="text-xs text-slate-500">Selected</p>
                        <p className="text-2xl font-extrabold">
                          {timePerQuestion}s
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={increaseTime}
                        className="h-12 w-12 rounded-xl bg-white border border-slate-200 text-xl font-bold hover:bg-slate-100"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-7 shadow-sm h-fit">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Session Info
            </p>

            <div className="mt-6 rounded-3xl bg-slate-50 border border-slate-200 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Game Code
              </p>
              <p className="text-3xl md:text-4xl font-extrabold tracking-[0.18em] mt-3">
                {gameCode}
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoToSession}
              disabled={
                isCreatingSession ||
                (!useExistingBank && !selectedFile) ||
                (useExistingBank && !selectedQuestionBank)
              }
              className={[
                "mt-5 w-full px-5 py-3.5 rounded-2xl transition font-bold",
                !isCreatingSession &&
                ((useExistingBank && selectedQuestionBank) ||
                  (!useExistingBank && selectedFile))
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed",
              ].join(" ")}
            >
              {isCreatingSession ? "Creating session..." : "Create Session"}
            </button>

            <p className="text-xs text-slate-500 mt-4 leading-5">
              Share this code with students after creating the session.
            </p>
          </div>
        </div>

        <div className="mt-8 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                History
              </p>
              <h2 className="text-2xl font-bold mt-2">
                Your Recent Sessions
              </h2>
            </div>

            <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
              {teacherSessions.length} sessions
            </div>
          </div>

          <div className="space-y-4">
            {isLoadingSessions ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-500">
                Loading your sessions...
              </div>
            ) : teacherSessions.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-500">
                No saved sessions yet. Create one to start.
              </div>
            ) : (
              teacherSessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5 hover:bg-slate-100 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        {session.file_name || "Untitled file"}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        Code: {session.game_code}
                      </p>
                    </div>

                    <div className="flex gap-3 text-sm text-slate-500">
                      <span>Questions: {session.question_count}</span>
                      <span>Time: {session.time_per_question}s</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardOfficial;