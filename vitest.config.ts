import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
}));
