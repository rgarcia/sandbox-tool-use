import type { Span } from "@opentelemetry/api";
import { generateText } from "ai";
import { type Span as BraintrustSpan } from "braintrust";
import { z } from "zod";
import { groq } from "./providers";
import { traced, tracer } from "./tracing";
import { type TestInput, type TestResult } from "./types";
import { logger } from "./utils";

export default async function toolsTest({
  model,
  logger,
  input,
}: TestInput): Promise<TestResult> {
  return traced(
    { name: "tools-test", btTracedArgs: { type: "task", event: { input } } },
    async (otelSpan: Span, btSpan: BraintrustSpan) => {
      const result = await generateText({
        model,
        prompt: input,
        experimental_telemetry: {
          isEnabled: true,
          recordInputs: true,
          recordOutputs: true,
          tracer,
        },
        tools: {
          fetch: {
            description: "fetch a URL",
            parameters: z.object({
              url: z.string().describe("The URL to fetch"),
            }),
            execute: async ({ url }) => {
              return (await fetch(url)).text();
            },
          },
        },
      });
      const resultAsText = [
        result.text,
        ...result.toolResults.map((r) => r.result),
      ].join("\n");
      logger.info(
        {
          model: model.modelId,
          toolCalls: result.toolCalls,
          result: resultAsText,
        },
        "tools"
      );
      otelSpan.end();
      btSpan.log({ output: resultAsText });
      btSpan.end();
      return {
        result: resultAsText,
      };
    }
  );
}

if (import.meta.main) {
  toolsTest({
    model: groq("llama3-groq-70b-8192-tool-use-preview"),
    input: "What's my IP address?",
    logger,
  }).catch(console.error);
}
