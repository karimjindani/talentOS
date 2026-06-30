import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"]
  },
  resolve: {
    alias: [
      { find: /^@talentos\/auth$/, replacement: resolve(root, "packages/auth/src/index.ts") },
      { find: /^@talentos\/auth\/(.+)$/, replacement: resolve(root, "packages/auth/src/$1") },
      { find: /^@talentos\/db$/, replacement: resolve(root, "packages/db/src/index.ts") },
      { find: /^@talentos\/db\/(.+)$/, replacement: resolve(root, "packages/db/src/$1") }
    ]
  }
});
