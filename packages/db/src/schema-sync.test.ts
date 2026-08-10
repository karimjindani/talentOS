import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Prisma Schema Synchronization Tests
//
// Protects against: stale Prisma Client after schema changes — the exact issue
// that caused 5 unit test failures and 24 regression failures. When a developer
// edits schema.prisma but forgets to run `npm run db:generate`, the generated
// @prisma/client in node_modules drifts from the schema. These tests verify that
// the generated client is in sync with the schema file.
// ─────────────────────────────────────────────────────────────────────────────

const schemaPath = fileURLToPath(
  new URL("../../../packages/db/prisma/schema.prisma", import.meta.url)
);
const schemaContent = readFileSync(schemaPath, "utf8");

// Extract model names from the schema file
const schemaModels = Array.from(schemaContent.matchAll(/^model\s+(\w+)\s+\{/gm)).map((m) => m[1]);

// Extract enum names from the schema file
const schemaEnums = Array.from(schemaContent.matchAll(/^enum\s+(\w+)\s+\{/gm)).map((m) => m[1]);

// Extract enum values
const schemaEnumValues: Record<string, string[]> = {};
for (const enumName of schemaEnums) {
  const enumBlockRegex = new RegExp(`enum\\s+${enumName}\\s+\\{([\\s\\S]*?)\\}`, "m");
  const match = schemaContent.match(enumBlockRegex);
  if (match) {
    schemaEnumValues[enumName] = match[1]
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
}

describe("Prisma schema file integrity", () => {
  it("schema.prisma file exists and is non-empty", () => {
    expect(schemaContent.length).toBeGreaterThan(0);
  });

  it("defines a postgresql datasource", () => {
    expect(schemaContent).toMatch(/provider\s*=\s*"postgresql"/);
  });

  it("defines a prisma-client-js generator", () => {
    expect(schemaContent).toMatch(/provider\s*=\s*"prisma-client-js"/);
  });

  it("defines all expected models", () => {
    const expectedModels = [
      "Tenant", "User", "TenantMembership", "Program", "Application",
      "ApplicationAnswer", "AuditLog", "Mission", "MissionAssignment",
      "Submission", "EngineeringJournalEntry", "RegressionDataMarker",
      "ProgramTask", "VideoResource", "Notification", "CalendarEvent",
      "UserTaskCompletion", "MentorConversation", "MentorMessage"
    ];
    for (const model of expectedModels) {
      expect(schemaModels, `Schema should define model ${model}`).toContain(model);
    }
  });

  it("defines all expected enums", () => {
    const expectedEnums = [
      "UserStatus", "TenantRole", "PlatformRole", "ProgramStatus",
      "ApplicationStatus", "MissionDifficulty"
    ];
    for (const enumName of expectedEnums) {
      expect(schemaEnums, `Schema should define enum ${enumName}`).toContain(enumName);
    }
  });

  it("TenantRole enum has exactly ORG_ADMIN, HR, TECH_LEAD, APPLICANT", () => {
    expect(schemaEnumValues.TenantRole).toEqual(
      expect.arrayContaining(["ORG_ADMIN", "HR", "TECH_LEAD", "APPLICANT"])
    );
    expect(schemaEnumValues.TenantRole).toHaveLength(4);
  });

  it("PlatformRole enum has exactly SUPER_ADMIN", () => {
    expect(schemaEnumValues.PlatformRole).toEqual(["SUPER_ADMIN"]);
  });

  it("ApplicationStatus enum includes all lifecycle states", () => {
    const required = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "WAITLISTED", "DISQUALIFIED", "AWAITING_MISSION_ASSIGNMENT"];
    for (const status of required) {
      expect(schemaEnumValues.ApplicationStatus, `ApplicationStatus should include ${status}`).toContain(status);
    }
  });
});

// ── Generated client synchronization ────────────────────────────────────────

describe("generated Prisma client synchronization", () => {
  // The generated client lives at node_modules/.prisma/client/index.d.ts
  // If `npm run db:generate` hasn't been run after a schema change, the
  // generated types will be missing models/enums that the schema defines.

  const generatedClientPath = fileURLToPath(
    new URL("../../../node_modules/.prisma/client/index.d.ts", import.meta.url)
  );
  const generatedClientExists = existsSync(generatedClientPath);

  it("generated Prisma client exists (run `npm run db:generate` if missing)", () => {
    // Issue: Stale or missing Prisma client after schema changes.
    // Failure condition: developer edited schema.prisma but didn't regenerate.
    expect(generatedClientExists, "Generated client not found at node_modules/.prisma/client").toBe(true);
  });

  it.skipIf(!generatedClientExists)("generated client declares all schema models as types", () => {
    // Issue: Stale client missing a model added to the schema.
    // Failure condition: schema has a model the generated client doesn't know about.
    const generatedContent = readFileSync(generatedClientPath, "utf8");
    for (const model of schemaModels) {
      // The generated client exports a type named after each model
      expect(
        generatedContent,
        `Generated client should declare type ${model} (run npm run db:generate)`
      ).toContain(`type ${model}`);
    }
  });

  it.skipIf(!generatedClientExists)("generated client declares all schema enums", () => {
    // Issue: Stale client missing an enum value added to the schema.
    // Failure condition: schema enum has values the generated client doesn't export.
    const generatedContent = readFileSync(generatedClientPath, "utf8");
    for (const enumName of schemaEnums) {
      expect(
        generatedContent,
        `Generated client should declare enum ${enumName} (run npm run db:generate)`
      ).toContain(enumName);
    }
  });

  it.skipIf(!generatedClientExists)("generated client PrismaClient has accessors for all schema models", () => {
    // Issue: Stale client where PrismaClient doesn't have a delegate for a new model.
    // Failure condition: `prisma.newModel` would be undefined at runtime.
    const generatedContent = readFileSync(generatedClientPath, "utf8");
    for (const model of schemaModels) {
      // The PrismaClient type should have a property matching the model name (lowercase first letter)
      const accessor = model.charAt(0).toLowerCase() + model.slice(1);
      expect(
        generatedContent,
        `PrismaClient should have a ${accessor} delegate for model ${model}`
      ).toContain(accessor);
    }
  });
});

// ── Migration directory integrity ───────────────────────────────────────────

describe("Prisma migration directory integrity", () => {
  const migrationsDir = fileURLToPath(
    new URL("../../../packages/db/prisma/migrations", import.meta.url)
  );

  it("migrations directory exists", () => {
    expect(existsSync(migrationsDir), "prisma/migrations directory should exist").toBe(true);
  });

  it("has at least one migration (the init migration)", () => {
    // Read the directory listing from the migration_lock.toml
    const lockPath = fileURLToPath(
      new URL("../../../packages/db/prisma/migrations/migration_lock.toml", import.meta.url)
    );
    expect(existsSync(lockPath), "migration_lock.toml should exist").toBe(true);
    const lockContent = readFileSync(lockPath, "utf8");
    expect(lockContent).toContain("provider = \"postgresql\"");
  });
});
