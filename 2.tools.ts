import { generateText, LanguageModelV1 } from "ai";
import pMap from "p-map";
import { z } from "zod";
import { allModels } from "./providers";
import { logger, withTiming } from "./utils";

const run = async (model: LanguageModelV1) => {
  const { modelId } = model;
  logger.info({ model: modelId }, "generateText-begin");

  const [result, timing] = await withTiming(async () =>
    generateText({
      model,
      tools: {
        fetch: {
          description: "fetch a URL",
          parameters: z.object({
            url: z.string().describe("The URL to fetch"),
          }),
          execute: async ({ url }) => {
            logger.info("tool-call-begin");
            const [response, timing] = await withTiming(
              async () => await fetch(url)
            );
            logger.info(
              { timing, tool: "fetch", args: { url } },
              "tool-call-end"
            );
            return response.text();
          },
        },
      },
      prompt: "What's my IP address?",
    })
  );

  logger.info(
    { model: modelId, timing, messages: result.response.messages },
    "generateText-end"
  );
};

await pMap(allModels, run);
