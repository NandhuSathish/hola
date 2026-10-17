import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { SHARED_VERSION } from '@holla/shared';

const PORT = Number(process.env['PORT'] ?? 3000);
const isProduction = process.env['NODE_ENV'] === 'production';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');

const app = express();
const httpServer = createServer(app);

// Same origin in production, and Vite proxies to us in dev, so no CORS setup.
const io = new Server(httpServer);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    shared: SHARED_VERSION,
    uptime: Math.round(process.uptime()),
  });
});

// In production this one process also serves the built client. Any route that
// is not an API call falls through to index.html so deep links like /r/KPXJ work.
if (isProduction) {
  app.use(express.static(clientDist));
  // Express 5 dropped the bare '*' path. path-to-regexp v8 spells a catch-all
  // as a named wildcard, so deep links like /r/KPXJ reach the SPA. '/' is
  // already handled by express.static serving index.html.
  app.get('/*splat', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

io.on('connection', (socket) => {
  console.log(`[socket] connected ${socket.id}`);

  socket.emit('hello', { shared: SHARED_VERSION });

  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected ${socket.id} (${reason})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[holla] server on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
});
