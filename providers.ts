import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

// check required env vars
const requiredEnvVars = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
];
const errors = requiredEnvVars.filter(
  (envVar) => process.env[envVar] === undefined
);
if (errors.length > 0) {
  throw new Error(
    `Missing required environment variables: ${errors.join(", ")}`
  );
}

// useHelicone if you want to a nice UI for seeing the raw API calls made
const useHelicone = process.env.HELICONE_API_KEY !== undefined;

export const anthropic = createAnthropic({
  ...(useHelicone
    ? {
        baseURL: "https://anthropic.helicone.ai/v1",
        headers: {
          "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
        },
      }
    : {}),
});

export const openai = createOpenAI({
  ...(useHelicone
    ? {
        baseURL: "https://oai.helicone.ai/v1",
        headers: {
          "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
        },
      }
    : {}),
});

export const google = createGoogleGenerativeAI({
  ...(useHelicone
    ? {
        baseURL: "https://gateway.helicone.ai/v1beta",
        headers: {
          "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
          "Helicone-Target-URL": `https://generativelanguage.googleapis.com`,
        },
      }
    : {}),
});

/*
 * allModels is the list of models we want try.
 */
export const allModels = [
  google("gemini-1.5-pro-latest"),
  google("gemini-2.0-flash-exp"),
  anthropic("claude-3-5-sonnet-20241022"),
  anthropic("claude-3-5-haiku-20241022"),
  openai("gpt-4o"),
  openai("gpt-4o-mini"),
];
