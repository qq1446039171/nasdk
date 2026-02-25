import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const repoBase = process.env.GITHUB_PAGES_BASE || "./";

export default defineConfig({
  base: repoBase,
  plugins: [vue()],
  server: {
    port: 5173
  }
});
