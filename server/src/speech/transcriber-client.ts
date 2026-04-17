import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { z } from "zod";

/**
 * Abstraction over the speech-to-text transcription backend.
 * Implementations: SubprocessTranscriberClient (production), MockTranscriberClient (testing).
 */
export interface TranscriberClient {
  transcribe(pcmBytes: Uint8Array): Promise<string>;
}

/**
 * Zod schemas for the subprocess JSONL protocol.
 */
const ReadyMessageSchema = z.object({
  type: z.literal("ready"),
});

const TranscriptMessageSchema = z.object({
  type: z.literal("transcript"),
  id: z.string(),
  text: z.string(),
});

const ErrorMessageSchema = z.object({
  type: z.literal("error"),
  id: z.string(),
  message: z.string(),
});

const SubprocessMessageSchema = z.discriminatedUnion("type", [
  ReadyMessageSchema,
  TranscriptMessageSchema,
  ErrorMessageSchema,
]);

interface TranscribeRequest {
  type: "transcribe";
  id: string;
  pcm_base64: string;
}

/**
 * Transcriber that spawns `uv run python3 pipeline/src/transcriber.py` and communicates
 * via JSONL on stdin/stdout.
 *
 * Protocol (one request/response per invocation):
 *   stdin:  {"type":"transcribe","id":"<id>","pcm_base64":"<base64>"}\n
 *   stdout: {"type":"result","id":"<id>","transcript":"<text>"}\n
 *        or {"type":"error","id":"<id>","message":"<msg>"}\n
 */
export class SubprocessTranscriberClient implements TranscriberClient {
  private readonly projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async transcribe(pcmBytes: Uint8Array): Promise<string> {
    const id = randomBytes(8).toString("hex");
    const pcmBase64 = Buffer.from(pcmBytes).toString("base64");

    const request: TranscribeRequest = {
      type: "transcribe",
      id,
      pcm_base64: pcmBase64,
    };

    return new Promise<string>((resolve, reject) => {
      const pipelineDir = `${this.projectRoot}/pipeline`;
      const child = spawn("uv", ["run", "python3", "src/transcriber.py"], {
        cwd: pipelineDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", (err: Error) => {
        reject(new Error(`Failed to spawn transcriber: ${err.message}`));
      });

      child.on("close", (code: number | null) => {
        if (code !== 0) {
          const detail = stderr.trim() || `exit code ${String(code)}`;
          reject(new Error(`Transcriber process failed: ${detail}`));
          return;
        }

        // Parse all JSONL lines, skip "ready", find our response by id
        const lines = stdout.split("\n").filter((l) => l.trim().length > 0);

        if (lines.length === 0) {
          reject(new Error("Transcriber returned no output"));
          return;
        }

        for (const line of lines) {
          let json: unknown;
          try {
            json = JSON.parse(line);
          } catch {
            continue;
          }

          const result = SubprocessMessageSchema.safeParse(json);
          if (!result.success) continue;

          const parsed = result.data;

          if (parsed.type === "ready") continue;

          if (parsed.type === "error" && parsed.id === id) {
            reject(new Error(`Transcriber error: ${parsed.message}`));
            return;
          }

          if (parsed.type === "transcript" && parsed.id === id) {
            resolve(parsed.text);
            return;
          }
        }

        reject(new Error("Transcriber returned no matching response"));
      });

      // Send the request and close stdin to signal EOF
      child.stdin.write(`${JSON.stringify(request)}\n`);
      child.stdin.end();
    });
  }
}

/**
 * Mock transcriber for unit tests — always returns a fixed transcript.
 */
export class MockTranscriberClient implements TranscriberClient {
  private readonly fixedTranscript: string;

  constructor(fixedTranscript = "hello nessie") {
    this.fixedTranscript = fixedTranscript;
  }

  async transcribe(_pcmBytes: Uint8Array): Promise<string> {
    return this.fixedTranscript;
  }
}
