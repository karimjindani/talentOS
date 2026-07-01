import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { readOpsSettings, writeOpsSettings } from "./settings";

describe("ops local settings", () => {
  it("defaults 2FA to off when no config file exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "talentos-ops-"));
    try {
      await expect(readOpsSettings(join(dir, "config.json"))).resolves.toEqual({ ops2faEnabled: false });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("persists the 2FA toggle", async () => {
    const dir = await mkdtemp(join(tmpdir(), "talentos-ops-"));
    const configPath = join(dir, "config.json");
    try {
      await writeOpsSettings({ ops2faEnabled: true }, configPath);
      await expect(readOpsSettings(configPath)).resolves.toEqual({ ops2faEnabled: true });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
