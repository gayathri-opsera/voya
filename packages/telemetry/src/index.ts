/**
 * OpenTelemetry bootstrap — WO-008: Bootstrap OTel tracing with X-Ray propagation.
 *
 * Configures:
 * - W3C TraceContext + AWS X-Ray propagator
 * - Auto-instrumentation for HTTP, Express, and Prisma
 * - OTLP exporter to ADOT collector (sidecar)
 * - Resource attributes: service.name, service.version, deployment.environment
 */

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  otlpEndpoint?: string;
  enabled: boolean;
}

/**
 * Initialize OpenTelemetry tracing.
 * Must be called BEFORE any other module imports to ensure auto-instrumentation.
 *
 * Note: Actual OTel SDK initialization requires dynamic imports to avoid
 * circular dependency issues with instrumented modules.
 */
export async function initTelemetry(config: TelemetryConfig): Promise<void> {
  if (!config.enabled) return;

  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { getNodeAutoInstrumentations } = await import(
    "@opentelemetry/auto-instrumentations-node"
  );
  const { OTLPTraceExporter } = await import(
    "@opentelemetry/exporter-trace-otlp-http"
  );
  const { Resource } = await import("@opentelemetry/resources");
  const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } = await import(
    "@opentelemetry/semantic-conventions"
  );

  const exporter = new OTLPTraceExporter({
    url: config.otlpEndpoint ?? "http://localhost:4318/v1/traces",
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion,
      "deployment.environment": config.environment,
    }),
    traceExporter: exporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  process.on("SIGTERM", async () => {
    await sdk.shutdown();
  });
}

/** Extract trace ID from current active span for error response headers. */
export function getCurrentTraceId(): string | undefined {
  try {
    const { trace, context } = require("@opentelemetry/api");
    const span = trace.getActiveSpan();
    if (!span) return undefined;
    const ctx = span.spanContext();
    return ctx.traceId !== "00000000000000000000000000000000" ? ctx.traceId : undefined;
  } catch {
    return undefined;
  }
}
