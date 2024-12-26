import { generateText } from "ai";
import pMap from "p-map";
import { allModels } from "./providers";
import { logger } from "./utils";

await pMap(allModels, async (model) => {
  const result = await generateText({
    model,
    prompt: "How many R's are in the word strawberry?",
  });
  logger.info({ model: model.modelId, response: result.text });
});
