import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxy = {
  target: "http://127.0.0.1:8000",
  changeOrigin: true,
};

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/auth": proxy,
      "/bugs": proxy,
      "/projects": proxy,
      "/comments": proxy,
      "/notifications": proxy,
    },
  },
});
