import type { Span } from "@opentelemetry/api";
import { generateText } from "ai";
import type { Span as BraintrustSpan } from "braintrust";
import pMap from "p-map";
import { groq } from "./providers";
import { createToolSet, defaultToolModifier } from "./src";
import { traced, tracer } from "./tracing";
import type { TestInput, TestResult } from "./types";
import { logger } from "./utils";

export default async function mcpToolsTest({
  model,
  logger,
  input,
}: TestInput): Promise<TestResult> {
  return traced(
    {
      name: "mcp-tools-test",
      btTracedArgs: { type: "task", event: { input } },
    },
    async (otelSpan: Span, btSpan: BraintrustSpan) => {
      const toolSet = await traced(
        { name: "createToolSet", btTracedArgs: { type: "function" } },
        async (otelSpan: Span, btSpan: BraintrustSpan) => {
          const toolSet = await createToolSet({
            mcpServers: {
              fetch: {
                command: "uvx",
                args: ["mcp-server-fetch@latest"],
              },
            },
            toolModifier: defaultToolModifier(model.modelId),
          });
          otelSpan.end();
          btSpan.end();
          return toolSet;
        }
      );

      const result = await generateText({
        model,
        tools: toolSet.tools,
        prompt: input,
        experimental_telemetry: {
          isEnabled: true,
          recordInputs: true,
          recordOutputs: true,
          tracer,
        },
      });
      const resultAsText = [
        result.text,
        ...result.toolResults.map((r: any) => r.result),
      ].join("\n");
      logger.info(
        {
          model: model.modelId,
          toolCalls: result.toolCalls,
          result: resultAsText,
        },
        "mcp-tools"
      );
      await traced(
        { name: "closeToolSet", btTracedArgs: { type: "function" } },
        async (otelSpan: Span, btSpan: BraintrustSpan) => {
          await pMap(Object.values(toolSet.clients), async (client) => {
            await client.close();
          });
          otelSpan.end();
          btSpan.end();
        }
      );
      otelSpan.end();
      btSpan.log({ output: resultAsText });
      btSpan.end();
      return {
        result: resultAsText,
      };
    }
  );
}

if (import.meta.main) {
  mcpToolsTest({
    model: groq("llama3-groq-70b-8192-tool-use-preview"),
    input: "What's my IP address?",
    logger,
  }).catch(console.error);
}
