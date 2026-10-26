import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SERVER = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Keep the client on one origin in dev too, so cookies, sockets and the
    // voice token endpoint behave the same as they will in production.
    proxy: {
      '/api': { target: SERVER, changeOrigin: true },
      '/socket.io': { target: SERVER, ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
