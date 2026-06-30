import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(appDir, "../../..");
export const OPS_RUNS_DIR = resolve(REPO_ROOT, ".ops/runs");

let envLoaded = false;

export type OpsConfig = {
  host: string;
  port: number;
  token: string;
  repoRoot: string;
};

export function loadDotEnv(envPath = resolve(REPO_ROOT, ".env")) {
  if (envLoaded || !existsSync(envPath)) {
    envLoaded = true;
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  envLoaded = true;
}

export function getOpsConfig(): OpsConfig {
  loadDotEnv();
  const port = Number(process.env.OPS_PORT ?? 3300);
  return {
    host: process.env.OPS_HOST ?? "127.0.0.1",
    port: Number.isFinite(port) ? port : 3300,
    token: process.env.OPS_TOKEN ?? "",
    repoRoot: REPO_ROOT
  };
}
