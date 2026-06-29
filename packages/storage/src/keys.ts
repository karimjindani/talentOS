import { randomUUID } from "node:crypto";

/** Make a user-supplied filename safe for use in an object key. */
export function sanitizeFilename(name: string): string {
  const safe = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safe || "file";
}

export type BuildObjectKeyInput = {
  tenantId: string;
  category: string;
  filename: string;
};

/** Tenant-namespaced, collision-resistant object key: tenant/{tenantId}/{category}/{uuid}-{safeName}. */
export function buildObjectKey({ tenantId, category, filename }: BuildObjectKeyInput): string {
  return `tenant/${tenantId}/${sanitizeFilename(category)}/${randomUUID()}-${sanitizeFilename(filename)}`;
}
