# Browser / CU / MCP tool use exploration

A handful of explorations into using LLMs in combination with browsers, computer use, and model context protocol servers.

Some guiding principles:

1. Take the perspective of someone trying to build out a simple automation that utilizes tools like browsers and computer use.
1. Keep it simple--no agent frameworks etc. Retain control and visibility into the underlying API calls made to the LLM.
1. Use Vercel's AI SDK (a thin wrapper around the LLM APIs themselves) so that we can easily test out many providers (see [./providers.ts](providers.ts)).
1. Measure response times of the LLM API calls and tool calls.

## Explorations

- [1.basic.ts](./1.basic.ts). Just a simple prompt and response.

- [2.tools.ts](./2.tools.ts). Basic tool use. Give the LLM the built-in `fetch` function as a tool. Ask it to figure out your IP address. It should figure out that it should call `fetch` on something like `"https://api.ipify.org` to get it.

  - Observations: Claude models are pretty slow relative to OpenAI. Sonnet and Haiku both take 2-3s to respond, whereas 4o and 4o-mini were 900 and 700ms respectively. Gemini models were about 1s.

- [3.mcptools.ts](3.tools.ts). Use Anthropic's [model context protocol](https://modelcontextprotocol.io/) to spin up the same `fetch` tool but as an MCP server. Had to write some code to convert MCP clients into tools (see [./src/index.ts](./src/index.ts))
  - Observations
    - Spinning up MCP servers takes time since the default way to run them is as a separate process launched by `npx` or `uvx`. Just for the fetch tool it's about 2.6s. Someone should solve the cold start problem for these...
    - The models struggle with the slightly different MCP server `fetch` tool definition! With the same prompt as in [2.tool.ts](./2.tool.ts), both Claude and OpenAI more often than not **fail** to generate a tool call to `fetch`. Interesting and somewhat disheartening to see this sensitivity to tool definition. Wasn't expecting to see the problem of tool selection for something so simple.
    - Gemini pretty consistently selects the fetch tool and uses it, at least much more often than the other models.
