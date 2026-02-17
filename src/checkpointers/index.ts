import { MemorySaver } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { getConfig } from "../config/index.js";
import type { ThreadConfig } from "../types/index.js";

/**
 * Returns a checkpointer instance based on configuration.
 *
 * Supports:
 * - memory: In-process MemorySaver (default, for development)
 * - postgres: PostgresSaver (uncomment import when ready)
 * - redis: RedisSaver (uncomment import when ready)
 */
export function getCheckpointer(): BaseCheckpointSaver {
  const config = getConfig();

  switch (config.checkpointerType) {
    case "memory":
      return new MemorySaver();

    case "postgres":
      // import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
      // return PostgresSaver.fromConnInfo({ connectionString: config.postgresConnectionString! });
      throw new Error(
        "PostgresSaver not configured. Uncomment the import and setup in checkpointers/index.ts"
      );

    case "redis":
      // import { RedisSaver } from "@langchain/langgraph-checkpoint-redis";
      // return new RedisSaver({ url: config.redisUrl! });
      throw new Error(
        "RedisSaver not configured. Uncomment the import and setup in checkpointers/index.ts"
      );

    default:
      return new MemorySaver();
  }
}

/**
 * Create a thread configuration object for checkpointed conversations.
 */
export function createThreadConfig(
  threadId: string,
  additionalConfig?: Record<string, unknown>
): ThreadConfig {
  return {
    configurable: {
      thread_id: threadId,
      ...additionalConfig,
    },
  };
}

/**
 * Generate a unique thread ID.
 */
export function generateThreadId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `thread_${timestamp}_${random}`;
}
