import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  getConfig,
  validateLlmConfig,
  logConfigSummary,
} from "./config/index.js";
import { invokeAgent } from "./agents/rag-agent.js";
import { shutdownArizeTracing } from "./instrumentation/index.js";
import { logger } from "./utils/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = getConfig();
validateLlmConfig();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public/
const publicPath = path.resolve(__dirname, "..", "public");
app.use(express.static(publicPath));

// ── API Routes ──────────────────────────────────────────────────────

// POST /api/chat
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({
        error: "No message provided",
        response: "Please provide a message to process.",
      });
      return;
    }

    const userMessage = message.trim();
    logger.info(
      `Processing user message: ${userMessage.substring(0, 100)}...`
    );

    try {
      const rawResponse = await invokeAgent({ query: userMessage });

      // Extract thinking tags (same pattern as original Python app.py)
      const thinkingMatches: string[] = [];
      const thinkingPattern = /<thinking>([\s\S]*?)<\/thinking>/g;
      let match: RegExpExecArray | null;
      while ((match = thinkingPattern.exec(rawResponse)) !== null) {
        thinkingMatches.push(match[1]);
      }

      // Remove thinking tags from content
      const content = rawResponse
        .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
        .replace(/\n\s*\n/g, "\n\n")
        .trim();

      res.json({
        success: true,
        response: content, // Raw markdown — frontend parses with marked.js
        thinking: thinkingMatches,
        message: userMessage,
      });
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : String(error);
      logger.error(`Error processing message with RAG agent: ${errMsg}`);
      res.status(500).json({
        error: "Processing error",
        response: `I apologize, but I encountered an error processing your request: ${errMsg}`,
      });
    }
  } catch (error) {
    logger.error(`Unexpected error in chat endpoint: ${error}`);
    res.status(500).json({
      error: "Server error",
      response: "An unexpected server error occurred. Please try again.",
    });
  }
});

// GET /api/health
app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    agentAvailable: true,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/examples
app.get("/api/examples", (_req, res) => {
  res.json({
    examples: [
      "How much is the total budget?",
      "What are the main priorities of this year's budget?",
      "What are the primary sources of revenue for this year's budget?",
      "Can you tell me about the file in the knowledge base? Summarize it",
      "Summarize the budgets",
      "What departments are included in this budget?",
    ],
  });
});

// Fallback: serve chat.html for root
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicPath, "chat.html"));
});

// ── Start Server ────────────────────────────────────────────────────

const port = config.port;

app.listen(port, () => {
  logConfigSummary();
  logger.info(`Server running on http://localhost:${port}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await shutdownArizeTracing();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  await shutdownArizeTracing();
  process.exit(0);
});
