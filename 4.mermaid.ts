import type { Span } from "@opentelemetry/api";
import { generateText } from "ai";
import { type Span as BraintrustSpan } from "braintrust";
import { readFileSync } from "fs";
import path from "path";
import prompts from "prompts";
import { z } from "zod";
import { google } from "./providers";
import { traced, tracer } from "./tracing";
import { type TestInput, type TestResult } from "./types";
import { logger } from "./utils";

/*
This is an experiment in using a system prompt that contains a mermaid diagram to guide the LLM's behavior in a multi-step interaction.
The LLM is given a set of tools relating to inbox management:
- a tool to get the next email from the user's inbox
- a tool to archive an email

The goal is to build an interactive loop that allows the user to manage their inbox.
*/

const mermaidDiagram = readFileSync(
  path.join(__dirname, "4.mermaid.mmd"),
  "utf-8"
);

const fakeInbox = [
  {
    id: "1",
    subject: "Hello",
    body: "Hello, how are you?",
    from: "John Doe",
    to: "Jane Doe",
    date: "2021-01-01",
  },
  {
    id: "2",
    subject: "Hello",
    body: "Hello, how are you?",
    from: "John Doe",
    to: "Jane Doe",
    date: "2021-01-02",
  },
  {
    id: "3",
    subject: "Hello",
    body: "Hello, how are you?",
    from: "John Doe",
    to: "Jane Doe",
  },
];

class Inbox {
  private cursor = 0;
  private archived: string[] = [];
  private skipped: string[] = [];
  getNextEmail() {
    const email = fakeInbox[this.cursor];
    if (!email) {
      return "No more emails in your inbox.";
    }
    this.cursor++;
    return email;
  }
  skipEmail(emailId: string) {
    this.skipped.push(emailId);
  }
  archiveEmail(emailId: string) {
    this.archived.push(emailId);
  }
}

export default async function mermaidTest({
  model,
  logger,
  system,
  input,
}: TestInput): Promise<TestResult> {
  return traced(
    { name: "mermaid-test", btTracedArgs: { type: "task", event: { input } } },
    async (otelSpan: Span, btSpan: BraintrustSpan) => {
      const inbox = new Inbox();
      let stepCount = 0;
      const res = await generateText({
        maxSteps: 10,
        model,
        system,
        prompt: input,
        experimental_telemetry: {
          isEnabled: true,
          recordInputs: true,
          recordOutputs: true,
          tracer,
        },
        tools: {
          getNextEmail: {
            description: "get the next email from the user's inbox",
            parameters: z.object({
              reasoning: z.string().describe("why you're calling this tool"),
              currentState: z
                .string()
                .describe(
                  "the name of the current state you are in in the flowchart"
                ),
            }),
            execute: async () => {
              return inbox.getNextEmail();
            },
          },
          archiveEmail: {
            description: "archive an email from the user's inbox",
            parameters: z.object({
              reasoning: z.string().describe("why you're calling this tool"),
              currentState: z
                .string()
                .describe(
                  "the name of the current state you are in in the flowchart"
                ),
              emailId: z.string().describe("the id of the email to archive"),
            }),
            execute: async ({ emailId }) => {
              inbox.archiveEmail(emailId);
            },
          },
          skipEmail: {
            description: "skip an email from the user's inbox",
            parameters: z.object({
              reasoning: z.string().describe("why you're calling this tool"),
              currentState: z
                .string()
                .describe(
                  "the name of the current state you are in in the flowchart"
                ),
              emailId: z.string().describe("the id of the email to skip"),
            }),
            execute: async ({ emailId }) => {
              inbox.skipEmail(emailId);
            },
          },
          askUser: {
            description:
              "use this tool to when you want to ask the user what they'd like to do",
            parameters: z.object({}),
            execute: async () => {
              const response = await prompts({
                type: "text",
                name: "action",
                message:
                  "What would you like to do with this email? (archive/skip)",
              });
              return response.action;
            },
          },
        },
        onStepFinish: (step) => {
          logger.info(
            {
              model: model.modelId,
              step: stepCount++,
              text: step.text,
              // toolCalls: step.toolCalls,
              toolResults: step.toolResults,
              finishReason: step.finishReason,
            },
            "mermaid generate result"
          );
        },
      });
      const result = {
        text: res.text,
        toolCalls: res.toolCalls,
        toolResults: res.toolResults,
        finishReason: res.finishReason,
      };
      const resultAsText = JSON.stringify(result, null, 2);
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
  mermaidTest({
    model: google("gemini-2.0-flash-001"),
    system: `
You are a helpful assistant that can help me go through the emails in my inbox.
Here is a flowchart showing the process for managing your inbox:
\`\`\`mermaid
${mermaidDiagram}
\`\`\`
Let's begin!
    `,
    input: "Help me go through the emails in my inbox.",
    logger,
  }).catch(console.error);
}
