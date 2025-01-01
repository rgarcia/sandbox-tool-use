import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
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
import { type LanguageModelV1 } from "ai";
import {
  traced as bttraced,
  initLogger,
  wrapAISDKModel,
  type Span as BTSpan,
  type SetCurrentArg,
  type StartSpanArgs,
} from "braintrust";

// check required env vars
const requiredEnvVars = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GROQ_API_KEY",
  "BRAINTRUST_API_KEY",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_EXPORTER_OTLP_HEADERS",
];
const errors = requiredEnvVars.filter(
  (envVar) => process.env[envVar] === undefined
);
if (errors.length > 0) {
  throw new Error(
    `Missing required environment variables: ${errors.join(", ")}`
  );
}

export const braintrustLogger = initLogger({
  projectName: "sandbox-tool-use",
  apiKey: process.env.BRAINTRUST_API_KEY,
});

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

export const anthropic = (modelId: string, settings?: any) => {
  return wrapAISDKModel(
    createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })(modelId, settings)
  );
};

export const openai = (modelId: string, settings?: any) => {
  return wrapAISDKModel(
    createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })(modelId, settings)
  );
};

export const google = (modelId: string, settings?: any) => {
  return wrapAISDKModel(
    createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    })(modelId, settings)
  );
};

export const groq = (modelId: string, settings?: any) => {
  return wrapAISDKModel(
    createGroq({
      apiKey: process.env.GROQ_API_KEY,
    })(modelId, settings)
  );
};

/*
 * allModels is the list of models we want try.
 */
export const allModels: LanguageModelV1[] = [
  // google("gemini-1.5-pro-latest"),
  // google("gemini-2.0-flash-exp"),
  groq("llama3-groq-8b-8192-tool-use-preview"),
  groq("llama3-groq-70b-8192-tool-use-preview"),
  anthropic("claude-3-5-sonnet-20241022"),
  anthropic("claude-3-5-haiku-20241022"),
  openai("gpt-4o"),
  openai("gpt-4o-mini"),
];
