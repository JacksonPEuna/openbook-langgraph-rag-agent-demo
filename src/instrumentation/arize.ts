import { LangChainInstrumentation } from "@arizeai/openinference-instrumentation-langchain";
import {
  NodeTracerProvider,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { Metadata } from "@grpc/grpc-js";
import * as CallbackManagerModule from "@langchain/core/callbacks/manager";

let _initialized = false;
let _provider: NodeTracerProvider | null = null;

/**
 * Initialize Arize AX tracing via OpenTelemetry.
 *
 * Follows the official Arize AX TypeScript setup:
 * https://arize.com/docs/ax/integrations/python-agent-frameworks/langchain/langchain-tracing
 *
 * IMPORTANT: Call `shutdownArizeTracing()` before process exit
 * to ensure all spans are flushed to Arize.
 */
export function initArizeTracing(options?: {
  spaceId?: string;
  apiKey?: string;
  projectName?: string;
  debug?: boolean;
}): void {
  if (_initialized) return;

  const spaceId = options?.spaceId ?? process.env.ARIZE_SPACE_ID;
  const apiKey = options?.apiKey ?? process.env.ARIZE_API_KEY;
  const projectName =
    options?.projectName ??
    process.env.ARIZE_PROJECT_NAME ??
    "opensearch-rag-agent";

  if (!spaceId || !apiKey) {
    console.warn(
      "[arize] ARIZE_SPACE_ID and ARIZE_API_KEY are required for tracing. Skipping."
    );
    return;
  }

  if (options?.debug) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const metadata = new Metadata();
  metadata.set("space_id", spaceId);
  metadata.set("api_key", apiKey);

  const exporter = new OTLPTraceExporter({
    url: "https://otlp.arize.com/v1",
    metadata,
  });

  _provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      "project_name": projectName,
    }),
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });

  // Instrument LangChain BEFORE registering the provider (per Arize docs)
  const lcInstrumentation = new LangChainInstrumentation();
  lcInstrumentation.manuallyInstrument(CallbackManagerModule);

  _provider.register();

  _initialized = true;
  console.log(
    `[arize] Tracing initialized — project: "${projectName}"`
  );
}

/**
 * Flush all pending spans and shut down the tracer provider.
 * Must be awaited before process exit or spans will be lost.
 */
export async function shutdownArizeTracing(): Promise<void> {
  if (!_provider) return;
  try {
    await _provider.forceFlush();
    await _provider.shutdown();
    console.log("[arize] Tracing shut down — all spans flushed.");
  } catch (err) {
    console.error(
      "[arize] Error during shutdown:",
      err instanceof Error ? err.message : err
    );
  }
}
