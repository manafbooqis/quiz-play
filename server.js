import express from "express";
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import generateQuestionsHandler from "./api/generate-questions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = globalThis.process?.env?.PORT || 3000;
const distPath = path.join(__dirname, "dist");
const indexPath = path.join(distPath, "index.html");

app.use(express.json({ limit: "50mb" }));

// Proxies local API requests to the shared question-generation handler.
app.post("/api/generate-questions", async (req, res) => {
  await generateQuestionsHandler(req, res);
});

// Supports the same API route when the app is hosted under /quiz-play.
app.post("/quiz-play/api/generate-questions", async (req, res) => {
  await generateQuestionsHandler(req, res);
});

app.use("/quiz-play", express.static(distPath));
app.use(express.static(distPath));

// Returns 404 for missing static assets instead of serving the SPA shell.
app.use((req, res, next) => {
  if (path.extname(req.path)) {
    res.sendStatus(404);
    return;
  }
  next();
});

// Serves the SPA shell for /quiz-play client-side routes.
app.get(/^\/quiz-play(?:\/.*)?$/, (_req, res) => {
  res.sendFile(indexPath);
});

// Serves the SPA shell for non-API client-side routes.
app.get(/^(?!\/(?:api|quiz-play\/api)\/).*/, (_req, res) => {
  res.sendFile(indexPath);
});

// Starts the production Express server.
app.listen(PORT, () => {
  console.log(`Quiz Play server listening on port ${PORT}`);
});
