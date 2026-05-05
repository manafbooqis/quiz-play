import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

console.log("=== API Route: generate-questions ===");
console.log("SUPABASE_URL:", SUPABASE_URL ? "set" : "MISSING");
console.log("SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING");
console.log("OPENROUTER_API_KEY:", OPENROUTER_API_KEY ? "set" : "MISSING");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase server-side env variables.");
}

const supabaseAdmin = SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

function safeParseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    const match = value.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (innerError) {
        return null;
      }
    }
    return null;
  }
}

function buildQuestionPrompt(fileName, perDifficultyCount, hasDocumentInRequest) {
  const n = Math.max(1, Math.floor(Number(perDifficultyCount) || 1));
  const total = n * 3;

  const contentSection = hasDocumentInRequest
    ? `\n\nThe uploaded file is attached in this request. Generate ALL questions strictly from that file only. Do not use outside knowledge that contradicts the file. If the file is a table or worksheet (e.g. multiplication tables), every question must reflect that topic.`
    : `\nGenerate questions related to the material suggested by the file name: ${fileName}.`;

  return `Create multiple-choice quiz questions in JSON format for a classroom activity.
The output must be valid JSON with three top-level arrays: easy, medium, and hard.

IMPORTANT: The instructor chose ${n} as the count PER difficulty (not the total bank size).
- The "easy" array must contain EXACTLY ${n} questions.
- The "medium" array must contain EXACTLY ${n} questions.
- The "hard" array must contain EXACTLY ${n} questions.
- Total questions in the file: ${total} (${n} + ${n} + ${n}).

CRITICAL: Every single question must test a completely different concept, fact, or scenario. Do NOT repeat the same concepts. Questions within the same difficulty must be distinctly different from each other.

Each question object must include exactly these 5 properties:
- "id": a unique string identifier (e.g., "easy-1", "medium-1")
- "question": the question text
- "options": an array of 4 answer strings
- "correctAnswer": the index (0-3) of the correct answer
- "difficulty": the difficulty level ("easy", "medium", or "hard")
${contentSection}
Output ONLY the JSON object. Do not include markdown formatting or explanations.`;
}

function normalizeBankToPerDifficulty(questions, perDifficultyCount) {
  const n = Math.max(1, Math.floor(Number(perDifficultyCount) || 1));
  const keys = ["easy", "medium", "hard"];
  const out = { easy: [], medium: [], hard: [] };
  for (const k of keys) {
    const arr = Array.isArray(questions[k]) ? questions[k] : [];
    out[k] = arr.slice(0, n);
  }
  return out;
}

function normalizeMimeType(fileName, mimeType) {
  const raw = (mimeType || "").trim().toLowerCase();
  if (raw && raw !== "application/octet-stream") {
    return mimeType;
  }
  const lower = (fileName || "").toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  return mimeType || "application/octet-stream";
}

function isTextBasedMime(mimeType) {
  const m = (mimeType || "").toLowerCase();
  return (
    m.startsWith("text/") ||
    m === "application/json" ||
    m === "application/javascript"
  );
}

