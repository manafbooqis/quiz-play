import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiPlugin = (env) => ({
  name: "api-plugin",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const requestUrl = req.url?.split("?")[0] || "";
      const normalizedUrl = requestUrl.replace(/^\/quiz-play/, "");

      if (
        req.method === "POST" &&
        normalizedUrl === "/api/generate-questions"
      ) {
        Object.assign(process.env, env);

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            req.body = body ? JSON.parse(body) : {};
          } catch {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Invalid JSON body" }));
            return;
          }

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
    base: "/",
  };
});