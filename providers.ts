import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { type LanguageModelV1 } from "ai";
import { initLogger, wrapAISDKModel } from "braintrust";

// check required env vars
const requiredEnvVars = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GROQ_API_KEY",
  "DEEPSEEK_API_KEY",
  "BRAINTRUST_API_KEY",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_EXPORTER_OTLP_HEADERS",
  "AWS_PROFILE", // assume we're running locally and user has aws profiles configured and labeled in ~/.aws
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

export const deepSeek = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export const bedrock = createAmazonBedrock({
  bedrockOptions: {
    region: "us-east-2",
    profile: process.env.AWS_PROFILE,
  },
});

/*
 * allModels is the list of models we want try.
 */
export const allModels: LanguageModelV1[] = [
  google("gemini-1.5-pro-latest"),
  google("gemini-2.0-flash-exp"),
  groq("llama-3.3-70b-versatile"),
  anthropic("claude-3-5-sonnet-20241022"),
  anthropic("claude-3-5-haiku-20241022"),
  openai("gpt-4o"),
  openai("gpt-4o-mini"),
  deepSeek("deepseek-chat"),
  bedrock("us.amazon.nova-pro-v1:0"),
  bedrock("us.amazon.nova-micro-v1:0"),
];
