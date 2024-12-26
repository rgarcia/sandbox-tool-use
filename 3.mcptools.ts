import { generateText, LanguageModelV1 } from "ai";
import pMap from "p-map";
import { allModels } from "./providers";
import { createToolSet, defaultToolModifier } from "./src";
import { logger, withTiming } from "./utils";

async function run(model: LanguageModelV1) {
  const [toolSet, timingToolSet] = await withTiming(async () =>
    createToolSet({
      mcpServers: {
        fetch: {
          command: "uvx",
          args: ["mcp-server-fetch@latest"],
        },
      },
      onCallTool: async (serverName, toolName, args, result) => {
        logger.info("tool-call-begin");
        const [_, timing] = await withTiming(async () => await result);
        logger.info(
          {
            tool: toolName,
            server: serverName,
            args,
            timing,
          },
          "tool-call"
        );
      },
      toolModifier: defaultToolModifier(model.modelId),
    })
  );
  logger.info({ timing: timingToolSet }, "createToolSet");
  const { modelId } = model;
  logger.info({ model: modelId }, "generateText-begin");
  const [result, timing] = await withTiming(async () =>
    generateText({
      model,
      tools: toolSet.tools,
      prompt: "What's my IP address?",
    })
  );
  logger.info(
    {
      model: modelId,
      timing,
      text: result.text,
      toolResults: result.toolResults,
    },
    "generateText"
  );
  await pMap(Object.values(toolSet.clients), async (client) => {
    await client.close();
  });
}
await pMap(allModels, run);
