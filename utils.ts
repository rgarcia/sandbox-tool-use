import pino from "pino";
import { PinoPretty } from "pino-pretty";
const pretty = PinoPretty({ colorize: true, translateTime: "HH:MM:ss.l Z" });

/*
 * colorful logger that supports logging JSON objects
 */
export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
  },
  pretty
);

/*
 * timing wrapper that returns a humanized timing string
 */
export async function withTiming<T>(
  fn: () => Promise<T>
): Promise<[T, string]> {
  const start = performance.now();
  const result = await fn();
  const elapsed = performance.now() - start;

  const timing =
    elapsed < 1000
      ? `${Math.round(elapsed)}ms`
      : `${(elapsed / 1000).toFixed(3)}s`;

  return [result, timing];
}
