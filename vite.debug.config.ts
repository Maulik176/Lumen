/**
 * Local-only server: `npm run debug`.
 *   /debug.html  the 2D viewer for content/puzzles.json
 *   /game.html   the real play screen, with the API routes it needs answered here by the
 *                same shared code the Reddit server uses (add ?day=12 for another island).
 *                A ranked Lock in (only sent by a page that asks for one) is remembered by
 *                day, so reloading shows the finished island; fetch('/api/forget') clears it.
 * Not used by the Reddit build.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import {
  toPostData,
  toPublicIsland,
  type CardResponse,
  type BoardResponse,
  type HeatResponse,
  type IslandResponse,
  type LockInResponse,
  type LockInResult,
  type PastResponse,
  type SkyResponse,
} from './src/shared/api';
import type { Placement } from './src/shared/types';
import { BIOMES } from './src/shared/config';
import {
  puzzleOfDaily,
  readDailyFile,
  type DailyIsland,
} from './src/shared/daily';
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
  const heroIsland = (day: number): DailyIsland | undefined => {
    const first = load().days[0];
    const hero: unknown = JSON.parse(
      readFileSync(join(import.meta.dirname, 'content', 'hero.json'), 'utf8')
    );
    if (first === undefined || typeof hero !== 'object' || hero === null)
      return undefined;
    const rows = 'rows' in hero ? hero.rows : undefined;
    if (
      !Array.isArray(rows) ||
      !rows.every((row): row is string => typeof row === 'string')
    )
      return undefined;
    return {
      ...first,
      day,
      biome: BIOMES[day - 900] ?? 'moss',
      name: 'Yellow Dusk',
      rows,
      inventory: { mirrors: 3, prisms: 1 },
      sourceColours: [],
      par: 3,
      solution: [],
    };
  };
  /** Lock ins remembered by day, standing in for Redis. */
  const solved = new Map<
    number,
    { result: LockInResult; placements: Placement[] }
  >();
  return {
    name: 'lumen-local-api',
    configureServer(server) {
      server.middlewares.use('/api/card', (request, response) => {
        const day = Number(
          new URL(request.url ?? '', 'http://localhost').searchParams.get(
            'day'
          ) ?? '1'
        );
        const island = load().days[day - 1];
        const result = solved.get(day)?.result;
        const body: CardResponse | { ok: false } =
          island === undefined
            ? { ok: false }
            : {
                ok: true,
                post: toPostData(island),
                skyCount: 140,
                nextInMs: 5 * 3_600_000 + 12 * 60_000,
                streak: result?.streak ?? 0,
                result:
                  result === undefined
                    ? null
                    : {
                        pieces: result.pieces,
                        par: result.par,
                        rank: result.rank,
                        streak: result.streak,
                      },
              };
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(body));
      });
      server.middlewares.use('/api/forget', (_request, response) => {
        solved.clear();
        response.end('{"ok":true}');
      });
      // Made-up test names, as in the sky stand-in. The player is 'you'.
      server.middlewares.use('/api/leaderboard', (request, response) => {
        const scope = new URL(
          request.url ?? '',
          'http://localhost'
        ).searchParams.get('scope');
        const names = Array.from({ length: 10 }, (_, i) => `test_${i + 1}`);
        const body: BoardResponse =
          scope === 'alltime'
            ? {
                ok: true,
                scope: 'alltime',
                top: names.map((username, i) => ({
                  rank: i + 1,
                  username,
                  snoovatar: '',
                  medals: 12 - i,
                })),
                me: { rank: 31, username: 'you', snoovatar: '', medals: 1 },
                total: 40,
              }
            : {
                ok: true,
                scope: 'day',
                top: names.map((username, i) => ({
                  rank: i === 9 ? null : i + 1,
                  username,
                  snoovatar: '',
                  pieces: 4 + Math.floor(i / 4),
                  timeMs: 41_000 + i * 9_000,
                })),
                me: {
                  rank: 23,
                  username: 'you',
                  snoovatar: '',
                  pieces: 5,
                  timeMs: 83_000,
                },
                total: 140,
              };
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(body));
      });
      // A made-up crowd: most players found par, a few wandered. A day solved here with a
      // ranked Lock in counts as tonight (no par answer); any other day as an earlier night.
      server.middlewares.use('/api/heatmap', (request, response) => {
        const day = Number(
          new URL(request.url ?? '', 'http://localhost').searchParams.get(
            'day'
          ) ?? '1'
        );
        const island = load().days[day - 1];
        let body: HeatResponse = { ok: false, reason: 'not-found' };
        if (island !== undefined) {
          const puzzle = puzzleOfDaily(island);
          const tiles = puzzle.terrain.map((ground, tile) =>
            ground === 'grass'
              ? (tile * 7919) % 13 < 2
                ? (tile % 5) + 1
                : 0
              : 0
          );
          for (const placement of island.solution)
            tiles[placement.y * puzzle.width + placement.x] = 30;
          body = {
            ok: true,
            day,
            tiles,
            solves: 140,
            parHits: 25,
            parSolution: solved.has(day) ? null : island.solution,
          };
        }
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(body));
      });
      server.middlewares.use('/api/past', (request, response) => {
        const before = Number(
          new URL(request.url ?? '', 'http://localhost').searchParams.get(
            'before'
          ) ?? '1'
        );
        const body: PastResponse = {
          ok: true,
          islands: load()
            .days.filter((island) => island.day < before)
            .reverse()
            .map((island) => ({
              day: island.day,
              name: island.name,
              weekday: island.weekday,
              biome: island.biome,
              par: island.par,
              medal: solved.get(island.day)?.result.medal ?? null,
            })),
        };
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(body));
      });
      server.middlewares.use('/api/island', (request, response) => {
        const day = Number(
          new URL(request.url ?? '', 'http://localhost').searchParams.get(
            'day'
          ) ?? '1'
        );
        // Days 900 to 904 are the hand-made hero island, one per biome (see scripts/hero.mjs).
        const island =
          day >= 900 && day < 900 + BIOMES.length
            ? heroIsland(day)
            : load().days[day - 1];
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
                  result: solved.get(day)?.result ?? null,
                  placements: solved.get(day)?.placements ?? null,
                  shared: false,
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
              else if (fields['ranked'] === true && !solved.has(island.day)) {
                const result: LockInResult = {
                  day: island.day,
                  pieces: score.pieces,
                  par: island.par,
                  medal: medalFor(score.pieces, island.par),
                  elapsedMs: 83_000,
                  ranked: true,
                  streak: 4,
                  style: 'paper',
                  percentile: 80,
                  rank: 3,
                  skyCount: 141,
                };
                solved.set(island.day, {
                  result,
                  placements: score.placements,
                });
                body = { ok: true, ...result };
              } else {
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
                  rank: 0,
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
