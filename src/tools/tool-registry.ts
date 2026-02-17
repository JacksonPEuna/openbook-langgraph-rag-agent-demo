import { kbRetrievalTool } from "./kb-retrieval.js";

/**
 * All tools available to the RAG agent.
 */
export const ragTools = [kbRetrievalTool] as const;

/**
 * Tool names for reference.
 */
export const toolNames = ragTools.map((t) => t.name);
