import { LanguageModelV1 } from "ai";
import { LLMClassifierArgs, Score, ScorerWithPartial } from "autoevals";
import Table from "cli-table3";
import pMap from "p-map";
import { allModels } from "../providers";

interface Evaluator {
  data: { input: string; expected: string }[];
  task: (model: LanguageModelV1, input: string) => Promise<string>;
  scores: ScorerWithPartial<
    string,
    LLMClassifierArgs<{
      input: string;
      output: string;
      expected?: string;
    }>
  >[];
  trialCount: number;
  maxConcurrency?: number;
}

/*
 * Eval is a quick and dirty version of braintrust's Eval that doesn't require setting up their cloud thing.
 */
export async function Eval(name: string, config: Evaluator) {
  const results = await pMap(allModels, async (model) => {
    const trialResults = (await pMap(
      Array(config.trialCount).fill(null),
      async () => {
        const output = await config.task(model, config.data[0].input);
        return await pMap(
          config.scores,
          async (scorer) => {
            return await scorer({
              input: config.data[0].input,
              output,
              expected: config.data[0].expected,
            });
          },
          { concurrency: config.maxConcurrency }
        );
      },
      { concurrency: config.maxConcurrency }
    )) as Score[][];

    const averageScores = trialResults[0].map((_, index) => {
      const totalScore = trialResults.reduce(
        (sum, trial) => sum + (trial[index].score ?? 0),
        0
      );
      return totalScore / trialResults.length;
    });

    return {
      model: model.modelId,
      averageScores,
      scorerNames: trialResults[0].map((trial) => trial.name),
    };
  });

  const table = new Table({
    head: ["Model", ...results[0].scorerNames],
    style: { head: [], border: [] },
  });

  results.forEach(({ model, averageScores }) => {
    table.push([model, ...averageScores.map((score) => score.toFixed(3))]);
  });

  console.log(`\n${name} Results:`);
  console.log(table.toString());

  return results;
}
