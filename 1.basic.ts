import { generateText } from "ai";
import { google, traced, tracer } from "./providers";
import { type TestInput, type TestResult } from "./types";
import { logger } from "./utils";

export default async function basicTest({
  model,
  logger,
  input,
}: TestInput): Promise<TestResult> {
  return traced(
    { name: "basic-test", btTracedArgs: { type: "task", event: { input } } },
    async (otelSpan, btSpan) => {
      const result = await generateText({
        model: model,
        prompt: input,
        experimental_telemetry: {
          isEnabled: true,
          recordInputs: true,
          recordOutputs: true,
          tracer,
        },
      });
      logger.info({ model: model.modelId, result: result.text });
      otelSpan.end();
      btSpan.log({ output: result.text });
      btSpan.end();
      return {
        result: result.text,
      };
    }
  );
}

if (import.meta.main) {
  basicTest({
    model: google("gemini-2.0-flash-exp"),
    input: "How many R's are in the word strawberry?",
    logger,
  }).catch(console.error);
}
