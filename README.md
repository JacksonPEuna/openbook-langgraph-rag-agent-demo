# OpenBook LangGraph RAG Agent

A TypeScript LangGraph ReAct agent that answers questions about budget documents using AWS Bedrock Knowledge Base for retrieval. Served via Express with a built-in chat UI.

## Architecture

```
START -> agent (LLM) -> [tool_calls?] -> knowledge_base_retrieval -> agent -> END
```

The agent follows a **ReAct** (Reason + Act) pattern powered by [LangGraph](https://langchain-ai.github.io/langgraphjs/):

1. The LLM receives the user query and decides whether to call the `knowledge_base_retrieval` tool
2. If called, the tool queries an **AWS Bedrock Knowledge Base** and returns relevant document chunks
3. The LLM synthesizes the retrieved chunks into a markdown-formatted answer
4. The cycle repeats if the LLM needs additional information

## LLM Providers

The agent supports three LLM providers, configured via `LLM_PROVIDER` in `.env`:

| Provider | Value | Model Config |
|----------|-------|-------------|
| **Anthropic** (default) | `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| AWS Bedrock | `bedrock` | `BEDROCK_LLM_MODEL`, AWS credentials |
| OpenAI | `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` |

The default configuration uses the **Anthropic API** directly with `claude-sonnet-4-20250514`. Bedrock and OpenAI are available as alternatives.

> **Note:** Regardless of which LLM provider is selected, the retrieval tool always uses AWS Bedrock Knowledge Base (which requires AWS credentials/profile).

## Prerequisites

- Node.js >= 20
- An AWS account with a Bedrock Knowledge Base configured
- An API key for your chosen LLM provider (Anthropic by default)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment template and fill in your values:
   ```bash
   cp .env.example .env
   ```

3. At minimum, configure these in `.env`:
   ```env
   # AWS profile for Bedrock Knowledge Base access
   AWS_PROFILE=PowerUserAccess-553160715626

   # Your Bedrock Knowledge Base ID
   KNOWLEDGE_BASE_ID=EVXFGYARHJ

   # LLM provider (anthropic, bedrock, or openai)
   LLM_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-...
   ANTHROPIC_MODEL=claude-sonnet-4-20250514
   ```

## Running

### Development
```bash
npm run dev
```
Starts the Express server on `http://localhost:3000` with hot reload via `tsx`.

### Production
```bash
npm run build
npm start
```

### LangGraph Studio
```bash
npm run langgraph:dev
```
Opens the agent in [LangGraph Studio](https://langchain-ai.github.io/langgraphjs/) on port 8123.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Chat UI |
| `/api/chat` | POST | Send a message. Body: `{ "message": "..." }` |
| `/api/health` | GET | Health check |
| `/api/examples` | GET | Example questions |

### POST /api/chat

```json
// Request
{ "message": "How much is the total budget?" }

// Response
{
  "success": true,
  "response": "## Total Budget\n\nThe total budget is...",
  "thinking": [],
  "message": "How much is the total budget?"
}
```

The `response` field contains raw markdown, rendered client-side with [marked.js](https://marked.js.org/).

## Project Structure

```
src/
  server.ts                 # Express server + API routes
  agents/rag-agent.ts       # LangGraph StateGraph (ReAct pattern)
  config/index.ts           # Zod-validated environment config
  nodes/rag-nodes.ts        # Agent node, tool node, router + LLM factory
  tools/kb-retrieval.ts     # Bedrock Knowledge Base retrieval tool
  tools/tool-registry.ts    # Tool registration
  state/schemas.ts          # LangGraph state annotations
  types/index.ts            # TypeScript interfaces
  checkpointers/index.ts    # Memory checkpointer for multi-turn conversations
  instrumentation/          # Arize AX OpenTelemetry tracing
  utils/index.ts            # Logger utility
public/
  chat.html                 # Chat UI (marked.js for markdown rendering)
  ai-panel.css              # Styles
  icons/                    # UI icons
langgraph.json              # LangGraph Studio config
```

## Environment Variables

See [.env.example](.env.example) for the full list. Key variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_REGION` | No | `us-east-1` | AWS region for Bedrock |
| `AWS_PROFILE` | No | — | AWS CLI profile for credentials |
| `KNOWLEDGE_BASE_ID` | Yes | — | Bedrock Knowledge Base ID |
| `LLM_PROVIDER` | No | `anthropic` | `anthropic`, `bedrock`, or `openai` |
| `ANTHROPIC_API_KEY` | If anthropic | — | Anthropic API key |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-20250514` | Anthropic model ID |
| `LLM_TEMPERATURE` | No | `0` | LLM temperature (0-2) |
| `LLM_MAX_TOKENS` | No | `4096` | Max response tokens |
| `RETRIEVAL_TOP_K` | No | `5` | Number of KB chunks to retrieve |
| `PORT` | No | `3000` | Server port |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled server |
| `npm test` | Run tests |
| `npm run lint` | Lint source files |
| `npm run typecheck` | Type check without emitting |
| `npm run langgraph:dev` | Open in LangGraph Studio |
