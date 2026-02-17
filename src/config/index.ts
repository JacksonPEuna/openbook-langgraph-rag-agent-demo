import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const ConfigSchema = z.object({
  // AWS Configuration
  awsRegion: z.string().default("us-east-1"),
  awsProfile: z.string().optional(),
  awsAccessKeyId: z.string().optional(),
  awsSecretAccessKey: z.string().optional(),
  awsSessionToken: z.string().optional(),

  // Bedrock Knowledge Base
  knowledgeBaseId: z.string().min(1, "KNOWLEDGE_BASE_ID is required"),

  // LLM Configuration
  llmProvider: z.enum(["bedrock", "openai", "anthropic"]).default("bedrock"),
  bedrockLlmModel: z
    .string()
    .default("anthropic.claude-3-5-sonnet-20241022-v2:0"),
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().default("gpt-4o"),
  anthropicApiKey: z.string().optional(),
  anthropicModel: z.string().default("claude-sonnet-4-20250514"),

  // LLM Parameters
  llmTemperature: z.coerce.number().min(0).max(2).default(0),
  llmMaxTokens: z.coerce.number().positive().default(4096),

  // RAG Configuration
  retrievalTopK: z.coerce.number().positive().default(5),

  // LangSmith Tracing
  langchainTracingV2: z.coerce.boolean().default(false),
  langsmithApiKey: z.string().optional(),
  langsmithProject: z.string().default("openbook-rag-agent"),

  // Arize AX Tracing
  arizeEnabled: z.coerce.boolean().default(false),
  arizeSpaceId: z.string().optional(),
  arizeApiKey: z.string().optional(),
  arizeProjectName: z.string().default("openbook-rag-agent"),

  // Checkpointer
  checkpointerType: z
    .enum(["memory", "postgres", "redis"])
    .default("memory"),
  postgresConnectionString: z.string().optional(),
  redisUrl: z.string().optional(),

  // Application
  port: z.coerce.number().positive().default(3000),
  nodeEnv: z
    .enum(["development", "test", "production"])
    .default("development"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof ConfigSchema>;

let _cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (_cachedConfig) return _cachedConfig;

  const raw = {
    awsRegion: process.env.AWS_REGION,
    awsProfile: process.env.AWS_PROFILE,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsSessionToken: process.env.AWS_SESSION_TOKEN,

    knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,

    llmProvider: process.env.LLM_PROVIDER,
    bedrockLlmModel: process.env.BEDROCK_LLM_MODEL,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL,

    llmTemperature: process.env.LLM_TEMPERATURE,
    llmMaxTokens: process.env.LLM_MAX_TOKENS,

    retrievalTopK: process.env.RETRIEVAL_TOP_K,

    langchainTracingV2: process.env.LANGCHAIN_TRACING_V2,
    langsmithApiKey: process.env.LANGSMITH_API_KEY,
    langsmithProject: process.env.LANGSMITH_PROJECT,

    arizeEnabled: process.env.ARIZE_ENABLED,
    arizeSpaceId: process.env.ARIZE_SPACE_ID,
    arizeApiKey: process.env.ARIZE_API_KEY,
    arizeProjectName: process.env.ARIZE_PROJECT_NAME,

    checkpointerType: process.env.CHECKPOINTER_TYPE,
    postgresConnectionString: process.env.POSTGRES_CONNECTION_STRING,
    redisUrl: process.env.REDIS_URL,

    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
  };

  _cachedConfig = ConfigSchema.parse(raw);
  return _cachedConfig;
}

export function resetConfig(): void {
  _cachedConfig = null;
}

export function validateLlmConfig(): void {
  const config = getConfig();
  switch (config.llmProvider) {
    case "bedrock":
      // Bedrock uses IAM credentials (env vars or instance profile)
      break;
    case "openai":
      if (!config.openaiApiKey) {
        throw new Error(
          "OPENAI_API_KEY is required when LLM_PROVIDER=openai"
        );
      }
      break;
    case "anthropic":
      if (!config.anthropicApiKey) {
        throw new Error(
          "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic"
        );
      }
      break;
  }
}

export function isDevelopment(): boolean {
  return getConfig().nodeEnv === "development";
}

export function isProduction(): boolean {
  return getConfig().nodeEnv === "production";
}

export function isTest(): boolean {
  return getConfig().nodeEnv === "test";
}

export function logConfigSummary(): void {
  const config = getConfig();
  console.log("=== Configuration Summary ===");
  console.log(`  Environment: ${config.nodeEnv}`);
  console.log(`  AWS Region: ${config.awsRegion}`);
  console.log(`  AWS Profile: ${config.awsProfile ?? "(default)"}`);
  console.log(`  Knowledge Base ID: ${config.knowledgeBaseId}`);
  console.log(`  LLM Provider: ${config.llmProvider}`);
  console.log(`  Retrieval Top-K: ${config.retrievalTopK}`);
  console.log(`  Tracing: ${config.langchainTracingV2}`);
  console.log(`  Arize AX: ${config.arizeEnabled}`);
  console.log(`  Server Port: ${config.port}`);
  console.log("=============================");
}
