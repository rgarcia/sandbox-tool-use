# Browser / CU / MCP tool use exploration

A handful of explorations into using LLMs in combination with browsers, computer use, and model context protocol servers.

Some guiding principles:

1. Take the perspective of someone trying to build out a simple workflow that utilizes tools like browsers and computer use.
1. Keep it simple--no agent frameworks etc. Retain control and visibility into the underlying API calls made to the LLM.
1. Use Vercel's AI SDK (a thin wrapper around the LLM APIs themselves) so that we can easily test out many providers (see [./providers.ts](providers.ts)).
1. Traces and evals for everything. I'm using [braintrust]() for this.

## Running it

Each exploration below has a standalone file that you can run, e.g.

```
bun run 1.basic.ts
```

There is also a corresponding braintrust eval file that does a scaled up version of the standalone file, testing it out with multiple models and multiple attempts with each model, and outputting a percent score for how often it got the task "right."

```
pnpx braintrust eval --no-progress-bars evals/1.basic.eval.ts
```

If you're testing out a new eval and don't want results sent to braintrust, you can add the `--no-send-logs` argument to the above.

## Explorations

- [1.basic.ts](./1.basic.ts) (and [evals/1.basic.eval.ts](./evals/1.basic.eval.ts)). Just a simple prompt and response.

  - Observations: Only gemini-2.0 and gpt-4o can count the number of R's in the word "strawberry" :)

- [2.tools.ts](./2.tools.ts). Basic tool use. Give the LLM the built-in `fetch` function as a tool. Ask it to figure out your IP address. It should figure out that it should call `fetch` on something like `"https://api.ipify.org` to get it.

  - Observations: Every model tested nails this except (strangely) `llama3-groq-8b-8192-tool-use-preview`.

- [3.mcptools.ts](3.tools.ts). Use Anthropic's [model context protocol](https://modelcontextprotocol.io/) to spin up the same `fetch` tool but as an MCP server. Had to write some code to convert MCP clients into tools (see [./src/index.ts](./src/index.ts))
  - Observations
    - Spinning up MCP servers takes time since the default way to run them is as a separate process launched by `npx` or `uvx`. Just for the fetch tool it's about 2.6s. Someone should solve the cold start problem for these...
    - The models struggle with the slightly different MCP server `fetch` tool definition! With the same prompt as in [2.tool.ts](./2.tool.ts), both Claude and OpenAI more often than not **fail** to generate a tool call to `fetch`. Interesting and somewhat disheartening to see this sensitivity to tool definition. Wasn't expecting to see the problem of tool selection for something so simple.
    - Gemini pretty consistently selects the fetch tool and uses it, at least much more often than the other models.
