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
  const [fileContent, setFileContent] = useState("");        // base64-encoded file content
  const [fileMimeType, setFileMimeType] = useState("");       // MIME type of the uploaded file
  const [uploadedFileId, setUploadedFileId] = useState("");  // unique ID per upload to prevent stale data
  const [isReadingFile, setIsReadingFile] = useState(false); // true while FileReader is running
  const [questionCount, setQuestionCount] = useState(5);
  const [timePerQuestion, setTimePerQuestion] = useState(30);
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
  const MIN_TIME = 10;
  const MAX_TIME = 120;
  const TIME_STEP = 10;

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

  async function deleteSessionRecord(target, { listLabel }) {
    if (!target?.id) return;
    const title =
      target.file_name || target.game_code || listLabel || "this session";
    if (
      !window.confirm(
        `Delete "${title}"? This removes only this session row (code ${target.game_code}). This cannot be undone.`
      )
    ) {
      return;
    }

    const { error: delErr } = await supabase
      .from("sessions")
      .delete()
      .eq("id", target.id);

    if (delErr) {
      setError(delErr.message || "Could not delete session.");
      return;
    }

    setTeacherSessions((prev) => prev.filter((s) => s.id !== target.id));
    setSavedQuestionBanks((prev) => prev.filter((s) => s.id !== target.id));
    if (selectedQuestionBank?.id === target.id) {
      setSelectedQuestionBank(null);
    }
    setError("");
  }

  function increaseQuestions() {
    setQuestionCount((prev) => Math.min(prev + 1, MAX_QUESTIONS));
  }

  function decreaseQuestions() {
    setQuestionCount((prev) => Math.max(prev - 1, MIN_QUESTIONS));
  }

  function increaseTime() {
    setTimePerQuestion((prev) => Math.min(prev + TIME_STEP, MAX_TIME));
  }

  function decreaseTime() {
    setTimePerQuestion((prev) => Math.max(prev - TIME_STEP, MIN_TIME));
  }

  // Empty placeholder used while AI is generating — avoids hardcoded unrelated questions
  function emptyQuestionBanks() {
    return { easy: [], medium: [], hard: [] };
  }

  // Read a file as base64 (works for PDFs, images, and text files)
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        // result is a data URL: "data:<mime>;base64,<data>"
        const dataUrl = e.target.result;
        const base64 = dataUrl.split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  async function fetchAiQuestions({ sessionId, sessionGameCode, freshBase64, freshMime, freshFileName }) {
    const url = "/api/generate-questions";

    // freshBase64/freshMime are passed directly from the handleGoToSession caller
    // so we never rely on stale React state
    const base64 = freshBase64 || "";
    const mimeType = freshMime || "application/octet-stream";
    const fileName = freshFileName || selectedFile?.name || "uploaded-file";

    const payload = {
      sessionId,
      gameCode: sessionGameCode,
      fileName,
      fileBase64: base64,
      fileMimeType: mimeType,
      questionCount,
      timePerQuestion,
    };

    console.log("[AI] Sending request to", url);
    console.log("[AI] fileName:", fileName, "| mimeType:", mimeType, "| base64 length:", base64.length);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("[AI] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI] Request failed:", response.status, errorText);
      throw new Error(errorText || `AI request failed with status ${response.status}`);
    }

    const json = await response.json();

    if (!json.questions || typeof json.questions !== "object") {
      throw new Error("AI returned invalid question data.");
    }

    return json.questions;
  }

  async function handleGoToSession() {
    // A newly selected file always wins over "existing bank" mode (checkbox can still be on by mistake).
    const fromExistingBank = useExistingBank && !selectedFile;

    if (fromExistingBank) {
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

      // ── Step 0: Read the file NOW, before any async Supabase calls ──
      // This guarantees we always send the FRESHEST file content to the API,
      // not stale React state from a previous render cycle.
      let freshBase64 = "";
      let freshMime = "";
      let freshFileName = "";

      if (!fromExistingBank && selectedFile) {
        setIsReadingFile(true);
        setInfoMessage("Reading uploaded file...");
        try {
          freshBase64 = await readFileAsBase64(selectedFile);
          freshMime = selectedFile.type || "application/octet-stream";
          freshFileName = selectedFile.name;
          // Update state for reference (not used for the current call)
          setFileContent(freshBase64);
          setFileMimeType(freshMime);
          console.log("[File] Read OK:", freshFileName, "|", freshMime, "| base64 length:", freshBase64.length);
        } catch (readErr) {
          console.warn("[File] Could not read file content:", readErr.message);
        } finally {
          setIsReadingFile(false);
        }
      }

      const isGuestUser =
        currentUser.is_anonymous || currentUser.user_metadata?.is_guest === true;

      const sessionFileName = fromExistingBank
        ? selectedQuestionBank.file_name || "Existing Bank"
        : selectedFile.name;

      const sessionQuestionCount = fromExistingBank
        ? selectedQuestionBank.question_count
        : questionCount;

      const sessionTimePerQuestion = fromExistingBank
        ? selectedQuestionBank.time_per_question
        : timePerQuestion;

      let questionsByDifficulty;

      if (fromExistingBank && selectedQuestionBank) {
        console.log("[Bank] Using existing question bank, skipping AI generation.");
        questionsByDifficulty =
          selectedQuestionBank.questions_by_difficulty ||
          selectedQuestionBank.questionsByDifficulty;
        setInfoMessage("Using existing question bank.");
      } else {
        // Use empty banks as placeholder — AI will replace them.
        // NEVER use hardcoded mock questions that are unrelated to the uploaded file.
        questionsByDifficulty = emptyQuestionBanks();
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

      if (!fromExistingBank) {
        const useAi = import.meta.env.VITE_USE_AI_QUESTIONS === "true";

        if (useAi) {
          setInfoMessage("Generating questions using AI from your uploaded file...");

          try {
            const aiQuestions = await fetchAiQuestions({
              sessionId: session.id,
              sessionGameCode: session.game_code,
              freshBase64,
              freshMime,
              freshFileName,
            });

            if (aiQuestions && typeof aiQuestions === "object") {
              questionsByDifficulty = aiQuestions;
              setInfoMessage("AI-generated questions loaded successfully.");

              await supabase
                .from("sessions")
                .update({ questions_by_difficulty: questionsByDifficulty })
                .eq("id", session.id);
            } else {
              setInfoMessage("AI returned invalid data. Questions are empty — please edit manually.");
            }
          } catch (aiError) {
            console.warn("[AI] Generation failed:", aiError);
            setInfoMessage(`AI generation failed: ${aiError.message}. Questions are empty — please edit manually.`);
          }
        } else {
          setInfoMessage("Session saved. AI is disabled — add questions manually.");
        }
      }

      // Only persist locally after generation (or existing bank path) so we never cache empty/mock banks ahead of AI.
      const persistKey = `quizplay_session_${session.game_code}`;
      try {
        localStorage.setItem(
          persistKey,
          JSON.stringify({
            ...session,
            id: session.id,
            gameCode: session.game_code,
            questionsByDifficulty,
            questions_by_difficulty: questionsByDifficulty,
          })
        );
      } catch (e) {
        console.warn("Failed to write session to localStorage:", e);
      }

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

  // Upload wins over the "existing bank" checkbox when both are present.
  const fromBankOnly = useExistingBank && !selectedFile;
  const canCreateSession =
    !isCreatingSession &&
    (selectedFile || (fromBankOnly && selectedQuestionBank));

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
                        className={[
                          "rounded-2xl border p-4 transition flex gap-3 items-stretch",
                          selectedQuestionBank?.id === bank.id
                            ? "border-slate-900 bg-white shadow-sm"
                            : "border-slate-200 bg-white hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedQuestionBank(bank)}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <div className="flex justify-between gap-4">
                            <div className="min-w-0">
                              <p className="font-bold truncate">
                                {bank.file_name || "Untitled"}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                Created:{" "}
                                {new Date(bank.created_at).toLocaleDateString()}{" "}
                                • Code: {bank.game_code}
                              </p>
                            </div>

                            <p className="text-sm font-bold text-slate-600 shrink-0">
                              {bank.question_count} / tier
                              <span className="block text-xs font-normal text-slate-500">
                                Bank {Number(bank.question_count || 0) * 3}
                              </span>
                            </p>
                          </div>

                          {selectedQuestionBank?.id === bank.id && (
                            <div className="mt-3 rounded-xl bg-slate-900 text-white text-center py-2 text-sm font-bold">
                              Selected
                            </div>
                          )}
                        </button>
                        <button
                          type="button"
                          title="Delete this question bank"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSessionRecord(bank, {
                              listLabel: "question bank",
                            });
                          }}
                          className="shrink-0 self-start p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
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
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setSelectedFile(file);

                        // ── Clear ALL stale question/file state ──
                        // This ensures old questions from a previous file never bleed into the new session.
                        setFileContent("");
                        setFileMimeType("");
                        setUploadedFileId(Date.now().toString());
                        setInfoMessage("");
                        setError("");

                        // Disable "Use Existing Bank" when a new file is chosen
                        setUseExistingBank(false);
                        setSelectedQuestionBank(null);

                        // Clear any previously cached quizplay sessions from localStorage
                        // so old question banks are never shown for the new file
                        Object.keys(localStorage)
                          .filter((k) => k.startsWith("quizplay_session_"))
                          .forEach((k) => localStorage.removeItem(k));
                        Object.keys(sessionStorage)
                          .filter((k) => k.startsWith("quizplay_"))
                          .forEach((k) => sessionStorage.removeItem(k));
                      }}
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
                    <p className="text-sm font-bold text-slate-700 mb-1">
                      Questions per difficulty
                    </p>
                    <p className="text-xs text-slate-500 mb-3">
                      Bank size: {questionCount} easy + {questionCount} medium +{" "}
                      {questionCount} hard ({questionCount * 3} total). Quiz uses{" "}
                      {questionCount} rounds (same number).
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
                      Time per question (each question)
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
              disabled={!canCreateSession}
              className={[
                "mt-5 w-full px-5 py-3.5 rounded-2xl transition font-bold",
                canCreateSession
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
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5 hover:bg-slate-100 transition flex gap-3 items-start"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">
                          {session.file_name || "Untitled file"}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          Code: {session.game_code}
                        </p>
                      </div>

                      <div className="flex flex-col sm:items-end gap-1 text-sm text-slate-500">
                        <span>
                          Quiz rounds: {session.question_count} · Bank:{" "}
                          {Number(session.question_count || 0) * 3}
                        </span>
                        <span>
                          Time/question: {session.time_per_question}s
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    title="Delete this session"
                    onClick={() =>
                      deleteSessionRecord(session, { listLabel: "history" })
                    }
                    className="shrink-0 p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
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