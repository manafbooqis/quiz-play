import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  supabase,
  getProfile,
  upsertProfile,
  getSessionsByOwner,
} from "../../lib/supabase";

// Provides the instructor dashboard for creating and managing quiz sessions.
function DashboardOfficial() {
  const navigate = useNavigate();

  // Generates a readable one-time game code for the next session.
  const gameCode = useMemo(() => {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const nums = "23456789";
    // Picks one random character from the allowed code alphabet.
    const pick = (s) => s[Math.floor(Math.random() * s.length)];
    return `${pick(letters)}${pick(letters)}${pick(nums)}${pick(nums)}`;
  }, []);

  const [selectedFile, setSelectedFile] = useState(null);
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

  const [selectedQuestionBank, setSelectedQuestionBank] = useState(null);
  const [selectedSessions, setSelectedSessions] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null); // 'saved' | 'upload' | 'manual' | null
  const [useExistingBank, setUseExistingBank] = useState(false);

  // Delete selection mode for saved question banks
  const [isBankDeleteMode, setIsBankDeleteMode] = useState(false);
  const [selectedBanksForDeletion, setSelectedBanksForDeletion] = useState(new Set());
  const [showBankDeleteModal, setShowBankDeleteModal] = useState(false);

  // Manual questions state
  const [manualQuestions, setManualQuestions] = useState({ easy: [], medium: [], hard: [] });
  const [selectedDifficulty, setSelectedDifficulty] = useState('easy');
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);

  // File input ref for programmatic clicking
  const fileInputRef = useRef(null);

  // Initializes manual question slots when question count or source changes.
  useEffect(() => {
    if (selectedSource === 'manual') {
      setManualQuestions(prev => {
        const newQuestions = { easy: [], medium: [], hard: [] };
        
        ['easy', 'medium', 'hard'].forEach(difficulty => {
          const currentQuestions = prev[difficulty] || [];
          const targetLength = questionCount;
          
          // Add or trim questions to match target length
          if (currentQuestions.length < targetLength) {
            // Add new empty questions
            for (let i = currentQuestions.length; i < targetLength; i++) {
              newQuestions[difficulty].push({
                id: `${difficulty}-manual-${Date.now()}-${i}`,
                difficulty,
                question: "",
                options: ["", "", "", ""],
                correctAnswer: 0
              });
            }
          } else {
            // Keep existing questions up to target length
            newQuestions[difficulty] = currentQuestions.slice(0, targetLength);
          }
        });
        
        return newQuestions;
      });
    }
  }, [questionCount, selectedSource]);

  const [savedQuestionBanks, setSavedQuestionBanks] = useState([]);

  // Upload and quiz bounds kept together so validation, labels, and API payloads stay aligned.
  const MIN_QUESTIONS = 3;
  const MAX_QUESTIONS = 20;
  const MIN_TIME = 10;
  const MAX_TIME = 120;
  const TIME_STEP = 10;
  const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
  const SUPPORTED_UPLOAD_FORMATS_TEXT =
    "PDF, TXT, CSV, JSON, MD, HTML, DOCX, or PPTX";
  const UNSUPPORTED_UPLOAD_MESSAGE =
    `Unsupported file type. Please upload a ${SUPPORTED_UPLOAD_FORMATS_TEXT} file, or write questions manually.`;
  const READABLE_PDF_MESSAGE =
    "This PDF does not contain readable text. Please upload a text-based PDF, use a TXT file, or write questions manually.";
  // MIME allowlist accepted by the dashboard before sending uploads to the API extractor.
  const SUPPORTED_UPLOAD_TYPES = [
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/csv",
    "application/json",
    "text/markdown",
    "text/html",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];
  const isGuestUser =
    currentUser?.is_anonymous || currentUser?.user_metadata?.is_guest === true;

  // Verifies instructor authentication and loads profile details.
  useEffect(() => {
    let isMounted = true;

    // Loads the current auth session and ensures the profile exists.
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

  // Loads the instructor's prior sessions and saved question banks.
  useEffect(() => {
    if (!currentUser?.id) return;

    if (isGuestUser) {
      setTeacherSessions([]);
      setSavedQuestionBanks([]);
      setIsLoadingSessions(false);
      return;
    }

    // Fetches session history for the signed-in instructor.
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

    // Fetches reusable question banks from previous sessions.
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
        }
      } catch (err) {
        console.error("Failed to load saved question banks:", err);
      }
    }

    loadSessions();
    loadSavedQuestionBanks();
  }, [currentUser?.id, isGuestUser]);

  // Prevents guest instructors from using saved question banks.
  useEffect(() => {
    if (!isGuestUser || selectedSource !== "saved") return;

    setSelectedSource(null);
    setUseExistingBank(false);
    setSelectedQuestionBank(null);
  }, [isGuestUser, selectedSource]);

  // Increases the number of questions within the configured limit.
  function increaseQuestions() {
    setQuestionCount((prev) => Math.min(prev + 1, MAX_QUESTIONS));
  }

  // Decreases the number of questions within the configured limit.
  function decreaseQuestions() {
    setQuestionCount((prev) => Math.max(prev - 1, MIN_QUESTIONS));
  }

  // Increases per-question time within the configured limit.
  function increaseTime() {
    setTimePerQuestion((prev) => Math.min(prev + TIME_STEP, MAX_TIME));
  }

  // Decreases per-question time within the configured limit.
  function decreaseTime() {
    setTimePerQuestion((prev) => Math.max(prev - TIME_STEP, MIN_TIME));
  }

  // Toggles whether a saved question bank is selected for deletion.
  const toggleBankSelectionForDeletion = (bankId) => {
    setSelectedBanksForDeletion(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bankId)) {
        newSet.delete(bankId);
      } else {
        newSet.add(bankId);
      }
      return newSet;
    });
  };

  // Selects every saved question bank for deletion.
  const selectAllBanksForDeletion = () => {
    setSelectedBanksForDeletion(new Set(savedQuestionBanks.map(bank => bank.id)));
  };

  // Empty placeholder used while AI is generating — avoids hardcoded unrelated questions
  // Returns an empty question-bank structure when generation is unavailable.
  function emptyQuestionBanks() {
    return { easy: [], medium: [], hard: [] };
  }

  // Reads an uploaded file as base64 for the question-generation API.
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

  // Resolves browser MIME quirks by checking both MIME type and file extension.
  function getUploadFileType(file) {
    const fileName = file?.name?.toLowerCase() || "";
    const mimeType = (file?.type || "").trim().toLowerCase();

    if (fileName.endsWith(".doc") || fileName.endsWith(".ppt")) {
      return mimeType || "application/octet-stream";
    }

    if (fileName.endsWith(".pdf")) {
      return "application/pdf";
    }

    if (fileName.endsWith(".txt")) {
      return "text/plain";
    }

    if (fileName.endsWith(".csv")) {
      return "text/csv";
    }

    if (mimeType === "application/csv") {
      return "text/csv";
    }

    if (fileName.endsWith(".json")) {
      return "application/json";
    }

    if (fileName.endsWith(".md")) {
      return "text/markdown";
    }

    if (fileName.endsWith(".html") || fileName.endsWith(".htm")) {
      return "text/html";
    }

    if (fileName.endsWith(".docx")) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    if (fileName.endsWith(".pptx")) {
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    }

    if (SUPPORTED_UPLOAD_TYPES.includes(mimeType)) {
      return mimeType;
    }

    return mimeType || "application/octet-stream";
  }

  // Validates upload files before sending them to the question-generation API.
  function validateUploadFile(file) {
    if (!file) {
      return "Please upload a file before creating a session.";
    }

    const normalizedType = getUploadFileType(file);

    if (!SUPPORTED_UPLOAD_TYPES.includes(normalizedType)) {
      return UNSUPPORTED_UPLOAD_MESSAGE;
    }

    if (file.size <= 0) {
      return "This file appears to be empty. Please upload a file with readable content.";
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return `This file is too large. Please upload a supported file smaller than 10 MB. Supported formats: ${SUPPORTED_UPLOAD_FORMATS_TEXT}.`;
    }

    return "";
  }

  // Converts API and network failures into messages suitable for the dashboard.
  function getFriendlyAiErrorMessage(errorValue) {
    const rawMessage =
      typeof errorValue === "string"
        ? errorValue
        : errorValue?.message || "AI generation failed.";

    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed?.error) {
        return getFriendlyAiErrorMessage(parsed.error);
      }
    } catch {
      // The message was already plain text.
    }

    if (
      rawMessage.includes("does not contain readable text") ||
      rawMessage.includes("Failed to extract text from PDF") ||
      rawMessage.includes("valid text-based PDF") ||
      rawMessage.includes("Could not read text from this PDF")
    ) {
      return READABLE_PDF_MESSAGE;
    }

    if (rawMessage.includes("Unsupported file type")) {
      return UNSUPPORTED_UPLOAD_MESSAGE;
    }

    return rawMessage;
  }

  // Requests AI-generated questions for the uploaded session material.
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
      throw new Error(getFriendlyAiErrorMessage(errorText || `AI request failed with status ${response.status}`));
    }

    const json = await response.json();

    if (!json.questions || typeof json.questions !== "object") {
      throw new Error("AI returned invalid question data.");
    }

    return json.questions;
  }

  // Creates a quiz session from upload, saved bank, or manual questions.
  async function handleGoToSession() {
    const fromExistingBank = selectedSource === "bank" || useExistingBank;

    if (selectedSource === 'manual') {
      if (!isManualModeComplete()) {
        setError("Please complete all manual questions before creating a session.");
        return;
      }
    } else if (fromExistingBank) {
      if (!selectedQuestionBank) {
        setError("Please select an existing question bank to use.");
        return;
      }
    } else {
      if (!selectedFile) {
        setError("Please upload a file before creating a session.");
        return;
      }

      const fileValidationError = validateUploadFile(selectedFile);
      if (fileValidationError) {
        setError(fileValidationError);
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

      // Read the selected file inside this submit flow so AI generation uses current content.
      let freshBase64 = "";
      let freshMime = "";
      let freshFileName = "";

      if (!fromExistingBank && selectedFile) {
        setInfoMessage("Reading uploaded file...");
        try {
          freshBase64 = await readFileAsBase64(selectedFile);
          freshMime = getUploadFileType(selectedFile);
          freshFileName = selectedFile.name;
          console.log("[File] Read OK:", freshFileName, "|", freshMime, "| base64 length:", freshBase64.length);
        } catch (readErr) {
          console.warn("[File] Could not read file content:", readErr.message);
        }
      }

      // Resolve the question source before creating the session record.
      let questionsByDifficulty = null;
      const sessionFileName = fromExistingBank
        ? selectedQuestionBank.file_name || "Existing Bank"
        : selectedSource === 'manual' ? "Manual Questions" : selectedFile?.name || "Manual Questions";
      const sessionQuestionCount = fromExistingBank
        ? selectedQuestionBank.question_count || Number(questionCount)
        : Number(questionCount);
      const sessionTimePerQuestion = fromExistingBank
        ? selectedQuestionBank.time_per_question || timePerQuestion
        : timePerQuestion;

      if (selectedSource === 'manual') {
        console.log("[Manual] Using manual questions, skipping AI generation.");
        questionsByDifficulty = manualQuestions;
        setInfoMessage("Using manual questions.");
      } else if (fromExistingBank && selectedQuestionBank) {
        console.log("[Bank] Using existing question bank, skipping AI generation.");
        questionsByDifficulty =
          selectedQuestionBank.questions_by_difficulty ||
          selectedQuestionBank.questionsByDifficulty;
        setInfoMessage("Using existing question bank.");
      } else {
        // Generate AI questions first, then create session
        const useAi = import.meta.env.VITE_USE_AI_QUESTIONS === "true";

        if (useAi) {
          setInfoMessage("Generating questions using AI from your uploaded file...");

          try {
            const aiQuestions = await fetchAiQuestions({
              sessionId: null, // No session yet
              sessionGameCode: gameCode,
              freshBase64,
              freshMime,
              freshFileName,
            });

            if (aiQuestions && typeof aiQuestions === "object") {
              questionsByDifficulty = aiQuestions;
              setInfoMessage("AI-generated questions loaded successfully.");
            } else {
              setInfoMessage("AI returned invalid data. Please try again or use a saved question bank.");
              setIsCreatingSession(false);
              return; // Don't create session with invalid AI data
            }
          } catch (aiError) {
            console.warn("[AI] Generation failed:", aiError);
            
            // Check for specific OpenRouter errors
            if (aiError.message?.includes("Payment Required") || aiError.message?.includes("Insufficient credits")) {
              setInfoMessage("OpenRouter credits are required. Please add credits to your OpenRouter account or use a saved question bank.");
              setIsCreatingSession(false);
              return;
            }
            
            // Check if AI is rate limited
            const isRateLimit = 
              aiError.message?.includes("429") ||
              aiError.message?.includes("Too Many Requests") ||
              aiError.message?.includes("rate limit");
            
            // Check if AI is temporarily busy
            const isBusy = 
              aiError.message?.includes("Service Unavailable") ||
              aiError.message?.includes("high demand") ||
              aiError.message?.includes("UNAVAILABLE") ||
              aiError.message?.includes("503");
            
            if (isRateLimit) {
              setInfoMessage("AI free model rate limit reached. Please wait a few minutes, try another model, use a saved question bank, or add questions manually.");
            } else if (isBusy) {
              setInfoMessage("AI is temporarily busy. Please try again in a few minutes, use a saved question bank, or add questions manually.");
            } else {
              setInfoMessage(getFriendlyAiErrorMessage(aiError));
            }
            
            setIsCreatingSession(false);
            return; // Don't create session with failed AI
          }
        } else {
          setInfoMessage("AI is disabled — add questions manually.");
          questionsByDifficulty = emptyQuestionBanks();
        }
      }

      if (!questionsByDifficulty || typeof questionsByDifficulty !== "object") {
        questionsByDifficulty = { easy: [], medium: [], hard: [] };
      }

      // Only create session after we have valid questions
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

  // Signs out the instructor and returns to the login screen.
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

  const displayEmail = isGuestUser ? "Guest Account" : teacherEmail || "";

  // Updates a single field in the manual question editor.
  const updateManualQuestion = (difficulty, questionIndex, field, value) => {
    setManualQuestions(prev => {
      const newQuestions = { ...prev };
      const question = { ...newQuestions[difficulty][questionIndex] };
      
      if (field.startsWith('options.')) {
        const optionIndex = parseInt(field.split('.')[1]);
        const newOptions = [...question.options];
        newOptions[optionIndex] = value;
        question.options = newOptions;
      } else {
        question[field] = value;
      }
      
      newQuestions[difficulty][questionIndex] = question;
      return newQuestions;
    });
  };

  // Counts manual questions that have full text, options, and a correct answer.
  const getCompletedManualQuestionsCount = () => {
    let count = 0;
    Object.values(manualQuestions).forEach((questions) => {
      questions.forEach(question => {
        if (question.question.trim() && 
            question.options.every(opt => opt.trim()) && 
            typeof question.correctAnswer === 'number' && 
            question.correctAnswer >= 0 && 
            question.correctAnswer <= 3) {
          count++;
        }
      });
    });
    return count;
  };

  // Checks whether all required manual questions are complete.
  const isManualModeComplete = () => {
    const totalQuestions = questionCount * 3;
    return getCompletedManualQuestionsCount() === totalQuestions;
  };

  const selectedUploadFileError =
    selectedSource === "upload" && selectedFile ? validateUploadFile(selectedFile) : "";

  // Enables session creation only when the chosen question source is complete and valid.
  const canCreateSession =
    !isCreatingSession &&
    ((selectedSource === 'saved' && selectedQuestionBank) ||
     (selectedSource === 'upload' && selectedFile && !selectedUploadFileError) ||
     (selectedSource === 'manual' && isManualModeComplete()));

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 flex items-center justify-center">
        <p className="text-slate-500 font-semibold">Checking login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold mt-1">
                Instructor Dashboard
              </h1>
              <p className="text-slate-500 mt-2">
                Create a quiz session
              </p>
            </div>
            
            {/* Profile/Account Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-100 transition"
              >
                <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                  {initials}
                </div>

                <div className="text-left min-w-0 max-w-[180px]">
                  <p className="font-semibold text-slate-900 truncate">
                    {displayName}
                  </p>
                  <p className="text-sm text-slate-500 truncate">
                    {displayEmail}
                  </p>
                </div>

                <span className="text-slate-400">▼</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-50">
                  <div className="px-2 py-2 border-b border-slate-100">
                    <p className="font-semibold truncate">{displayName}</p>
                    <p className="text-sm text-slate-500 truncate">
                      {displayEmail}
                    </p>
                  </div>
                  {isGuestUser && (
                    <div className="mt-2 px-3 py-2 text-xs text-amber-700 bg-amber-50 rounded-lg">
                      Guest session - sessions are saved locally
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-2 w-full text-left px-3 py-2.5 rounded-lg hover:bg-red-50 text-red-600 font-semibold transition"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
          
                  </div>

        {/* Messages */}
        {infoMessage && (
          <div className="mb-6 rounded-xl border border-cyan-200 bg-cyan-50 px-6 py-4 text-cyan-900">
            {infoMessage}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-red-700">
            {error}
          </div>
        )}

        {/* Main Content - Create New Session */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Create New Session Card */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-2xl font-bold mb-6">Create New Session</h2>
              
              {/* 1. Choose Source */}
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-3">1. Choose Source</h3>
                <div className={`grid grid-cols-1 gap-3 ${isGuestUser ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                  {/* Saved Questions */}
                  {!isGuestUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSource('saved');
                        setUseExistingBank(true);
                        setSelectedQuestionBank(null);
                        setSelectedFile(null);
                      }}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        selectedSource === 'saved'
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-lg font-semibold mb-1">📚 Saved Questions</div>
                      <div className="text-sm text-slate-600">Use existing question bank</div>
                    </button>
                  )}

                  {/* Upload File */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSource('upload');
                      setUseExistingBank(false);
                      setSelectedQuestionBank(null);
                    }}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedSource === 'upload'
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-lg font-semibold mb-1">📁 Upload File</div>
                    <div className="text-sm text-slate-600">Import questions from file</div>
                  </button>

                  {/* Write Manually */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSource('manual');
                      setSelectedQuestionIndex(0);
                      setSelectedDifficulty('easy');
                    }}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedSource === 'manual'
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-lg font-semibold mb-1">✏️ Write Manually</div>
                    <div className="text-sm text-slate-600">Create questions directly in the dashboard.</div>
                    <div className="text-xs text-slate-500 mt-1">Write {questionCount * 3} questions manually.</div>
                  </button>
                </div>
                {isGuestUser && (
                  <p className="mt-3 text-sm text-slate-500">
                    Sign in to access saved question banks and recent sessions.
                  </p>
                )}
              </div>

              {/* 2. Settings */}
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-3">2. Settings</h3>
                
                {!selectedSource ? (
                  <div className="text-center py-8 text-slate-500">
                    <div className="text-sm">Choose a source to configure settings.</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Questions per difficulty - Only show for Upload File and Write Manually */}
                    {selectedSource !== 'saved' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Questions per difficulty</label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={decreaseQuestions}
                            disabled={questionCount <= MIN_QUESTIONS}
                            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            −
                          </button>
                          <span className="px-4 py-2 bg-slate-100 rounded-lg font-medium text-slate-900 min-w-[60px] text-center">
                            {questionCount}
                          </span>
                          <button
                            type="button"
                            onClick={increaseQuestions}
                            disabled={questionCount >= MAX_QUESTIONS}
                            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {questionCount * 3} total questions ({MIN_QUESTIONS}-{MAX_QUESTIONS})
                        </div>
                      </div>
                    )}

                    {/* Time per question - Always show when source is selected */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Time per question (seconds)</label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={decreaseTime}
                          disabled={timePerQuestion <= MIN_TIME}
                          className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          −
                        </button>
                        <span className="px-4 py-2 bg-slate-100 rounded-lg font-medium text-slate-900 min-w-[60px] text-center">
                          {timePerQuestion}
                        </span>
                        <button
                          type="button"
                          onClick={increaseTime}
                          disabled={timePerQuestion >= MAX_TIME}
                          className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {Math.floor(timePerQuestion / 60)}m {timePerQuestion % 60}s per question ({MIN_TIME}-{MAX_TIME})
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Source Details */}
              <div>
                <h3 className="text-xl font-bold mb-3">3. Source Details</h3>
                
                {selectedSource === 'saved' && (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-700">Saved Question Banks</h2>
                        <p className="text-sm text-slate-600">Select a question bank to use.</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        {savedQuestionBanks.length > 0 && (
                          <>
                            <span>{savedQuestionBanks.length} bank{savedQuestionBanks.length !== 1 ? 's' : ''}</span>
                            {!isBankDeleteMode ? (
                              <button
                                type="button"
                                onClick={() => setIsBankDeleteMode(true)}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
                              >
                                Select to Delete
                              </button>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={selectAllBanksForDeletion}
                                    className="text-cyan-600 hover:text-cyan-700 font-medium"
                                  >
                                    {selectedBanksForDeletion.size === savedQuestionBanks.length ? 'Deselect All' : 'Select All'}
                                  </button>
                                  <span className="text-slate-300">•</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsBankDeleteMode(false);
                                      setSelectedBanksForDeletion(new Set());
                                    }}
                                    className="text-slate-600 hover:text-slate-700 font-medium"
                                  >
                                    Cancel
                                  </button>
                                  <span className="text-slate-300">•</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (selectedBanksForDeletion.size > 0) {
                                        setShowBankDeleteModal(true);
                                      }
                                    }}
                                    disabled={selectedBanksForDeletion.size === 0}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
                                  >
                                    Delete Selected ({selectedBanksForDeletion.size})
                                  </button>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    {isBankDeleteMode && (
                      <div className="mb-3">
                        <p className="text-sm text-slate-600">Select question banks you want to delete.</p>
                      </div>
                    )}
                    
                    {selectedQuestionBank && !isBankDeleteMode ? (
                      <div className="border border-slate-300 rounded-lg p-4 bg-slate-50 mb-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-semibold text-slate-900">{selectedQuestionBank.file_name || "Untitled"}</h4>
                            <p className="text-xs text-slate-500">Code: {selectedQuestionBank.game_code}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedQuestionBank(null)}
                            className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                          >
                            Change
                          </button>
                        </div>
                        <div className="text-sm text-slate-600">
                          <p>Questions: {selectedQuestionBank.question_count || 0}</p>
                          <p>Time: {selectedQuestionBank.time_per_question || 30}s per question</p>
                          <p>Created: {new Date(selectedQuestionBank.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ) : null}
                    
                    {savedQuestionBanks.length === 0 ? (
                      <div className="text-center py-6 text-slate-500">
                        <div className="text-xl mb-2">📚</div>
                        <p className="text-sm">No saved question banks yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {savedQuestionBanks.map((bank) => (
                          <div
                            key={bank.id}
                            className={`border border-slate-200 rounded-lg p-4 transition ${
                              selectedQuestionBank?.id === bank.id && !isBankDeleteMode
                                ? 'border-cyan-500 bg-cyan-50'
                                : 'border-slate-200'
                            } ${isBankDeleteMode ? 'hover:bg-slate-50' : 'hover:bg-slate-50 cursor-pointer'}`}
                            onClick={() => {
                              if (!isBankDeleteMode) {
                                setSelectedQuestionBank(bank);
                              }
                            }}
                          >
                            <div className="flex items-center gap-4">
                              {isBankDeleteMode && (
                                <input
                                  type="checkbox"
                                  checked={selectedBanksForDeletion.has(bank.id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleBankSelectionForDeletion(bank.id);
                                  }}
                                  className="w-4 h-4 rounded cursor-pointer"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {bank.file_name || "Untitled bank"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  Code: {bank.game_code}
                                </p>
                                <p className="text-xs text-slate-500">
                                  Created: {new Date(bank.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-medium text-cyan-600">
                                  {bank.question_count || 0} questions
                                </p>
                                <p className="text-xs text-slate-500">
                                  {bank.time_per_question || 30}s each
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedSource === 'upload' && (
                  <div>
                    <label className="block w-full rounded-lg border-2 border-dashed border-cyan-300 bg-cyan-50 p-6 cursor-pointer hover:bg-cyan-100 transition">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.txt,.csv,.json,.md,.html,.htm,.docx,.pptx,application/pdf,text/plain,text/csv,application/json,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setInfoMessage("");
                          setError(file ? validateUploadFile(file) : "");
                          setSelectedFile(file);

                          // Disable "Use Existing Bank" when a new file is chosen
                          setUseExistingBank(false);
                          setSelectedQuestionBank(null);

                          // Clear any previously cached quizplay sessions from localStorage
                          Object.keys(localStorage)
                            .filter((key) => key.startsWith("quizplay_session_"))
                            .forEach((key) => localStorage.removeItem(key));
                        }}
                      />
                      {selectedFile ? (
                        <div className="text-center py-4">
                          <div className="text-cyan-600 mb-2">📁</div>
                          <p className="font-medium text-slate-900">{selectedFile.name}</p>
                          <p className="text-sm text-slate-500">
                            Size: {(selectedFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <div className="text-2xl mb-2 text-cyan-600">📁</div>
                          <p className="font-semibold text-slate-900 mb-2">Choose File</p>
                          <p className="text-sm text-slate-600 mb-4">
                            Supported formats: PDF, DOCX ,and PPTX
                          </p>
                          <button
                            type="button"
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                          >
                            Browse File
                          </button>
                        </div>
                      )}
                    </label>
                    {selectedFile && (
                      <div className="mt-3 border border-slate-300 rounded-lg p-4 bg-slate-50">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-semibold text-slate-900">{selectedFile.name}</h4>
                            <p className="text-xs text-slate-500">Size: {(selectedFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedFile(null)}
                            className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                          >
                            Change
                          </button>
                        </div>
                        <div className="text-sm text-slate-600">
                          <p>Questions: {questionCount}</p>
                          <p>Time: {timePerQuestion}s per question</p>
                          <p>Type: {getUploadFileType(selectedFile)}</p>
                          {selectedUploadFileError && (
                            <p className="mt-2 text-red-600">{selectedUploadFileError}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedSource === 'manual' && (
                  <div className="border border-slate-300 rounded-lg p-4 bg-slate-50">
                    {/* Question Set Selector - Horizontal Scroll */}
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Question Set</label>
                      <div className="overflow-x-auto pb-2">
                        <div className="flex gap-1 min-w-max">
                          {Array.from({ length: questionCount }, (_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setSelectedQuestionIndex(i)}
                              className={`px-2 py-1 rounded text-xs font-medium transition whitespace-nowrap ${
                                selectedQuestionIndex === i
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              Set {i + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Difficulty Tabs */}
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Difficulty</label>
                      <div className="flex gap-2">
                        {['easy', 'medium', 'hard'].map(difficulty => (
                          <button
                            key={difficulty}
                            type="button"
                            onClick={() => setSelectedDifficulty(difficulty)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium capitalize transition ${
                              selectedDifficulty === difficulty
                                ? 'bg-cyan-600 text-white'
                                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {difficulty}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="mb-4 text-sm text-slate-600">
                      Manual Progress: {getCompletedManualQuestionsCount()} / {questionCount * 3} complete
                    </div>

                    {/* Question Form */}
                    {(() => {
                      const currentQuestion = manualQuestions[selectedDifficulty]?.[selectedQuestionIndex];
                      if (!currentQuestion) return null;

                      return (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Question Text</label>
                            <textarea
                              value={currentQuestion.question}
                              onChange={(e) => updateManualQuestion(selectedDifficulty, selectedQuestionIndex, 'question', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                              rows={2}
                              placeholder="Enter your question here..."
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Options</label>
                            <div className="space-y-2">
                              {['A', 'B', 'C', 'D'].map((label, index) => (
                                <div key={label} className="flex items-center gap-2">
                                  <span className="w-6 text-sm font-medium text-slate-600">{label}.</span>
                                  <input
                                    type="text"
                                    value={currentQuestion.options[index]}
                                    onChange={(e) => updateManualQuestion(selectedDifficulty, selectedQuestionIndex, `options.${index}`, e.target.value)}
                                    className="flex-1 px-2 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm"
                                    placeholder={`Option ${label}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateManualQuestion(selectedDifficulty, selectedQuestionIndex, 'correctAnswer', index)}
                                    className={`px-2 py-1 rounded text-xs font-medium transition ${
                                      currentQuestion.correctAnswer === index
                                        ? 'bg-green-600 text-white'
                                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    {currentQuestion.correctAnswer === index ? '✓' : ''}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {!selectedSource && (
                  <div className="text-center py-8 text-slate-500">
                    <div className="text-2xl mb-2">📝</div>
                    <p className="font-medium">Choose a source above to continue</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Session Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm sticky top-8">
              <h2 className="text-2xl font-bold mb-4">Session Summary</h2>
              
              <div className="space-y-4">
                {!selectedSource ? (
                  <div className="text-center py-8 text-slate-500">
                    <div className="text-sm">Choose a source above to continue</div>
                  </div>
                ) : (
                  <>
                    {/* Source */}
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Source</div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2 text-slate-900">
                        {selectedSource === 'saved' && selectedQuestionBank && (
                          <span>📚 {selectedQuestionBank.file_name || "Existing Bank"}</span>
                        )}
                        {selectedSource === 'upload' && selectedFile && (
                          <span>📁 {selectedFile.name}</span>
                        )}
                        {selectedSource === 'upload' && !selectedFile && (
                          <span>📁 Upload File</span>
                        )}
                        {selectedSource === 'manual' && (
                          <span>✏️ Manual Questions</span>
                        )}
                      </div>
                    </div>

                    {/* Questions */}
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Total Questions</div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2 text-slate-900">
                        {selectedSource === 'saved' && selectedQuestionBank
                          ? selectedQuestionBank.question_count || 0
                          : questionCount * 3}
                      </div>
                    </div>

                    {/* Time */}
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Time per Question</div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2 text-slate-900">
                        {selectedSource === 'saved' && selectedQuestionBank
                          ? selectedQuestionBank.time_per_question || 30
                          : timePerQuestion}s
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Status</div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2 text-slate-900">
                        {canCreateSession ? (
                          <span className="text-green-700">✓ Ready to create</span>
                        ) : (
                          selectedSource === 'saved' && !selectedQuestionBank ? (
                            <span className="text-slate-500">Select a saved question bank</span>
                          ) : selectedSource === 'upload' && !selectedFile ? (
                            <span className="text-slate-500">Choose a file</span>
                          ) : selectedSource === 'manual' && !isManualModeComplete() ? (
                            <span className="text-slate-500">Complete all manual questions</span>
                          ) : (
                            <span className="text-slate-500">⚠ Complete setup to continue</span>
                          )
                        )}
                      </div>
                    </div>

                    {/* Game Code - Only show prominently when ready */}
                    {canCreateSession && gameCode && (
                      <div>
                        <div className="text-sm font-medium text-slate-700 mb-1">Game Code</div>
                        <div className="bg-slate-50 rounded-lg px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-lg font-bold text-cyan-600">{gameCode}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(gameCode);
                              }}
                              className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Create Session Button */}
                <button
                  type="button"
                  onClick={handleGoToSession}
                  disabled={!canCreateSession || isCreatingSession}
                  className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  {isCreatingSession ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white/30 animate-spin rounded-full"></div>
                      Creating Session...
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      Create Session
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Sessions */}
        {!isGuestUser && (
          <div className="mt-12">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Recent Sessions</h2>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                {teacherSessions.length > 0 && (
                  <>
                    {!isSelectionMode ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsSelectionMode(true);
                          setSelectedSessions(new Set());
                        }}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
                      >
                        Select to Delete
                      </button>
                    ) : (
                      <>
                        <div className="mb-3">
                          <p className="text-sm text-slate-600">Select sessions you want to delete.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedSessions.size === teacherSessions.length) {
                                setSelectedSessions(new Set());
                              } else {
                                setSelectedSessions(new Set(teacherSessions.map(s => s.id)));
                              }
                            }}
                            className="text-cyan-600 hover:text-cyan-700 font-medium"
                          >
                            {selectedSessions.size === teacherSessions.length ? 'Deselect All' : 'Select All'}
                          </button>
                          <span className="text-slate-300">•</span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsSelectionMode(false);
                              setSelectedSessions(new Set());
                            }}
                            className="text-slate-600 hover:text-slate-700 font-medium"
                          >
                            Cancel
                          </button>
                          <span className="text-slate-300">•</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedSessions.size > 0) {
                                setShowDeleteModal(true);
                              }
                            }}
                            disabled={selectedSessions.size === 0}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
                          >
                            Delete Selected ({selectedSessions.size})
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            
            {isLoadingSessions ? (
              <div className="text-center py-6 text-slate-500">
                Loading your sessions...
              </div>
            ) : teacherSessions.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <div className="text-xl mb-2">📋</div>
                <p className="text-sm">No saved sessions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {teacherSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`border border-slate-200 rounded-lg p-4 transition ${
                      isSelectionMode ? 'hover:bg-slate-50' : 'hover:bg-slate-50 cursor-pointer'
                    }`}
                    onClick={() => {
                      if (!isSelectionMode) {
                        navigate("/instructor/final-results", {
                          state: {
                            sessionId: session.id,
                            gameCode: session.game_code
                          }
                        });
                      }
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {isSelectionMode && (
                        <input
                          type="checkbox"
                          checked={selectedSessions.has(session.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newSelected = new Set(selectedSessions);
                            if (e.target.checked) {
                              newSelected.add(session.id);
                            } else {
                              newSelected.delete(session.id);
                            }
                            setSelectedSessions(newSelected);
                          }}
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {session.file_name || "Untitled file"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Code: {session.game_code}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/instructor/final-results", {
                            state: {
                              sessionId: session.id,
                              gameCode: session.game_code
                            }
                          });
                        }}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-100 text-cyan-700 hover:bg-cyan-200 transition flex-shrink-0"
                      >
                        View Analysis
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete selected sessions?</h3>
            <p className="text-sm text-slate-600 mb-6">
              This will move selected sessions out of your dashboard. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-700 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    // Convert Set to array and filter valid IDs
                    const sessionIds = Array.from(selectedSessions).filter(id => 
                      id && typeof id === 'string' && id.trim() !== ''
                    );

                    if (sessionIds.length === 0) {
                      setError("No valid session IDs found for deletion.");
                      return;
                    }

                    // Delete all selected sessions at once
                    const { error: delErr } = await supabase
                      .from("sessions")
                      .delete()
                      .in("id", sessionIds);

                    if (delErr) {
                      setError(`Failed to delete sessions: ${delErr.message}`);
                      return;
                    }

                    // Update local state
                    setTeacherSessions((prev) => prev.filter((s) => !selectedSessions.has(s.id)));
                    setSavedQuestionBanks((prev) => prev.filter((s) => !selectedSessions.has(s.id)));
                    
                    // Clear selected bank if it was deleted
                    if (selectedQuestionBank && selectedSessions.has(selectedQuestionBank.id)) {
                      setSelectedQuestionBank(null);
                    }
                    
                    setError("");
                    setShowDeleteModal(false);
                    setIsSelectionMode(false);
                    setSelectedSessions(new Set());
                  } catch (err) {
                    setError(`Failed to delete sessions: ${err.message || "Unknown error"}`);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg"
              >
                Delete Sessions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Bank Delete Confirmation Modal */}
      {showBankDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete selected question banks?</h3>
            <p className="text-sm text-slate-600 mb-6">
              This will remove the selected saved question banks. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowBankDeleteModal(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-700 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    // Convert Set to array and filter valid IDs
                    const bankIds = Array.from(selectedBanksForDeletion).filter(id => 
                      id && typeof id === 'string' && id.trim() !== ''
                    );

                    if (bankIds.length === 0) {
                      setError("No valid question bank IDs found for deletion.");
                      return;
                    }

                    // Delete all selected banks at once
                    const { error: delErr } = await supabase
                      .from("sessions")
                      .delete()
                      .in("id", bankIds);

                    if (delErr) {
                      setError(`Failed to delete question banks: ${delErr.message}`);
                      return;
                    }

                    // Update local state
                    setSavedQuestionBanks((prev) => prev.filter((bank) => !selectedBanksForDeletion.has(bank.id)));
                    
                    // Clear selected bank if it was deleted
                    if (selectedQuestionBank && selectedBanksForDeletion.has(selectedQuestionBank.id)) {
                      setSelectedQuestionBank(null);
                      setUseExistingBank(false);
                    }
                    
                    setError("");
                    setShowBankDeleteModal(false);
                    setIsBankDeleteMode(false);
                    setSelectedBanksForDeletion(new Set());
                  } catch (err) {
                    setError(`Failed to delete question banks: ${err.message || "Unknown error"}`);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg"
              >
                Delete Question Banks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardOfficial;
