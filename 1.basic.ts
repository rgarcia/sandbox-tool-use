import { generateText } from "ai";
import { google } from "./providers";
import { TestInput, TestResult } from "./types";
import { logger } from "./utils";

export default async function basicTest({
  model,
  logger,
  input,
}: TestInput): Promise<TestResult> {
  logger.info({ model: model.modelId }, "basic");
  const result = await generateText({
    model: model,
    prompt: input,
  });
  logger.info({ model: model.modelId, result: result.text }, "basic finished");
  return {
    result: result.text,
  };
}

if (import.meta.main) {
  await basicTest({
    model: google("gemini-2.0-flash-exp"),
    input: "How many R's are in the word strawberry?",
    logger,
  });
}
