import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import hoverGate from "./postcss-hover-gate";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  css: { postcss: { plugins: [hoverGate()] } },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 3001,
    strictPort: false,
    host: true,
  },
});
