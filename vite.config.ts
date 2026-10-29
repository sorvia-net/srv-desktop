import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)), "@shared": fileURLToPath(new URL("./shared", import.meta.url)) } },
  server: { port: 5199, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true, target: "chrome140", chunkSizeWarningLimit: 1500 },
});
