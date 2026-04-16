#!/usr/bin/env bun
import * as p from "@clack/prompts";
import { createServer } from "./server.ts";

const DEFAULT_PORT = 3000;

function printHelp(): void {
  console.log(`
Usage: myapp <command>

Commands:
  serve    Start the HTTP server
  chat     Start an interactive chat with Nessie
  help     Show this help message

Options:
  --help, -h    Show help
`);
}

function cmdServe(): void {
  const port = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
  const server = createServer({ port });
  p.log.success(`Server listening on http://localhost:${server.port}`);
}

async function main(args: string[]): Promise<void> {
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  switch (command) {
    case "serve":
      cmdServe();
      break;
    case "chat": {
      const { runChat } = await import("./cli/chat");
      await runChat();
      break;
    }
    default:
      p.log.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main(process.argv.slice(2));
