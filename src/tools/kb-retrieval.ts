import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { getConfig } from "../config/index.js";
import { logger } from "../utils/index.js";

let _client: BedrockAgentRuntimeClient | null = null;

function getKBClient(): BedrockAgentRuntimeClient {
  if (_client) return _client;
  const config = getConfig();
  _client = new BedrockAgentRuntimeClient({ region: config.awsRegion });
  logger.info(
    `Bedrock Agent Runtime client initialized in region ${config.awsRegion}`
  );
  return _client;
}

/**
 * Bedrock Knowledge Base retrieval tool.
 *
 * Given a search query, this tool retrieves relevant document chunks
 * from the AWS Bedrock Knowledge Base. It replicates the retrieval
 * pattern from the original Python Strands agent.
 */
export const kbRetrievalTool = tool(
  async ({
    query,
    topK,
  }: {
    query: string;
    topK?: number;
  }): Promise<string> => {
    const config = getConfig();
    const numberOfResults = topK ?? config.retrievalTopK;

    logger.info(
      `KB retrieval tool called: query="${query}", topK=${numberOfResults}`
    );

    try {
      const client = getKBClient();
      const command = new RetrieveCommand({
        knowledgeBaseId: config.knowledgeBaseId,
        retrievalQuery: { text: query },
        retrievalConfiguration: {
          vectorSearchConfiguration: { numberOfResults },
        },
      });

      const response = await client.send(command);
      const results = (response.retrievalResults ?? [])
        .map((r) => r.content?.text ?? "")
        .filter((text) => text.length > 0);

      if (results.length === 0) {
        return JSON.stringify({
          status: "no_results",
          message:
            "No relevant results found in the knowledge base for this query. Try rephrasing.",
          query,
        });
      }

      return JSON.stringify({
        status: "success",
        totalResults: results.length,
        query,
        chunks: results.map((text, index) => ({
          rank: index + 1,
          text,
        })),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      logger.error(`KB retrieval tool error: ${message}`);
      return JSON.stringify({
        status: "error",
        message: `Failed to retrieve documents: ${message}`,
        query,
      });
    }
  },
  {
    name: "knowledge_base_retrieval",
    description:
      "Search the budget document knowledge base in AWS Bedrock. " +
      "Given a natural language query, this tool performs semantic search " +
      "against the Knowledge Base and returns relevant text passages. " +
      "Use this to find budget information, line items, allocations, " +
      "departmental data, policy details, or any content from the budget documents.",
    schema: z.object({
      query: z
        .string()
        .describe(
          "The natural language search query. Be specific for best results."
        ),
      topK: z
        .number()
        .optional()
        .describe("Number of top results to return (default: 5)."),
    }),
  }
);
