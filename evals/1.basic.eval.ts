import { LanguageModelV1 } from "ai";
import { Factuality } from "autoevals";
import { Eval } from ".";
import basicTest from "../1.basic";
import { logger } from "../utils";

async function runEvaluation() {
  await Eval("Strawberry R Counter", {
    data: [
      {
        input: "How many R's are in the word strawberry?",
        expected: "There are 3 R's in the word strawberry.",
      },
    ],
    task: async (model: LanguageModelV1, input: string) => {
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
  });
}

runEvaluation().catch(console.error);
