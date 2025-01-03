import {
  trace,
  type Context,
  type Span,
  type SpanOptions,
  type Tracer,
} from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import {
  traced as bttraced,
  type Span as BTSpan,
  type SetCurrentArg,
  type StartSpanArgs,
} from "braintrust";

const exporter = new OTLPTraceExporter({
  url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
  headers: process.env
    .OTEL_EXPORTER_OTLP_HEADERS!.split(", ")
    .reduce((acc, header) => {
      const [key, value] = header.split("=");
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>),
});

const provider = new BasicTracerProvider({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: "sandbox-tool-use",
  }),
  spanProcessors: [
    new SimpleSpanProcessor(exporter),
    //new SimpleSpanProcessor(new ConsoleSpanExporter()),
  ],
});
provider.register();

const sdk = new NodeSDK({
  traceExporter: exporter,
});
sdk.start();

/*
 * traced is for annotating a function that should be traced.
 * it passes the otel and braintrust spans back to the user so they can be used in whatever way they want.
 */
export function traced<R>(
  {
    name,
    otelSpanOptions,
    otelContext,
    btTracedArgs,
  }: {
    name: string;
    otelSpanOptions?: SpanOptions;
    otelContext?: Context;
    btTracedArgs?: StartSpanArgs & SetCurrentArg;
  },
  callback: (otelSpan: Span, btSpan: BTSpan) => R
): Promise<R> {
  return unwrappedTracer.startActiveSpan(
    name,
    otelSpanOptions ?? {},
    otelContext!,
    (otelSpan: Span) => {
      return bttraced((btSpan: BTSpan) => callback(otelSpan, btSpan), {
        name,
        ...btTracedArgs,
      });
    }
  );
}

/*
 * wrapTracer returns a new Tracer that wraps the StartActiveSpan method with a call to
 * braintrust's traced function.
 * It also looks at otel span attributes set by the AI SDK and translates them to metadata on the braintrust span.
 */
function wrapTracer(t: Tracer): Tracer {
  return {
    ...t,
    startActiveSpan<F extends (span: Span) => unknown>(
      name: string,
      fnOrOptions: F | SpanOptions,
      fnOrContextOrOptions?: F | Context | SpanOptions,
      maybeFn?: F
    ): ReturnType<F> {
      const tracedOpts: StartSpanArgs & SetCurrentArg = {
        name,
      };
      if (typeof fnOrOptions !== "function" && fnOrOptions.attributes) {
        tracedOpts.event = {
          metadata: fnOrOptions.attributes,
        };
        switch (fnOrOptions.attributes?.["operation.name"]) {
          case "ai.toolCall":
            tracedOpts.type = "tool";
            break;
          case "ai.generateText.doGenerate":
          case "ai.generateText":
            tracedOpts.type = "llm";
            break;
          default:
            tracedOpts.type = "function";
        }
      }
      // Handle all overloads
      if (typeof fnOrOptions === "function") {
        // startActiveSpan(name, fn)
        return bttraced(
          (btSpan: BTSpan) => t.startActiveSpan(name, fnOrOptions),
          tracedOpts
        ) as ReturnType<F>;
      } else if (typeof fnOrContextOrOptions === "function") {
        return bttraced(
          (btSpan: BTSpan) =>
            t.startActiveSpan(name, fnOrOptions, fnOrContextOrOptions),
          tracedOpts
        ) as ReturnType<F>;
      } else {
        // startActiveSpan(name, options, context, fn)
        return bttraced(
          (btSpan: BTSpan) =>
            t.startActiveSpan(
              name,
              fnOrOptions,
              fnOrContextOrOptions as Context,
              maybeFn!
            ),
          tracedOpts
        ) as ReturnType<F>;
      }
    },
  };
}

const unwrappedTracer = trace.getTracer("sandbox-tool-use");
export const tracer = wrapTracer(unwrappedTracer);
