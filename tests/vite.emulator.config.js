/* global process, Buffer */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { POST as bookingPost } from '../api/bookings.js';
import { GET as lineGet, POST as linePost } from '../api/line-group.js';
import { POST as webhookPost } from '../api/line-webhook.js';

if (process.env.VITE_USE_FIREBASE_EMULATORS !== 'true' || process.env.FIREBASE_PROJECT_ID !== 'demo-resort') {
  throw new Error('This Vite config is only for demo-resort emulator testing');
}

export default defineConfig({
  plugins: [react(), {
    name: 'demo-api',
    configureServer(server) {
      server.middlewares.use('/api', async (request, response, next) => {
        const handlers = {
          '/bookings': { POST: bookingPost },
          '/line-group': { GET: lineGet, POST: linePost },
          '/line-webhook': { POST: webhookPost },
        };
        const handler = handlers[request.url]?.[request.method];
        if (!handler) return next();
        try {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          const webRequest = new Request(`http://127.0.0.1/api${request.url}`, {
            method: request.method, headers: request.headers,
            ...(request.method !== 'GET' ? { body: Buffer.concat(chunks) } : {}),
          });
          const result = await handler(webRequest);
          response.statusCode = result.status;
          result.headers.forEach((value, key) => response.setHeader(key, value));
          response.end(await result.text());
        } catch (error) {
          server.config.logger.error(`Demo booking API failed: ${error.message}`);
          response.statusCode = 500;
          response.end('Demo booking API failed');
        }
      });
    },
  }],
});
