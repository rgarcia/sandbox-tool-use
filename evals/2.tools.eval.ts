import { LanguageModelV1 } from "ai";
import { Eval, Evaluator } from "braintrust";
import toolsTest from "../2.tools";
import { allModels } from "../providers";
import { logger } from "../utils";

async function whatsMyIp(): Promise<string> {
  const response = await fetch("https://api.ipify.org");
  return (await response.text()).trim();
}

const containsForModel = function (model: LanguageModelV1) {
  return (args: { input: string; output: string; expected: string }) => {
    return {
      name: `contains for ${model.modelId}`,
      score: args.output.includes(args.expected) ? 1 : 0,
    };
  };
};

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
    scores: [containsForModel(model)],
    trialCount: 5,
    maxConcurrency: 1,
    experimentName: model.modelId,
    update: true,
  };
}

allModels.forEach((model) => {
  Eval("basic tool use", evalInputForModel(model));
});
