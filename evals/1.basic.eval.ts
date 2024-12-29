import { type LanguageModelV1 } from "ai";
import { Factuality } from "autoevals";
import { Eval, type Evaluator } from "braintrust";
import basicTest from "../1.basic";
import { allModels } from "../providers";
import { logger } from "../utils";

function evalInputForModel(
  model: LanguageModelV1
): Evaluator<string, string, string> {
  return {
    data: [
      {
        input: "How many R's are in the word strawberry?",
        expected: "There are 3 R's in the word strawberry.",
      },
    ],
    task: async (input: string) => {
      const { result } = await basicTest({
        model,
        input,
        logger,
      });
      return result;
    },
    scores: [Factuality],
    trialCount: 5,
    maxConcurrency: 1,
    experimentName: model.modelId,
    update: true,
  };
}

allModels.forEach((model) => {
  Eval("basic prompting", evalInputForModel(model));
});
