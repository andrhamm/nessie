import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

/**
 * Abstraction over the speech-to-text transcription backend.
 * Implementations: SubprocessTranscriberClient (production), MockTranscriberClient (testing).
 */
export interface TranscriberClient {
  transcribe(pcmBytes: Uint8Array): Promise<string>;
}

/**
 * JSONL message shapes for the subprocess protocol.
 */
interface TranscribeRequest {
  type: "transcribe";
  id: string;
  pcm_base64: string;
}

interface TranscribeResponse {
  type: "result";
  id: string;
  transcript: string;
}

interface TranscribeError {
  type: "error";
  id: string;
  message: string;
}

type SubprocessResponse = TranscribeResponse | TranscribeError;

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
      const child = spawn("uv", ["run", "python3", "pipeline/src/transcriber.py"], {
        cwd: this.projectRoot,
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

        // Parse the first complete JSONL line from stdout
        const line = stdout.split("\n").find((l) => l.trim().length > 0);
        if (!line) {
          reject(new Error("Transcriber returned no output"));
          return;
        }

        let parsed: SubprocessResponse;
        try {
          parsed = JSON.parse(line) as SubprocessResponse;
        } catch {
          reject(new Error(`Transcriber returned invalid JSON: ${line}`));
          return;
        }

        if (parsed.id !== id) {
          reject(new Error(`Transcriber response ID mismatch: expected ${id}, got ${parsed.id}`));
          return;
        }

        if (parsed.type === "error") {
          reject(new Error(`Transcriber error: ${parsed.message}`));
          return;
        }

        if (parsed.type === "result") {
          resolve(parsed.transcript);
          return;
        }

        reject(
          new Error(
            `Unexpected transcriber response type: ${String((parsed as SubprocessResponse).type)}`,
          ),
        );
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
