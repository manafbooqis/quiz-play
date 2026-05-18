import { createClient } from "@supabase/supabase-js";
import { inflateRawSync } from "node:zlib";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

console.log("=== API Route: generate-questions ===");
console.log("SUPABASE_URL:", SUPABASE_URL ? "set" : "MISSING");
console.log("SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING");
console.log("GEMINI_API_KEY:", GEMINI_API_KEY ? "set" : "MISSING");
console.log("GROQ_API_KEY:", GROQ_API_KEY ? "set" : "MISSING");
console.log("COHERE_API_KEY:", COHERE_API_KEY ? "set" : "MISSING");
console.log("OPENROUTER_API_KEY:", OPENROUTER_API_KEY ? "set" : "MISSING");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase server-side env variables.");
}

const supabaseAdmin = SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

// ─── JSON Helpers ──────────────────────────────────────────────────────────────

function safeParseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ─── Prompt ────────────────────────────────────────────────────────────────────

function buildSimplePrompt() {
  return `You are a quiz question generator. Return ONLY valid JSON. No markdown. No explanation.

Generate exactly 1 easy, 1 medium, and 1 hard multiple-choice question from the document content provided.

Each question must have:
- "id": unique string (e.g. "easy-1")
- "question": question text
- "options": array of exactly 4 strings
- "correct_answer": the exact string that is the correct option (must match one of the options exactly)

Return this exact structure:
{
  "easy": [{ "id": "easy-1", "question": "...", "options": ["...", "...", "...", "..."], "correct_answer": "..." }],
  "medium": [{ "id": "medium-1", "question": "...", "options": ["...", "...", "...", "..."], "correct_answer": "..." }],
  "hard": [{ "id": "hard-1", "question": "...", "options": ["...", "...", "...", "..."], "correct_answer": "..." }]
}`;
}

// ─── Normalize output ──────────────────────────────────────────────────────────

function normalizeOutput(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const result = { easy: [], medium: [], hard: [] };
  for (const diff of ["easy", "medium", "hard"]) {
    const arr = Array.isArray(parsed[diff]) ? parsed[diff] : [];
    result[diff] = arr.map((q, i) => ({
      id: q.id || `${diff}-${i + 1}`,
      question: q.question || "",
      options: Array.isArray(q.options) ? q.options : [],
      correct_answer: q.correct_answer || q.correctAnswer || "",
    })).filter(q => q.question && q.options.length === 4 && q.correct_answer);
  }
  if (!result.easy.length && !result.medium.length && !result.hard.length) return null;
  return result;
}

// ─── Provider calls ────────────────────────────────────────────────────────────

async function callGemini(fullPrompt, signal) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
    signal,
  });
  if (res.status === 429) throw Object.assign(new Error("Rate limited"), { isRateLimit: true });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = safeParseJson(text);
  if (!parsed) throw Object.assign(new Error("Invalid JSON from Gemini"), { isInvalidJson: true });
  return parsed;
}

async function callGroq(fullPrompt, signal) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You only output valid JSON for quiz questions." },
        { role: "user", content: fullPrompt },
      ],
      temperature: 0.7,
    }),
    signal,
  });
  if (res.status === 429) throw Object.assign(new Error("Rate limited"), { isRateLimit: true });
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content || "";
  const parsed = safeParseJson(text);
  if (!parsed) throw Object.assign(new Error("Invalid JSON from Groq"), { isInvalidJson: true });
  return parsed;
}

async function callCohere(fullPrompt, signal) {
  const res = await fetch("https://api.cohere.com/v2/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${COHERE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "command-r7b-12-2024",
      messages: [{ role: "user", content: fullPrompt }],
    }),
    signal,
  });
  if (res.status === 429) throw Object.assign(new Error("Rate limited"), { isRateLimit: true });
  if (!res.ok) throw new Error(`Cohere HTTP ${res.status}`);
  const json = await res.json();
  const text = json?.message?.content?.[0]?.text || json?.text || "";
  const parsed = safeParseJson(text);
  if (!parsed) throw Object.assign(new Error("Invalid JSON from Cohere"), { isInvalidJson: true });
  return parsed;
}

async function callOpenRouter(fullPrompt, signal) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.APP_URL || "http://localhost:5173",
      "X-Title": "Quiz Play AI Question Generator",
    },
    body: JSON.stringify({
      model: "nousresearch/hermes-3-llama-3.1-405b:free",
      messages: [
        { role: "system", content: "You only output valid JSON for quiz questions." },
        { role: "user", content: fullPrompt },
      ],
      temperature: 0.7,
    }),
    signal,
  });
  if (res.status === 429) throw Object.assign(new Error("Rate limited"), { isRateLimit: true });
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content || "";
  const parsed = safeParseJson(text);
  if (!parsed) throw Object.assign(new Error("Invalid JSON from OpenRouter"), { isInvalidJson: true });
  return parsed;
}

