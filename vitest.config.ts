import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    // Use forks pool for better isolation — the default threads pool causes
    // cross-file mock contamination and slow vi.resetModules() under the full suite.
    pool: "forks",
    // Give dynamic-import-heavy tests enough headroom under the full suite.
    testTimeout: 15_000,
  },
  resolve: {
    alias: [
      { find: /^@talentos\/auth$/, replacement: resolve(root, "packages/auth/src/index.ts") },
      { find: /^@talentos\/auth\/(.+)$/, replacement: resolve(root, "packages/auth/src/$1") },
      { find: /^@talentos\/db$/, replacement: resolve(root, "packages/db/src/index.ts") },
      { find: /^@talentos\/db\/(.+)$/, replacement: resolve(root, "packages/db/src/$1") },
      // Mirrors apps/applicant/tsconfig.json's "@/*" -> "./*". Scoped to applicant only —
      // apps/admin has the same tsconfig pattern but no test currently imports through it.
      { find: /^@\/(.+)$/, replacement: resolve(root, "apps/applicant/$1") }
    ]
  }
});
