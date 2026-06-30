import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
const examplePath = resolve(process.cwd(), ".env.example");
const token = randomBytes(32).toString("hex");

const base = existsSync(envPath)
  ? readFileSync(envPath, "utf8")
  : existsSync(examplePath)
    ? readFileSync(examplePath, "utf8")
    : "";

const next = upsertEnv(upsertEnv(upsertEnv(base, "OPS_HOST", "127.0.0.1"), "OPS_PORT", "3300"), "OPS_TOKEN", token);
writeFileSync(envPath, next.endsWith("\n") ? next : `${next}\n`, "utf8");

console.log(`OPS_TOKEN=${token}`);
console.log(`Updated ${envPath}`);

function upsertEnv(content: string, key: string, value: string) {
  const line = `${key}=${value}`;
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((entry) => entry.startsWith(`${key}=`));
  if (index >= 0) {
    lines[index] = line;
    return lines.join("\n");
  }
  const separator = content.trim().length > 0 ? "\n" : "";
  return `${content}${separator}${line}\n`;
}
