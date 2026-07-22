#!/usr/bin/env node

import { spawn } from "node:child_process";

const target = process.argv[2];

const commandSets = {
  "web-api": [
    { name: "api", cmd: "pnpm", args: ["dev:api"] },
    { name: "web", cmd: "pnpm", args: ["dev:web"] },
  ],
  all: [
    { name: "api", cmd: "pnpm", args: ["dev:api"] },
    { name: "web", cmd: "pnpm", args: ["dev:web"] },
    { name: "app", cmd: "pnpm", args: ["dev:mobile"] },
  ],
};

const commands = commandSets[target];

if (!commands) {
  console.error('Uso: node scripts/run-dev-stack.mjs [all|web-api]');
  process.exit(1);
}

const children = new Set();
let shuttingDown = false;

function prefixStream(stream, label, writer) {
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      writer(`[${label}] ${line}\n`);
    }
  });

  stream.on("end", () => {
    if (buffer) {
      writer(`[${label}] ${buffer}\n`);
      buffer = "";
    }
  });
}

function shutdown(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const command of commands) {
  const child = spawn(command.cmd, command.args, {
    stdio: ["inherit", "pipe", "pipe"],
    shell: process.platform === "win32",
    env: { ...process.env },
  });

  children.add(child);
  prefixStream(child.stdout, command.name, (line) => process.stdout.write(line));
  prefixStream(child.stderr, command.name, (line) => process.stderr.write(line));

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (!shuttingDown) {
      shutdown();

      if (signal) {
        console.error(`[${command.name}] finalizado por sinal ${signal}`);
        process.exit(1);
      }

      process.exit(code ?? 1);
    }

    if (children.size === 0) {
      process.exit(code ?? 0);
    }
  });

  child.on("error", (error) => {
    console.error(`[${command.name}] erro ao iniciar: ${error.message}`);
    shutdown();
    process.exit(1);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