// Provider registry
const PROVIDERS = [
  { name: "Gemini",     key: () => GEMINI_API_KEY,     fn: callGemini },
  { name: "Groq",       key: () => GROQ_API_KEY,       fn: callGroq },
  { name: "Cohere",     key: () => COHERE_API_KEY,     fn: callCohere },
  { name: "OpenRouter", key: () => OPENROUTER_API_KEY, fn: callOpenRouter },
];

// ─── Multi-provider AI call ────────────────────────────────────────────────────

async function generateWithFallback(fullPrompt) {
  const TOTAL_TIMEOUT_MS = 25000;
  const PER_PROVIDER_MS = 8000;
  const startTime = Date.now();

  for (const provider of PROVIDERS) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= TOTAL_TIMEOUT_MS) {
      console.error("[AI Total Duration] Exceeded 25s total, stopping.");
      break;
    }

    if (!provider.key()) {
      console.log(`[AI Provider Skip] ${provider.name} — missing key`);
      continue;
    }

    console.log(`[AI Provider Attempt] ${provider.name}`);

    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), PER_PROVIDER_MS);

    try {
      const raw = await provider.fn(fullPrompt, controller.signal);
      clearTimeout(timerId);

      const normalized = normalizeOutput(raw);
      if (!normalized) {
        console.error(`[AI Provider InvalidJSON] ${provider.name} — output could not be normalized`);
        continue;
      }

      const duration = Date.now() - startTime;
      console.log(`[AI Provider Success] ${provider.name}`);
      console.log(`[AI Total Duration] ${duration}ms`);
      return { ok: true, questions: normalized };

    } catch (err) {
      clearTimeout(timerId);

      if (err.name === "AbortError") {
        console.error(`[AI Provider Timeout] ${provider.name}`);
      } else if (err.isRateLimit) {
        console.error(`[AI Provider RateLimit] ${provider.name}`);
      } else if (err.isInvalidJson) {
        console.error(`[AI Provider InvalidJSON] ${provider.name} — ${err.message}`);
      } else {
        console.error(`[AI Provider Error] ${provider.name} — ${err.message}`);
      }
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[AI Total Duration] ${duration}ms — all providers failed`);
  return { ok: false };
}

// ─── Utility helpers (unchanged) ──────────────────────────────────────────────

function buildQuestionPrompt(perDifficultyCount) {
  const n = Math.max(1, Math.floor(Number(perDifficultyCount) || 1));
  const total = n * 3;

  return `Create university-level multiple-choice quiz questions in JSON format for a classroom activity.
The output must be valid JSON with three top-level arrays: easy, medium, and hard.

IMPORTANT: The instructor chose ${n} as the count PER difficulty (not the total bank size).
- The "easy" array must contain EXACTLY ${n} questions.
- The "medium" array must contain EXACTLY ${n} questions.
- The "hard" array must contain EXACTLY ${n} questions.
- Total questions in the file: ${total} (${n} + ${n} + ${n}).

CRITICAL: Every single question must test a completely different concept, fact, or scenario. Do NOT repeat the same concepts. Questions within the same difficulty must be distinctly different from each other.

QUESTION TYPES BY DIFFICULTY:
EASY questions should test:
- Basic definitions and terminology
- Simple recall of facts from the material
- Direct identification of concepts
- "What is X?" or "Which of the following defines X?"

MEDIUM questions should test:
- Comparison between concepts
- Application of knowledge to simple scenarios
- Understanding relationships between ideas
- "Which of the following best explains X?" or "How do X and Y relate?"

HARD questions should test:
- Complex scenario analysis
- Tricky distinctions between similar concepts
- Multi-step reasoning
- "In which situation would X occur?" or "What is the key difference between X and Y?"

QUALITY REQUIREMENTS FOR ALL QUESTIONS:
- Question text must be clear, specific, and unambiguous
- Exactly 4 options (A, B, C, D)
- One and only one correct answer
- NO "All of the above", "None of the above", or similar options
- Correct answer should not be significantly longer or more detailed than distractors
- All distractors must be plausible and related to the topic
- Avoid obvious wrong answers or joke options
- Options should be roughly similar in length and complexity
- Questions must be based strictly on the provided document content

Each question object must include exactly these 5 properties:
- "id": a unique string identifier (e.g., "easy-1", "medium-1")
- "question": the question text
- "options": an array of 4 answer strings
- "correctAnswer": the index (0-3) of the correct answer
- "difficulty": the difficulty level ("easy", "medium", or "hard")

Output ONLY the JSON object. Do not include markdown formatting or explanations.`;
}

function validateQuestion(question, difficulty) {
  const errors = [];
  if (!question.id) errors.push("Missing id");
  if (!question.question || typeof question.question !== "string") errors.push("Missing or invalid question text");
  if (!Array.isArray(question.options)) errors.push("Missing or invalid options array");
  if (typeof question.correctAnswer !== "number") errors.push("Missing or invalid correctAnswer");
  if (question.difficulty !== difficulty) errors.push("Wrong difficulty");
  if (question.options && question.options.length !== 4) errors.push("Must have exactly 4 options");
  if (question.options && question.correctAnswer >= 0 && question.correctAnswer < 4) {
    const forbiddenPhrases = ["all of the above", "none of the above", "both a and b", "both b and c"];
    const hasForbidden = question.options.some(opt =>
      forbiddenPhrases.some(phrase => opt.toLowerCase().includes(phrase))
    );
    if (hasForbidden) errors.push("Contains forbidden option phrases");
  }
  return errors;
}

function normalizeBankToPerDifficulty(questions, perDifficultyCount) {
  const n = Math.max(1, Math.floor(Number(perDifficultyCount) || 1));
  const out = { easy: [], medium: [], hard: [] };
  for (const k of ["easy", "medium", "hard"]) {
    const arr = Array.isArray(questions[k]) ? questions[k] : [];
    out[k] = arr.slice(0, n);
  }
  return out;
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
}

function normalizeMimeType(fileName, mimeType) {
  const raw = (mimeType || "").trim().toLowerCase();
  if (raw && raw !== "application/octet-stream") return raw;
  const lower = (fileName || "").toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return mimeType || "application/octet-stream";
}

function decodeBase64ToUtf8(base64) {
  if (!base64) return "";
  try { return Buffer.from(base64, "base64").toString("utf8"); } catch { return ""; }
}

function cleanBase64Payload(base64) {
  return base64.includes(",") ? base64.split(",")[1] : base64;
}

function isDocxMime(mimeType) {
  return mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function isPptxMime(mimeType) {
  return mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
}

function decodeXmlEntities(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function extractTextTags(xml) {
  const textParts = [];
  const tagPattern = /<(?:[a-zA-Z0-9]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?t>/g;
  let match;
  while ((match = tagPattern.exec(xml)) !== null) {
    const text = decodeXmlEntities(match[1].replace(/<[^>]+>/g, "")).trim();
    if (text) textParts.push(text);
  }
  return textParts.join(" ");
}

function readZipEntries(buffer) {
  const entries = new Map();
  const eocdSignature = 0x06054b50;
  const centralDirectorySignature = 0x02014b50;
  const localFileSignature = 0x04034b50;
  const minEocdOffset = Math.max(0, buffer.length - 65557);
  let eocdOffset = -1;

  for (let offset = buffer.length - 22; offset >= minEocdOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) { eocdOffset = offset; break; }
  }
  if (eocdOffset === -1) throw new Error("Invalid Office document archive.");

  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  let offset = centralDirectoryOffset;

  while (offset < centralDirectoryEnd) {
    if (buffer.readUInt32LE(offset) !== centralDirectorySignature) break;
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);
    if (buffer.readUInt32LE(localHeaderOffset) === localFileSignature) {
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);
      if (compressionMethod === 0) entries.set(fileName, compressedData);
      else if (compressionMethod === 8) entries.set(fileName, inflateRawSync(compressedData));
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function extractDocxText(buffer) {
  const entries = readZipEntries(buffer);
  return [...entries.entries()]
    .filter(([name]) => /^word\/(?:document|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(name))
    .map(([, content]) => extractTextTags(content.toString("utf8")))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function extractPptxText(buffer) {
  const entries = readZipEntries(buffer);
  return [...entries.entries()]
    .filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort(([a], [b]) => {
      const aNum = Number(a.match(/slide(\d+)\.xml$/)?.[1] || 0);
      const bNum = Number(b.match(/slide(\d+)\.xml$/)?.[1] || 0);
      return aNum - bNum;
    })
    .map(([, content]) => extractTextTags(content.toString("utf8")))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

async function extractFileText({ fileBase64, fileMimeType, fileName }) {
  if (!fileBase64) throw new Error("No file content provided.");
  const mime = normalizeMimeType(fileName, fileMimeType);
  const cleanBase64 = cleanBase64Payload(fileBase64);

  console.log("[File Debug] fileName:", fileName);
  console.log("[File Debug] mimeType:", mime);
  console.log("[File Debug] base64 length:", cleanBase64.length);

  if (mime === "application/pdf") {
    const pdfStartTime = Date.now();
    try {
      const buffer = Buffer.from(cleanBase64, "base64");
      const PDFParser = await import("pdf2json");
      const pdfParser = new PDFParser.default();
      const pdfData = await withTimeout(
        new Promise((resolve, reject) => {
          pdfParser.parseBuffer(buffer, (err, pdf) => { if (err) reject(err); else resolve(pdf); });
        }),
        8000,
        "PDF extraction timed out after 8 seconds"
      );
      let fullText = "";
      if (pdfData?.formImage?.Pages) {
        for (const page of pdfData.formImage.Pages) {
          if (page.Texts) {
            fullText += page.Texts.map(t => t.R?.[0] ? t.R[0].T : "").join(" ") + "\n";
          }
        }
      }
      const text = decodeURIComponent(fullText).replace(/\\u[\dA-F]{4}/gi, m =>
        String.fromCharCode(parseInt(m.replace(/\\u/, ""), 16))
      ).trim();
      console.log("[PDF Debug] Extracted text length:", text.length, "in", Date.now() - pdfStartTime, "ms");
      if (!text) throw new Error("Could not read text from this PDF. Please ensure it contains extractable text.");
      return text;
    } catch (pdfError) {
      console.error("[PDF Error]", pdfError?.message);
      if (pdfError?.message?.includes("timed out")) throw new Error("PDF extraction timed out. Please try TXT/DOCX or paste text.");
      throw new Error(`Failed to extract text from PDF: ${pdfError?.message || String(pdfError)}`);
    }
  }

  if (isDocxMime(mime)) {
    try {
      const buffer = Buffer.from(cleanBase64, "base64");
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value?.trim() || "";
      if (!text) throw new Error("No readable text found in this Word document.");
      return text;
    } catch (e) {
      throw new Error(`Failed to extract text from Word document: ${e?.message || String(e)}`);
    }
  }

  if (isPptxMime(mime)) {
    try {
      const buffer = Buffer.from(cleanBase64, "base64");
      const text = extractPptxText(buffer);
      if (!text) throw new Error("No readable text found in this PowerPoint file.");
      return text;
    } catch (e) {
      throw new Error(`Failed to extract text from PowerPoint file: ${e?.message || String(e)}`);
    }
  }

  if (mime.startsWith("text/") || mime === "application/json") {
    const text = decodeBase64ToUtf8(cleanBase64);
    if (!text.trim()) throw new Error("Could not read text from this file.");
    return text;
  }

  throw new Error("Unsupported file type. Please upload PDF, TXT, CSV, JSON, MD, DOCX, or PPTX.");
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const requestStartTime = Date.now();
  console.log("=== Handler called ===");
  console.log("[Timing] Request received at", new Date().toISOString());

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Supabase service client is not configured." });
  }

  const { gameCode, fileName, questionCount, fileBase64, fileMimeType, textContent } = req.body || {};

  if (!gameCode || !fileName || !questionCount) {
    return res.status(400).json({ error: "gameCode, fileName, and questionCount are required." });
  }

  const count = Number(questionCount);
  if (Number.isNaN(count) || count <= 0) {
    return res.status(400).json({ error: "questionCount must be a positive number." });
  }

  // ── Text extraction ──
  let extractedText = "";
  if (textContent && typeof textContent === "string" && textContent.trim()) {
    console.log("[API] Using browser-extracted text content, length:", textContent.length);
    extractedText = textContent.trim();
  } else {
    console.log("[API] Extracting text from uploaded file...");
    const extractionStart = Date.now();
    try {
      extractedText = await withTimeout(
        extractFileText({ fileBase64: fileBase64 ? String(fileBase64) : "", fileMimeType: fileMimeType || "", fileName: fileName || "" }),
        10000,
        "File extraction timed out after 10 seconds"
      );
      console.log("[Timing] File extraction completed in", Date.now() - extractionStart, "ms");
    } catch (extractionError) {
      console.error("[PDF Error Exact]", extractionError?.message);
      return res.status(400).json({
        error: "File text extraction failed",
        details: extractionError?.message || String(extractionError),
      });
    }
  }

  if (!extractedText?.trim()) {
    return res.status(400).json({ error: "Could not read text from this file. Please upload a text-based PDF or use manual question creation." });
  }

  // Limit text to 5000 characters
  const limitedText = extractedText.substring(0, 5000);
  console.log("[Timing] Final text length after trim:", limitedText.length);

  // Build prompt — use simple 1/1/1 prompt for speed and reliability
  const prompt = buildSimplePrompt();
  const fullPrompt = `${prompt}

Document content:
---
${limitedText}
---

Return ONLY the JSON object. No markdown. No explanation.`;

  console.log("[Timing] Prompt constructed, length:", fullPrompt.length);

  // ── AI generation with multi-provider fallback ──
  const result = await generateWithFallback(fullPrompt);

  const totalDuration = Date.now() - requestStartTime;
  console.log("[Timing] Total request duration:", totalDuration, "ms");

  if (!result.ok) {
    return res.status(500).json({
      error: "Free AI providers are temporarily unavailable",
      details: "Use saved questions, write manually, or try again later.",
    });
  }

  return res.status(200).json({ questions: result.questions });
}
