import { type LanguageModelV1 } from "ai";
import { Eval, type Evaluator } from "braintrust";
import toolsTest from "../2.tools";
import { allModels } from "../providers";
import { logger } from "../utils";

async function whatsMyIp(): Promise<string> {
  const response = await fetch("https://api.ipify.org");
  return (await response.text()).trim();
}

function contains(args: { input: string; output: string; expected: string }) {
  return {
    name: "contains",
    score: args.output.includes(args.expected) ? 1 : 0,
  };
}

function evalInputForModel(
  model: LanguageModelV1
): Evaluator<string, string, string> {
  return {
    data: async () => {
      const ip = await whatsMyIp();
      return [
        {
          input: "What's my IP address?",
          expected: ip,
        },
      ];
    },
    task: async (input: string) => {
      const { result } = await toolsTest({
        model,
        input,
        logger,
      });
      return result;
    },
    scores: [contains],
    trialCount: 5,
    maxConcurrency: 1,
    experimentName: model.modelId,
    update: true,
  };
}

allModels.forEach((model) => {
  Eval("basic tool use", evalInputForModel(model));
});
