import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const include = ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // jsdom unit tests render client components that reference server actions; the real
      // "server-only" guard still applies to the Next.js build.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: ["e2e/**", "node_modules/**", "tests/db/**", "tests/live/**"],
    css: false,
    // Setting up jsdom was most of the run time, so only component tests (.tsx) get it. A .ts
    // test that needs a DOM says so with a `// @vitest-environment jsdom` comment.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: include.map((g) => g.replace("{ts,tsx}", "ts")),
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          include: include.map((g) => g.replace("{ts,tsx}", "tsx")),
          environment: "jsdom",
        },
      },
    ],
  },
});
