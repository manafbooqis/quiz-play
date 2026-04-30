import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiPlugin = (env) => ({
  name: "api-plugin",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url === "/api/generate-questions" && req.method === "POST") {
        Object.assign(process.env, env);

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          req.body = body ? JSON.parse(body) : {};

          const mockRes = {
            status: (code) => {
              res.statusCode = code;
              return mockRes;
            },
            json: (data) => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(data));
            },
            setHeader: (key, value) => {
              res.setHeader(key, value);
              return mockRes;
            },
          };

          try {
            const { default: handler } = await import("./api/generate-questions.js");
            await handler(req, mockRes);
          } catch (err) {
            console.error("API Error:", err);
            mockRes.status(500).json({
              error: "Internal Error",
              details: err.message,
            });
          }
        });
      } else {
        next();
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), apiPlugin(env)],
    base: "/quiz-play/",
  };
});