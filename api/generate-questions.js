import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log("=== API Route: generate-questions ===");
console.log("SUPABASE_URL:", SUPABASE_URL ? "set" : "MISSING");
console.log("SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING");
console.log("GEMINI_API_KEY:", GEMINI_API_KEY ? "set" : "MISSING");

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

function buildQuestionRow(sessionId, gameCode, fileName, difficulty, question, index) {
  return {
    session_id: sessionId,
    game_code: gameCode,
    file_name: fileName,
    difficulty,
    question_text: question.question || "",
    choices: Array.isArray(question.options) ? question.options : [],
    correct_index: typeof question.correctAnswer === "number" ? question.correctAnswer : 0,
    metadata: {
      source: "gemini",
      created_at: new Date().toISOString(),
      original_index: index,
      client_id: question.id,
    },
  };
}

function buildQuestionPrompt(fileName, questionCount) {
  const easyCount = Math.max(1, Math.ceil(questionCount / 3));
  const mediumCount = Math.max(1, Math.floor(questionCount / 3));
  const hardCount = Math.max(1, questionCount - easyCount - mediumCount);

  return `Create a total of ${questionCount} multiple-choice quiz questions in JSON format for a classroom activity. 
The output must be valid JSON with three top-level arrays: easy, medium, and hard. Each array should contain exactly this many questions:
- easy: ${easyCount}
- medium: ${mediumCount}
- hard: ${hardCount}

CRITICAL: Every single question must test a completely different concept, fact, or scenario. Do NOT use the same question structure or repeat the same concepts. The questions within the same difficulty must be distinctly different from each other.

Each question object must include exactly these 5 properties:
- "id": a unique string identifier (e.g., "easy-1", "medium-1")
- "question": the question text
- "options": an array of 4 answer strings
- "correctAnswer": the index (0-3) of the correct answer
- "difficulty": the difficulty level ("easy", "medium", or "hard")

Generate questions related to the material in the uploaded file name: ${fileName}. Output ONLY the JSON object. Do not include markdown formatting or explanations.`;
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

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "Missing Gemini API key." });
  }

  const { gameCode, fileName, questionCount } = req.body || {};
  if (!gameCode || !fileName || !questionCount) {
    return res.status(400).json({ error: "gameCode, fileName, and questionCount are required." });
  }

  const count = Number(questionCount);
  if (Number.isNaN(count) || count <= 0) {
    return res.status(400).json({ error: "questionCount must be a positive number." });
  }

  const prompt = buildQuestionPrompt(fileName, count);
  console.log("Calling Gemini API...");

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  let geminiResponse;
  try {
    geminiResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: {
          parts: [{ text: "You are a helpful assistant that only outputs valid JSON for a quiz question bank." }]
        },
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      }),
    });
  } catch (fetchError) {
    console.error("Gemini fetch error:", fetchError);
    return res.status(500).json({ error: "Failed to call Gemini API", details: fetchError.message });
  }

  if (!geminiResponse.ok) {
    const body = await geminiResponse.text();
    console.error("Gemini error status:", geminiResponse.status);
    console.error("Gemini error body:", body);
    return res.status(500).json({ error: `Gemini request failed: ${geminiResponse.statusText}`, details: body });
  }

  const geminiData = await geminiResponse.json();
  const rawContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  const parsed = safeParseJson(rawContent);
  if (!parsed || typeof parsed !== "object") {
    console.error("Invalid JSON from Gemini:", rawContent);
    return res.status(500).json({ error: "Gemini returned invalid JSON.", raw: rawContent });
  }

  const questions = {
    easy: Array.isArray(parsed.easy) ? parsed.easy : [],
    medium: Array.isArray(parsed.medium) ? parsed.medium : [],
    hard: Array.isArray(parsed.hard) ? parsed.hard : [],
  };

  if (!questions.easy.length && !questions.medium.length && !questions.hard.length) {
    return res.status(500).json({ error: "No questions were generated by Gemini." });
  }

  console.log("Looking up session for gameCode:", gameCode);
  let existingSession;
  try {
    const result = await supabaseAdmin.from("sessions").select("id").eq("game_code", gameCode).maybeSingle();
    existingSession = result.data;
  } catch (err) {
    console.error("Session lookup exception:", err);
    return res.status(500).json({ error: "Failed to look up session", details: err.message });
  }

  const questionRows = [];
  const sessionId = existingSession ? existingSession.id : null;

  ["easy", "medium", "hard"].forEach((difficulty) => {
    questions[difficulty].forEach((question, index) => {
      questionRows.push(buildQuestionRow(sessionId, gameCode, fileName, difficulty, question, index));
    });
  });

  console.log(`Inserting ${questionRows.length} questions...`);
  try {
    const result = await supabaseAdmin.from("questions").insert(questionRows);
    if (result.error) {
      console.error("Question insert error:", result.error);
      return res.status(500).json({ error: "Failed to save generated questions.", details: result.error.message });
    }
  } catch (err) {
    console.error("Question insert exception:", err);
    return res.status(500).json({ error: "Failed to save generated questions", details: err.message });
  }

  if (sessionId) {
    const { error: sessionError } = await supabaseAdmin
      .from("sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (sessionError) console.warn("Failed to update session timestamp:", sessionError);
  }

  console.log("Success: returning questions");
  return res.status(200).json({ questions });
}
