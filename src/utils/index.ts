import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { getConfig } from "../config/index.js";

// ── Logger ──────────────────────────────────────────────────────────

const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: string): boolean {
  const configLevel = getConfig().logLevel;
  return (LOG_LEVELS[level] ?? 1) >= (LOG_LEVELS[configLevel] ?? 1);
}

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (shouldLog("debug")) console.debug(`[${timestamp()}] DEBUG: ${message}`, ...args);
  },
  info: (message: string, ...args: unknown[]) => {
    if (shouldLog("info")) console.log(`[${timestamp()}] INFO: ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    if (shouldLog("warn")) console.warn(`[${timestamp()}] WARN: ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    if (shouldLog("error")) console.error(`[${timestamp()}] ERROR: ${message}`, ...args);
  },
};

// ── Message Helpers ─────────────────────────────────────────────────

export function createHumanMessage(content: string): HumanMessage {
  return new HumanMessage(content);
}

export function createAIMessage(content: string): AIMessage {
  return new AIMessage(content);
}

export function createSystemMessage(content: string): SystemMessage {
  return new SystemMessage(content);
}

export function createToolMessage(
  content: string,
  toolCallId: string
): ToolMessage {
  return new ToolMessage({ content, tool_call_id: toolCallId });
}

export function getMessageText(message: BaseMessage): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((block): block is { type: "text"; text: string } =>
        typeof block === "object" && block !== null && "type" in block && block.type === "text"
      )
      .map((block) => block.text)
      .join("");
  }
  return "";
}

export function formatMessages(messages: BaseMessage[]): string {
  return messages
    .map((m) => {
      const role = m._getType();
      const text = getMessageText(m);
      return `[${role}]: ${text}`;
    })
    .join("\n");
}

// ── Retry Helper ────────────────────────────────────────────────────

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        logger.warn(
          `Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${lastError.message}`
        );
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

// ── Utility Functions ───────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function generateId(prefix: string = "id"): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

export function safeJsonParse<T>(text: string, defaultValue: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return defaultValue;
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}
