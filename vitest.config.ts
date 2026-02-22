import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "."),
        },
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
        include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
        },
    },
});
