import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { jsonSchema, type CoreTool } from "ai";
import { JSONSchema7 } from "json-schema";

type ToolInputSchema = Tool["inputSchema"];

type ToolSetConfig = {
  mcpServers: {
    [key: string]: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };
  };
  /**
   * onCallTool is a function that will be called when a tool is called.
   * It will be passed the server name, tool name, arguments, and a function that will resolve to the result of the tool call.
   * Useful for timing the tool calls or doing other instrumentation like logging.
   */
  onCallTool?: (
    serverName: string,
    toolName: string,
    args: any,
    result: Promise<string>
  ) => void;
  /**
   * toolModifier is available to sanitize tool definitions (description and parameters) for models that don't support all JSONSchema7 features or that have other limits.
   */
  toolModifier?: (serverName: string, toolName: string, tool: Tool) => Tool;
};

type ToolSet = {
  tools: {
    [key: string]: CoreTool;
  };
  clients: {
    [key: string]: Client;
  };
};

export async function createToolSet(config: ToolSetConfig): Promise<ToolSet> {
  let toolset: ToolSet = {
    tools: {},
    clients: {},
  };

  // could probably speed this up by spinning these up in parallel
  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    const transport = new StdioClientTransport({
      ...serverConfig,
      stderr: process.stderr,
    });

    const client = new Client(
      {
        name: `${serverName}-client`,
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );
    toolset.clients[serverName] = client;
    await client.connect(transport);

    // Get list of tools and add them to the toolset
    const toolList = await client.listTools();
    for (let tool of toolList.tools) {
      if (config.toolModifier) {
        tool = config.toolModifier(serverName, tool.name, tool);
      }
      let toolName = tool.name;
      if (toolName !== serverName) {
        toolName = `${serverName}_${toolName}`;
      }
      toolset.tools[toolName] = {
        description: tool.description || "",
        parameters: jsonSchema(tool.inputSchema as JSONSchema7),
        execute: async (args) => {
          const resultPromise = (async () => {
            const result = await client.callTool({
              name: tool.name,
              arguments: args,
            });
            return JSON.stringify(result);
          })();
          if (config.onCallTool) {
            config.onCallTool(serverName, toolName, args, resultPromise);
          }
          return resultPromise;
        },
      };
    }
  }

  return toolset;
}

/**
 * Modifies tool parameters to remove all but the "enum" format constraint.
 * Gemini only supports "enum" format constraint on string fields.
 * https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output?authuser=1
 */
export function geminiToolModifier(
  serverName: string,
  toolName: string,
  tool: Tool
): Tool {
  if (!tool.inputSchema.properties) {
    return tool;
  }
  for (const [_, value] of Object.entries(tool.inputSchema.properties)) {
    const v = value as any;
    if (typeof v === "object" && v.type === "string" && v.format != "enum") {
      v.format = undefined;
    }
  }
  return tool;
}

/**
 * Modifies tool parameters to truncate descriptions to 1024 characters for OpenAI compatibility.
 * OpenAI has a limit on the length of descriptions in their function calling API.
 */
export function oaiToolModifier(
  serverName: string,
  toolName: string,
  tool: Tool
): Tool {
  if (tool.description?.length && tool.description.length > 1024) {
    tool.description = tool.description.slice(0, 1024);
  }
  return tool;
}

export function defaultToolModifier(modelId: string) {
  if (modelId.includes("gemini")) {
    return geminiToolModifier;
  }
  if (modelId.includes("gpt")) {
    return oaiToolModifier;
  }
  return undefined;
}
