import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { OPS_CONFIG_FILE } from "./config";

export type OpsLocalSettings = {
  ops2faEnabled: boolean;
};

const DEFAULT_SETTINGS: OpsLocalSettings = {
  ops2faEnabled: false
};

export async function readOpsSettings(configPath = OPS_CONFIG_FILE): Promise<OpsLocalSettings> {
  try {
    const content = await readFile(configPath, "utf8");
    const parsed = JSON.parse(content) as Partial<OpsLocalSettings>;
    return {
      ops2faEnabled: parsed.ops2faEnabled === true
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeOpsSettings(settings: OpsLocalSettings, configPath = OPS_CONFIG_FILE) {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}
