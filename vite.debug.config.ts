/**
 * Local-only server for the 2D debug page: `npm run debug`, then open the printed address.
 * Serves content/ as static files so the page can read puzzles.json. Not used by the Reddit build.
 */
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/client',
  publicDir: '../../content',
  server: { port: 5199, open: '/debug.html', fs: { allow: ['../..'] } },
});
