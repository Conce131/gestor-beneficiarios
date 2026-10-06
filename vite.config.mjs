import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/gestor-beneficiarios/" : "/",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
