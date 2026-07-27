import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const isReplit = process.env.REPL_ID !== undefined;
const isDev = process.env.NODE_ENV === "development";

export default defineConfig({
  plugins: [
    react(),
    ...(isReplit && isDev
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then((m) =>
            m.default()
          ),
          ...(isDev
            ? [
                await import("@replit/vite-plugin-cartographer").then((m) =>
                  m.cartographer()
                ),
                await import("@replit/vite-plugin-dev-banner").then((m) =>
                  m.devBanner()
                ),
              ]
            : []),
        ]
      : []),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      "react": path.resolve(import.meta.dirname, "node_modules", "react"),
      "react-dom": path.resolve(import.meta.dirname, "node_modules", "react-dom"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
