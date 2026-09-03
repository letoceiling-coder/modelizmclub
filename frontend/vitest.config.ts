import { defineConfig } from "vitest/config";
import path from "node:path";

// Kept separate from vite.config.ts on purpose: that file is wrapped by
// @lovable.dev/vite-tanstack-config, which pulls in the full Start/Nitro
// plugin set — none of which a unit test of a pure function needs.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