function decodeBase64ToUtf8(base64) {
  if (!base64) return "";
  try {
    return Buffer.from(base64, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function buildGeminiParts({ prompt, fileBase64, fileMimeType, fileName, legacyFileContent }) {
  const mime = normalizeMimeType(fileName, fileMimeType);
  const parts = [];

  if (fileBase64 && fileBase64.length > 0) {
    if (isTextBasedMime(mime)) {
      const text = decodeBase64ToUtf8(fileBase64);
      const slice = text.substring(0, 12000);
      parts.push({
        text: `${prompt}\n\nHere is the file content to use (UTF-8 text):\n---\n${slice}\n---`,
      });
      return parts;
    }

    parts.push({
      inline_data: {
        mime_type: mime,
        data: fileBase64,
      },
    });
    parts.push({ text: prompt });
    return parts;
  }

  if (legacyFileContent && String(legacyFileContent).trim()) {
    const slice = String(legacyFileContent).substring(0, 12000);
    parts.push({
      text: `${prompt}\n\nHere is the file content:\n---\n${slice}\n---`,
    });
    return parts;
  }

  parts.push({ text: prompt });
  return parts;
}

export default async function handler(req, res) {
  console.log("=== Handler called ===");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Supabase service client is not configured." });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "Missing OpenRouter API key." });
  }

  const {
    gameCode,
    fileName,
    questionCount,
    fileContent,
    fileBase64,
    fileMimeType,
    sessionId: bodySessionId,
  } = req.body || {};

  if (!gameCode || !fileName || !questionCount) {
    return res.status(400).json({ error: "gameCode, fileName, and questionCount are required." });
  }

  const count = Number(questionCount);
  if (Number.isNaN(count) || count <= 0) {
    return res.status(400).json({ error: "questionCount must be a positive number." });
  }

  const hasInlineOrTextFile = Boolean(
    (fileBase64 && String(fileBase64).length > 0) || (fileContent && String(fileContent).trim())
  );
  const prompt = buildQuestionPrompt(fileName, count, hasInlineOrTextFile);
  const parts = buildGeminiParts({
    prompt,
    fileBase64: fileBase64 ? String(fileBase64) : "",
    fileMimeType: fileMimeType || "",
    fileName: fileName || "",
    legacyFileContent: fileContent || "",
  });

  console.log("Calling OpenRouter API...");

  const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

  let openrouterResponse;
  try {
    openrouterResponse = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.APP_URL || "http://localhost:5173",
        "X-Title": "Quiz Play AI Question Generator"
      },
      body: JSON.stringify({
        model: "google/gemma-4-31b-it:free",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that only outputs valid JSON for a quiz question bank."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      }),
    });
  } catch (fetchError) {
    console.error("OpenRouter fetch error:", fetchError);
    return res.status(500).json({ error: "Failed to call OpenRouter API", details: fetchError.message });
  }

  if (!openrouterResponse.ok) {
    const body = await openrouterResponse.text();
    console.error("OpenRouter error status:", openrouterResponse.status);
    console.error("OpenRouter error body:", body);
    
    // Provider-specific error handling
    if (openrouterResponse.status === 429) {
      return res.status(429).json({ error: "OpenRouter rate limit exceeded. Please try again later." });
    }
    if (openrouterResponse.status === 503) {
      return res.status(503).json({ error: "OpenRouter is temporarily busy. Please try again later." });
    }
    
    return res.status(500).json({ 
      error: `OpenRouter request failed: ${openrouterResponse.statusText}`, 
      details: body 
    });
  }

  const openrouterData = await openrouterResponse.json();
  const rawContent = openrouterData?.choices?.[0]?.message?.content || "";
  
  // Robust JSON parsing with markdown fence handling
  let parsed = safeParseJson(rawContent);
  if (!parsed || typeof parsed !== "object") {
    // Try to extract from markdown fences
    const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      parsed = safeParseJson(jsonMatch[1]);
    }
  }
  
  // Handle both { easy, medium, hard } and { questions: { easy, medium, hard } } formats
  if (parsed && typeof parsed === "object") {
    if (parsed.questions && typeof parsed.questions === "object") {
      parsed = parsed.questions;
    }
  }
  
  if (!parsed || typeof parsed !== "object") {
    console.error("Invalid JSON from OpenRouter:", rawContent);
    return res.status(500).json({ error: "OpenRouter returned invalid JSON.", raw: rawContent });
  }

  const trimmed = normalizeBankToPerDifficulty(
    {
      easy: Array.isArray(parsed.easy) ? parsed.easy : [],
      medium: Array.isArray(parsed.medium) ? parsed.medium : [],
      hard: Array.isArray(parsed.hard) ? parsed.hard : [],
    },
    count
  );

  const questions = trimmed;

  if (!questions.easy.length && !questions.medium.length && !questions.hard.length) {
    return res.status(500).json({ error: "No questions were generated by OpenRouter." });
  }

  for (const k of ["easy", "medium", "hard"]) {
    if (questions[k].length < count) {
      return res.status(500).json({
        error: `OpenRouter returned only ${questions[k].length} "${k}" questions; exactly ${count} per difficulty are required.`,
      });
    }
  }

  let resolvedSessionId = bodySessionId || null;
  if (!resolvedSessionId) {
    console.log("Looking up session for gameCode:", gameCode);
    try {
      const result = await supabaseAdmin.from("sessions").select("id").eq("game_code", gameCode).maybeSingle();
      resolvedSessionId = result.data?.id ?? null;
    } catch (err) {
      console.error("Session lookup exception:", err);
      return res.status(500).json({ error: "Failed to look up session", details: err.message });
    }
  }

  // Normalized `questions` rows use a different shape than this project's `public.questions` table
  // (choice_a/b/c/d). Skipping bulk insert avoids 500s; the client persists banks on `sessions.questions_by_difficulty`.

  if (resolvedSessionId) {
    const { error: sessionError } = await supabaseAdmin
      .from("sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", resolvedSessionId);
    if (sessionError) console.warn("Failed to update session timestamp:", sessionError);
  }

  console.log("Success: returning questions");
  return res.status(200).json({ questions });
}
