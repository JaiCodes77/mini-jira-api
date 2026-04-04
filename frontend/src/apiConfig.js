/** API origin. In dev, default is "" so requests stay on the Vite dev server and the proxy forwards to FastAPI (avoids CORS). Set VITE_API_BASE_URL to override. */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "" : "http://127.0.0.1:8000");
