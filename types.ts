import type { LanguageModelV1 } from "ai";
import type { Logger } from "pino";

export type TestResult = {
  result: string;
  error?: string;
};

export type TestInput = {
  model: LanguageModelV1;
  system?: string;
  input: string;
  logger: Logger;
};

export type Test = (input: TestInput) => Promise<TestResult>;
