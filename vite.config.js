import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// https://vite.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: "./src/index.js",
      name: "vite-proxy-redirects-plugin",
      formats: ["es"],
      fileName: (format) => `index.${format === "es" ? "mjs" : "js"}`,
    },
    rollupOptions: {
      external: ["vite", "fs", "path", "node:fs", "node:path"],
    },
  },
  plugins: [
    dts({
      entryRoot: "src",
      insertTypesEntry: true,
    }),
  ],
});
