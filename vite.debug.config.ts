/**
 * Local-only server: `npm run debug`.
 *   /debug.html  the 2D viewer for content/puzzles.json
 *   /game.html   the real play screen, with the two API routes it needs answered here by the
 *                same shared code the Reddit server uses (add ?day=12 for another island)
 * Not used by the Reddit build.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import {
  toPublicIsland,
  type IslandResponse,
  type LockInResponse,
  type SkyResponse,
} from './src/shared/api';
import { puzzleOfDaily, readDailyFile } from './src/shared/daily';
import { medalFor, scoreSubmission } from './src/shared/validate';

function localApi(): Plugin {
  const load = () =>
    readDailyFile(
      JSON.parse(
        readFileSync(
          join(import.meta.dirname, 'content', 'puzzles.json'),
          'utf8'
        )
      )
    );
  return {
    name: 'lumen-local-api',
    configureServer(server) {
      server.middlewares.use('/api/island', (request, response) => {
        const day = Number(
          new URL(request.url ?? '', 'http://localhost').searchParams.get(
            'day'
          ) ?? '1'
        );
        const island = load().days[day - 1];
        const body: IslandResponse =
          island === undefined
            ? { ok: false, reason: 'not-found' }
            : {
                ok: true,
                island: toPublicIsland(island),
                me: {
                  loggedIn: false,
                  username: null,
                  streak: 0,
                  style: 'plain',
                  tutorialDone: false,
                  result: null,
                },
                rankedOpen: false,
                skyCount: 140,
              };
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(body));
      });
      // A stand-in sky for looking at the rendering locally: made-up test names, never shipped.
      server.middlewares.use('/api/sky', (_request, response) => {
        const styles = [
          'plain',
          'plain',
          'paper',
          'star',
          'koi',
          'comet',
        ] as const;
        const body: SkyResponse = {
          ok: true,
          day: 1,
          count: 140,
          lanterns: Array.from({ length: 140 }, (_, i) => ({
            u: `test_${i}`,
            s: styles[i % styles.length] ?? 'plain',
            a: '',
          })),
        };
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(body));
      });
      server.middlewares.use('/api/start', (_request, response) =>
        response.end('{"ok":true}')
      );
      server.middlewares.use('/api/tutorial-done', (_request, response) =>
        response.end('{"ok":true}')
      );
      server.middlewares.use('/api/lock-in', (request, response) => {
        let text = '';
        request.on('data', (chunk: Buffer) => {
          text += chunk.toString();
        });
        request.on('end', () => {
          let body: LockInResponse = { ok: false, reason: 'bad-request' };
          try {
            const parsed: unknown = JSON.parse(text);
            const fields: Record<string, unknown> =
              typeof parsed === 'object' && parsed !== null
                ? { ...parsed }
                : {};
            const island = load().days[Number(fields['day']) - 1];
            if (island === undefined) {
              body = { ok: false, reason: 'not-found' };
            } else {
              const score = scoreSubmission(
                puzzleOfDaily(island),
                fields['placements']
              );
              if (!score.ok) body = { ok: false, reason: score.problem };
              else if (!score.solved)
                body = { ok: false, reason: 'not-solved' };
              else {
                body = {
                  ok: true,
                  day: island.day,
                  pieces: score.pieces,
                  par: island.par,
                  medal: medalFor(score.pieces, island.par),
                  elapsedMs: 0,
                  ranked: false,
                  streak: 0,
                  style: 'plain',
                  percentile: 0,
                  skyCount: 140,
                };
              }
            }
          } catch {
            body = { ok: false, reason: 'bad-request' };
          }
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify(body));
        });
      });
    },
  };
}

export default defineConfig({
  root: 'src/client',
  publicDir: '../../content',
  plugins: [localApi()],
  server: { port: 5199, open: '/debug.html', fs: { allow: ['../..'] } },
});
