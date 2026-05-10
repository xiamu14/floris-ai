import chalk from "chalk";
import type { DebugLogger, DebugLoggerOptions } from "../../types/log.type";

export function createDebugLogger(options: DebugLoggerOptions): DebugLogger {
  return {
    log(groupName, step, message, payload) {
      if (!options.debug) {
        return;
      }

      console.log(formatLine(groupName, step, message));

      if (payload === undefined) {
        return;
      }

      console.log(formatPayload(payload));
    },
  };
}

function formatLine(groupName: string, step: string, message: string): string {
  return `${chalk.gray(`${formatTime(new Date())}`)}${chalk.cyan(`[${groupName}]`)}${chalk.magenta(`[${step}]`)} ${chalk.white(message)}`;
}

function formatTime(date: Date): string {
  return `${date.toLocaleTimeString("en-GB", { hour12: false })} ${date
    .getMilliseconds()
    .toString()
    .padStart(3, "0")}`;
}

function formatPayload(payload: unknown): string {
  if (typeof payload === "string") {
    return chalk.gray(payload);
  }

  return chalk.gray(JSON.stringify(payload, null, 2));
}
