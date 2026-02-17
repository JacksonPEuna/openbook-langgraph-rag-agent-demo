import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

/**
 * RAG Agent state schema.
 *
 * Extends MessagesAnnotation (which provides `messages` with the LangGraph
 * message reducer) with agent-specific fields for observability and loop control.
 */
export const AgentStateAnnotation = Annotation.Root({
  // Inherit the messages channel with the built-in reducer
  ...MessagesAnnotation.spec,

  /** Current processing step for observability. */
  currentStep: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "idle",
  }),

  /** Error message if something went wrong. */
  error: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Number of agent iterations (loop protection). */
  iterations: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;
export type AgentStateUpdate = typeof AgentStateAnnotation.Update;
