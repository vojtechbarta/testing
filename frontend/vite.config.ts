import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendTarget = "http://127.0.0.1:4000";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/health": { target: backendTarget, changeOrigin: true },
      "/products": { target: backendTarget, changeOrigin: true },
      "/cart": { target: backendTarget, changeOrigin: true },
      "/auth": { target: backendTarget, changeOrigin: true },
      "/checkout": { target: backendTarget, changeOrigin: true },
      "/orders": { target: backendTarget, changeOrigin: true },
      "/admin": { target: backendTarget, changeOrigin: true },
      "/faults": { target: backendTarget, changeOrigin: true },
      "/exchange-rates": { target: backendTarget, changeOrigin: true },
    },
  },
});
