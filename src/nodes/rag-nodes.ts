import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatBedrockConverse } from "@langchain/aws";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AIMessage } from "@langchain/core/messages";
import { SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { getConfig } from "../config/index.js";
import { ragTools } from "../tools/index.js";
import { logger } from "../utils/index.js";
import type { AgentState, AgentStateUpdate } from "../state/schemas.js";

// ── System Prompt ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a Budget Book RAG Assistant — an expert at answering questions about government and organizational budget documents.

You have access to a retrieval tool that searches an AWS Bedrock Knowledge Base containing budget book documents.

## How You Work

1. When a user asks a question, use the \`knowledge_base_retrieval\` tool to search for relevant budget document chunks.
2. Analyze the retrieved chunks carefully and synthesize a clear, accurate answer.
3. If the retrieved context doesn't fully answer the question, you may:
   - Rephrase your query and search again for better results
   - Search for related terms or concepts
   - Clearly state what information you found vs. what is missing
4. Always cite which document(s) your answer is based on when possible.

## Guidelines

- **Accuracy**: Only state facts that are supported by the retrieved chunks. Do not hallucinate or infer budget figures.
- **Transparency**: If the retrieved context is insufficient, say so clearly rather than guessing.
- **Specificity**: When discussing budget figures, include exact numbers, line items, and fiscal years from the source documents.
- **Format**: Structure your responses with markdown formatting — use headings, bold, numbered lists, and bullet points for clarity.

## Response Format

Structure your answers with:
- A direct answer to the question
- Supporting details from the retrieved chunks
- Any caveats about information completeness`;

// ── LLM Factory ─────────────────────────────────────────────────────

export function getLLM(): BaseChatModel {
  const config = getConfig();

  switch (config.llmProvider) {
    case "bedrock":
      return new ChatBedrockConverse({
        model: config.bedrockLlmModel,
        region: config.awsRegion,
        temperature: config.llmTemperature,
        maxTokens: config.llmMaxTokens,
      });

    case "openai":
      return new ChatOpenAI({
        modelName: config.openaiModel,
        openAIApiKey: config.openaiApiKey,
        temperature: config.llmTemperature,
        maxTokens: config.llmMaxTokens,
      });

    case "anthropic":
      return new ChatAnthropic({
        modelName: config.anthropicModel,
        anthropicApiKey: config.anthropicApiKey,
        temperature: config.llmTemperature,
        maxTokens: config.llmMaxTokens,
      });

    default:
      throw new Error(`Unsupported LLM provider: ${config.llmProvider}`);
  }
}

// ── Agent Node ──────────────────────────────────────────────────────

/**
 * The agent node invokes the LLM with tools bound.
 * It prepends the system prompt and passes the full message history.
 */
export async function agentNode(
  state: AgentState,
  _config?: RunnableConfig
): Promise<Partial<AgentStateUpdate>> {
  logger.debug(`Agent node called, iteration=${state.iterations}`);

  const llm = getLLM();
  const llmWithTools = llm.bindTools!([...ragTools]);

  const systemMessage = new SystemMessage(SYSTEM_PROMPT);
  const messages = [systemMessage, ...state.messages];

  const response = await llmWithTools.invoke(messages);

  return {
    messages: [response],
    currentStep: "agent",
    iterations: state.iterations + 1,
  };
}

// ── Tool Node ───────────────────────────────────────────────────────

/**
 * Prebuilt tool executor node. Handles calling the retrieval tool
 * and returning results back into the message history.
 */
export const toolNode = new ToolNode([...ragTools]);

// ── Router ──────────────────────────────────────────────────────────

/**
 * Routes the agent's response:
 * - If the LLM produced tool calls → route to "tools" node
 * - Otherwise → route to "__end__" (final answer)
 */
export function routeAgentResponse(
  state: AgentState
): "tools" | "__end__" {
  const { messages, iterations } = state;

  // Safety: max iterations guard
  if (iterations >= 10) {
    logger.warn("Max iterations reached, forcing end");
    return "__end__";
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) return "__end__";

  const aiMessage = lastMessage as AIMessage;
  if (
    aiMessage.tool_calls &&
    Array.isArray(aiMessage.tool_calls) &&
    aiMessage.tool_calls.length > 0
  ) {
    logger.debug(
      `Routing to tools: ${aiMessage.tool_calls.map((tc) => tc.name).join(", ")}`
    );
    return "tools";
  }

  return "__end__";
}
