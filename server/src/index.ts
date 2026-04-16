#!/usr/bin/env bun
import * as p from "@clack/prompts";
import { loadConfig } from "./config.ts";
import { createServer } from "./server.ts";

function printHelp(): void {
  console.log(`
Usage: myapp <command>

Commands:
  serve    Start the HTTP server
  help     Show this help message

Options:
  --help, -h    Show help
`);
}

function cmdServe(): void {
  const config = loadConfig();
  const server = createServer({ port: config.port });
  p.log.success(`Server listening on http://localhost:${server.port}`);
}

function main(args: string[]): void {
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  switch (command) {
    case "serve":
      cmdServe();
      break;
    default:
      p.log.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main(process.argv.slice(2));
