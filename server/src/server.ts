import { stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import type { RouteDeps } from "./speech/routes";
import {
  handleSpeechCreate,
  handleSpeechGet,
  handleSpeechInputAudio,
  handleSpeechResponseAudio,
} from "./speech/routes";

const startTime = Date.now();

const STATIC_DIR = resolve(import.meta.dir, "../public");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/**
 * Serve a static file from the public/ directory.
 * Returns null if the file doesn't exist or the extension is not allowed.
 */
async function serveStatic(pathname: string): Promise<Response | null> {
  // Default to index.html for root
  const filePath = pathname === "/" ? "/index.html" : pathname;

  // Prevent directory traversal
  if (filePath.includes("..")) {
    return null;
  }

  const ext = extname(filePath);
  const mimeType = MIME_TYPES[ext];
  if (!mimeType) {
    return null;
  }

  const fullPath = join(STATIC_DIR, filePath);
  const resolved = resolve(fullPath);

  // Ensure resolved path is within STATIC_DIR
  if (!resolved.startsWith(STATIC_DIR)) {
    return null;
  }

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  const file = Bun.file(resolved);
  return new Response(file, {
    headers: { "Content-Type": mimeType },
  });
}

// Regex patterns for speech API routes
const SPEECH_ID_PATTERN = /^\/v1\/speech\/([a-z0-9_]+)$/;
const SPEECH_INPUT_AUDIO_PATTERN = /^\/v1\/speech\/([a-z0-9_]+)\/input_audio$/;
const SPEECH_RESPONSE_AUDIO_PATTERN = /^\/v1\/speech\/([a-z0-9_]+)\/response_audio$/;

export interface ServerOptions {
  port: number;
  speechDeps?: RouteDeps;
}

export function createServer(options: ServerOptions) {
  const { speechDeps } = options;

  return Bun.serve({
    port: options.port,
    async fetch(req) {
      const url = new URL(req.url);

      // Health check
      if (url.pathname === "/health") {
        if (req.method !== "GET") {
          return Response.json({ error: "method not allowed" }, { status: 405 });
        }
        return Response.json({
          status: "ok",
          uptime: Math.floor((Date.now() - startTime) / 1000),
        });
      }

      // Speech API: POST /v1/speech
      if (url.pathname === "/v1/speech") {
        if (!speechDeps) {
          return Response.json({ error: "speech API not configured" }, { status: 503 });
        }
        return handleSpeechCreate(req, speechDeps);
      }

      // Speech API: GET /v1/speech/:id/input_audio
      const inputAudioMatch = url.pathname.match(SPEECH_INPUT_AUDIO_PATTERN);
      if (inputAudioMatch) {
        if (req.method !== "GET") {
          return Response.json({ error: "method not allowed" }, { status: 405 });
        }
        if (!speechDeps) {
          return Response.json({ error: "speech API not configured" }, { status: 503 });
        }
        const id = inputAudioMatch[1];
        if (!id) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        return handleSpeechInputAudio(id, speechDeps);
      }

      // Speech API: GET /v1/speech/:id/response_audio
      const responseAudioMatch = url.pathname.match(SPEECH_RESPONSE_AUDIO_PATTERN);
      if (responseAudioMatch) {
        if (req.method !== "GET") {
          return Response.json({ error: "method not allowed" }, { status: 405 });
        }
        if (!speechDeps) {
          return Response.json({ error: "speech API not configured" }, { status: 503 });
        }
        const id = responseAudioMatch[1];
        if (!id) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        return handleSpeechResponseAudio(id, speechDeps);
      }

      // Speech API: GET /v1/speech/:id
      const speechMatch = url.pathname.match(SPEECH_ID_PATTERN);
      if (speechMatch) {
        if (req.method !== "GET") {
          return Response.json({ error: "method not allowed" }, { status: 405 });
        }
        if (!speechDeps) {
          return Response.json({ error: "speech API not configured" }, { status: 503 });
        }
        const id = speechMatch[1];
        if (!id) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        return handleSpeechGet(id, speechDeps);
      }

      // Static file serving (GET only)
      if (req.method === "GET") {
        const staticResponse = await serveStatic(url.pathname);
        if (staticResponse) {
          return staticResponse;
        }
      }

      return Response.json({ error: "not found" }, { status: 404 });
    },
  });
}
