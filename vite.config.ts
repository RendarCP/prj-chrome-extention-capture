import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import fs from "fs";

// manifest.json을 dist 폴더로 복사하는 함수
function copyManifest() {
  return {
    name: "copy-manifest",
    closeBundle() {
      fs.copyFileSync(
        resolve(__dirname, "public/manifest.json"),
        resolve(__dirname, "dist/manifest.json")
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), copyManifest()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        editor: resolve(__dirname, "editor.html"),
        contentScript: resolve(__dirname, "src/contentScript.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === "contentScript"
            ? "contentScript.js"
            : "[name].[hash].js";
        },
      },
    },
    watch: {
      include: "src/**",
      exclude: "node_modules/**",
    },
  },
  server: {
    port: 3000,
    hmr: {
      port: 3001,
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
