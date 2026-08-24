import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    cssCodeSplit: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/scheduler")) {
            return "react";
          }
          if (id.includes("node_modules/react-router")) return "router";
          if (
            id.endsWith("category-products.json") ||
            id.endsWith("excel-catalog-rows.json") ||
            id.endsWith("category-brands.generated.json") ||
            id.endsWith("brand-official-tables.json")
          ) {
            return "catalog";
          }
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        timeout: 600000,
      },
    },
  },
});
