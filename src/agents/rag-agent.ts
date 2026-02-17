import { StateGraph } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { AgentStateAnnotation } from "../state/schemas.js";
import { agentNode, toolNode, routeAgentResponse } from "../nodes/index.js";
import {
  getCheckpointer,
  createThreadConfig,
  generateThreadId,
} from "../checkpointers/index.js";
import { getMessageText, logger } from "../utils/index.js";
import { getConfig } from "../config/index.js";
import { initArizeTracing } from "../instrumentation/index.js";
import type { AgentInvokeOptions } from "../types/index.js";

// ── Arize AX Auto-Init ─────────────────────────────────────────────
// Initialize tracing early so all LLM/tool calls are captured.
const _config = getConfig();
if (_config.arizeEnabled) {
  initArizeTracing({
    spaceId: _config.arizeSpaceId,
    apiKey: _config.arizeApiKey,
    projectName: _config.arizeProjectName,
  });
}

// ── Graph Builder ───────────────────────────────────────────────────

/**
 * Builds the RAG agent graph with a ReAct pattern:
 *
 *   START → agent → [conditional] → tools → agent
 *                        ↓
 *                      __end__
 *
 * The agent node invokes the LLM, which decides whether to call the
 * knowledge_base_retrieval tool or produce a final answer.
 */
export function buildRagAgentGraph() {
  const graph = new StateGraph(AgentStateAnnotation)
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", routeAgentResponse, {
      tools: "tools",
      __end__: "__end__",
    })
    .addEdge("tools", "agent");

  return graph;
}

/**
 * Compile the graph with an optional checkpointer.
 */
export function compileRagAgent(options?: {
  checkpointer?: boolean;
  interruptBefore?: string[];
  interruptAfter?: string[];
}) {
  const graph = buildRagAgentGraph();
  const compileOptions: Record<string, unknown> = {};

  if (options?.checkpointer) {
    compileOptions.checkpointer = getCheckpointer();
  }
  if (options?.interruptBefore) {
    compileOptions.interruptBefore = options.interruptBefore;
  }
  if (options?.interruptAfter) {
    compileOptions.interruptAfter = options.interruptAfter;
  }

  return graph.compile(compileOptions);
}

/**
 * Exported graph without checkpointer — used by LangGraph Studio/API.
 */
export const graph = buildRagAgentGraph().compile();

// ── Helper Agent (with checkpointer for local use) ──────────────────

let _agent: ReturnType<typeof compileRagAgent> | null = null;

function getAgent() {
  if (!_agent) {
    _agent = compileRagAgent({ checkpointer: true });
  }
  return _agent;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Invoke the RAG agent with a query.
 *
 * This is the primary entry point. It:
 * 1. Sends the user query as a message
 * 2. Returns the agent's final response
 */
export async function invokeAgent(
  options: AgentInvokeOptions
): Promise<string> {
  const { query, threadId, config } = options;
  const agent = getAgent();
  const thread = threadId ?? generateThreadId();
  const threadConfig = createThreadConfig(thread);

  logger.info(
    `Invoking RAG agent: query="${query}", thread="${thread}"`
  );

  const userMessage = new HumanMessage(query);

  const result = await agent.invoke(
    {
      messages: [userMessage],
    },
    { ...threadConfig, ...config }
  );

  const lastMessage = result.messages[result.messages.length - 1];
  return getMessageText(lastMessage);
}

/**
 * Stream the RAG agent's response for real-time output.
 */
export async function* streamAgent(
  options: AgentInvokeOptions
): AsyncGenerator<{ messages: unknown[] }> {
  const { query, threadId, config } = options;
  const agent = getAgent();
  const thread = threadId ?? generateThreadId();
  const threadConfig = createThreadConfig(thread);

  const userMessage = new HumanMessage(query);

  const stream = await agent.stream(
    { messages: [userMessage] },
    { ...threadConfig, ...config, streamMode: "values" }
  );

  for await (const chunk of stream) {
    yield chunk;
  }
}

/**
 * Stream granular events from the agent (tool calls, tokens, etc.).
 */
export async function* streamAgentEvents(
  options: AgentInvokeOptions
): AsyncGenerator<unknown> {
  const { query, threadId, config } = options;
  const agent = getAgent();
  const thread = threadId ?? generateThreadId();
  const threadConfig = createThreadConfig(thread);

  const userMessage = new HumanMessage(query);

  const stream = agent.streamEvents(
    { messages: [userMessage] },
    { ...threadConfig, ...config, version: "v2" }
  );

  for await (const event of stream) {
    yield event;
  }
}

/**
 * Continue a multi-turn conversation on an existing thread.
 */
export async function continueConversation(
  threadId: string,
  query: string,
  config?: RunnableConfig
): Promise<string> {
  const agent = getAgent();
  const threadConfig = createThreadConfig(threadId);

  const userMessage = new HumanMessage(query);

  const result = await agent.invoke(
    { messages: [userMessage] },
    { ...threadConfig, ...config }
  );

  const lastMessage = result.messages[result.messages.length - 1];
  return getMessageText(lastMessage);
}

/**
 * Retrieve the current state for a given thread.
 */
export async function getThreadState(threadId: string) {
  const agent = getAgent();
  const threadConfig = createThreadConfig(threadId);
  return agent.getState(threadConfig);
}

/**
 * Get full conversation history for a thread.
 */
export async function getThreadHistory(threadId: string) {
  const agent = getAgent();
  const threadConfig = createThreadConfig(threadId);
  return agent.getStateHistory(threadConfig);
}
