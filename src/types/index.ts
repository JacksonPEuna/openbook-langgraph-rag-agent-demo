import type { RunnableConfig } from "@langchain/core/runnables";

// ── LLM Provider Types ──────────────────────────────────────────────

export type LLMProvider = "bedrock" | "openai" | "anthropic";

export type CheckpointerType = "memory" | "postgres" | "redis";

export type NodeEnvironment = "development" | "test" | "production";

export type LogLevel = "debug" | "info" | "warn" | "error";

// ── Agent Types ─────────────────────────────────────────────────────

export interface AgentConfig {
  threadId?: string;
  maxIterations?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface ThreadConfig {
  configurable: {
    thread_id: string;
    [key: string]: unknown;
  };
}

export type NodeFunction<TState, TUpdate> = (
  state: TState,
  config?: RunnableConfig
) => Promise<TUpdate>;

export type RouterFunction<TState> = (
  state: TState
) => string | string[];

export interface ConversationTurn {
  role: "human" | "ai" | "tool";
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface StreamEvent {
  event: string;
  name?: string;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface AgentInvokeOptions {
  query: string;
  threadId?: string;
  config?: RunnableConfig;
}
