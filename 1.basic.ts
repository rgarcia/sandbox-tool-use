import type { Span } from "@opentelemetry/api";
import { generateText } from "ai";
import { google, tracer } from "./providers";
import { type TestInput, type TestResult } from "./types";
import { logger } from "./utils";

export default async function basicTest({
  model,
  logger,
  input,
}: TestInput): Promise<TestResult> {
  return tracer.startActiveSpan(`basicTest`, async (span: Span) => {
    logger.info({ model: model.modelId }, "basic");
    const result = await generateText({
      model: model,
      prompt: input,
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: true,
        recordOutputs: true,
      },
    });
    logger.info(
      { model: model.modelId, result: result.text },
      "basic finished"
    );
    span.end();
    return {
      result: result.text,
    };
  });
}

if (import.meta.main) {
  basicTest({
    model: google("gemini-2.0-flash-exp"),
    input: "How many R's are in the word strawberry?",
    logger,
  }).catch(console.error);
}
