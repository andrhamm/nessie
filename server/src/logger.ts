import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import pino from "pino";

const LOGS_DIR = resolve(import.meta.dir, "../logs");

function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}

function createFileLogger(): pino.Logger {
  if (isTest()) {
    return pino({ level: "silent" });
  }

  try {
    mkdirSync(LOGS_DIR, { recursive: true });
  } catch {
    // ignore
  }

  const date = new Date().toISOString().slice(0, 10);
  return pino(
    { level: "debug" },
    pino.destination({ dest: `${LOGS_DIR}/nessie-${date}.jsonl`, sync: false, mkdir: true }),
  );
}

const fileLogger = createFileLogger();

/**
 * Log message to console (human-readable) and file (JSON).
 */
export function log(msg: string, data?: Record<string, unknown>): void {
  if (isTest()) return;
  console.log(msg);
  fileLogger.info(data ?? {}, msg);
}

/**
 * Log error to console and file.
 */
export function logError(msg: string, data?: Record<string, unknown>): void {
  if (isTest()) return;
  console.error(msg);
  fileLogger.error(data ?? {}, msg);
}

/**
 * Raw text to console only (streaming output).
 */
export function logRaw(msg: string): void {
  if (isTest()) return;
  process.stdout.write(msg);
}

/**
 * Log completed stream to file (not console — already streamed).
 */
export function logStreamComplete(text: string, elapsedMs: number): void {
  if (isTest()) return;
  fileLogger.info(
    {
      component: "agent",
      stage: "stream_complete",
      elapsedMs,
      textLength: text.length,
      text: text.slice(0, 1000),
    },
    "stream complete",
  );
}

/**
 * Log structured agent event.
 * Console: formatted JSON. File: structured JSON line.
 */
export function logAgentEvent(
  stage: string,
  data: Record<string, unknown>,
  elapsedMs?: number,
): void {
  if (isTest()) return;
  const prefix = elapsedMs !== undefined ? `[Agent] ${elapsedMs}ms` : "[Agent]";
  console.log(`${prefix} ${stage}:`);
  console.log(JSON.stringify(data, null, 2));
  fileLogger.info({ component: "agent", stage, elapsedMs, ...data }, `agent:${stage}`);
}
