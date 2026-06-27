import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@talentos/auth": new URL("./packages/auth/src", import.meta.url).pathname,
      "@talentos/db": new URL("./packages/db/src", import.meta.url).pathname
    }
  }
});
