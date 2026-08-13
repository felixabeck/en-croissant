/// <reference types="vitest/config" />
import { resolve } from "node:path";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import * as os from "node:os";

const isDebug = !!process.env.TAURI_ENV_DEBUG;
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        tanstackRouter({
            target: "react",
        }),
        react(),
        babel({
            presets: [reactCompilerPreset()],
        }),
    ],
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                  protocol: "ws",
                  host,
                  port: 1421,
              }
            : undefined,
        watch: {
            ignored: ["**/src-tauri/**"],
        },
    },
    build: {
        manifest: true,
        minify: isDebug ? false : "esbuild",
        sourcemap: isDebug ? "inline" : false,
        // Generated IPC bindings use bigint for Rust u64 values. ES2020 is the
        // minimum honest output contract for every supported WebView.
        target: "es2020",
        // The checked-in gzip graph budgets are the release gate; Vite's raw
        // per-file heuristic neither accounts for caching nor compressed transfer.
        chunkSizeWarningLimit: 1_300,
    },
    resolve: {
        alias: {
            "@": resolve(import.meta.dirname, "./src"),
        },
    },
    test: {
        environment: "jsdom",
        include: ["src/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.test.mjs"],
        exclude: ["**/node_modules/**", ".stryker-tmp/**", "e2e/**"],
        minWorkers: 1,
        maxWorkers: 4,
        coverage: {
            provider: "v8",
            reporter: ["text", "json-summary", "lcov"],
            all: true,
            include: ["src/**/*.ts", "src/**/*.tsx"],
            exclude: [
                "src/**/*.test.ts",
                "src/**/*.test.tsx",
                "src/**/*.spec.ts",
                "src/**/*.spec.tsx",
                "src/**/tests/**",
                "src/bindings/generated.ts",
                "src/routeTree.gen.ts",
                "src/vite-env.d.ts",
            ],
        },
    },
    define: {
        "import.meta.env.VITE_PLATFORM": JSON.stringify(os.platform()),
    },
});
