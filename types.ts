import { LanguageModelV1 } from "ai";
import { Logger } from "pino";

export type TestResult = {
  result: string;
  error?: string;
};

export type TestInput = {
  model: LanguageModelV1;
  input: string;
  logger: Logger;
};

export type Test = (input: TestInput) => Promise<TestResult>;
