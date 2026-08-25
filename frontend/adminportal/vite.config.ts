import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // 5173 is in the backend's CORS_ORIGINS allowlist. Changing this
    // port means adding the new one there too, or every call is blocked
    // by the browser before it reaches the API.
    port: 5173,
    // Fail rather than fall back. Vite quietly moving to 5174 puts the
    // app on an origin the backend's CORS_ORIGINS does not list, so
    // every API call is blocked by the browser and the cause is not
    // obvious from the error.
    strictPort: true,
  },
});
