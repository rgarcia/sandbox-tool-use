import pino from "pino";
import { PrettyOptions } from "pino-pretty";

/*
 * colorful logger that supports logging JSON objects
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss.l Z",
    } as PrettyOptions,
  },
});

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
