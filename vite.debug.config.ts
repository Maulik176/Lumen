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
  type OthersResponse,
  type IslandResponse,
  type LockInResponse,
  type LockInResult,
  type PastResponse,
  type SkyResponse,
} from './src/shared/api';
import type { Placement } from './src/shared/types';
import { BIOMES, COMMUNITY } from './src/shared/config';
import { fallbackName, nameFiltered } from './src/shared/community';
import {
  puzzleOfDaily,
  readDailyFile,
  type DailyIsland,
} from './src/shared/daily';
import {
  medalFor,
  scoreSubmission,
  validatePlacements,
} from './src/shared/validate';

import { readDraft } from './src/shared/builder';
import { checkIsland, dailyHashes } from './src/server/core/check';
import {
  checkKey,
  draftPuzzleText,
  nameProblem,
  type DifficultyLabel,
  type IslandDraft,
} from './src/shared/builder';
import { puzzleFromText } from './src/shared/puzzle-text';
import { trace } from './src/shared/trace';

/** Reads a request's JSON body, or {} when there is none. */
function readBody(
  request: import('node:http').IncomingMessage
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let text = '';
    request.on('data', (chunk: Buffer) => {
      text += chunk.toString();
    });
    request.on('end', () => {
      try {
        const value: unknown = JSON.parse(text);
        resolve(
          typeof value === 'object' && value !== null ? { ...value } : {}
        );
      } catch {
        resolve({});
      }
    });
  });
}

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
  /** Unfinished boards by day. */
  const progress = new Map<number, Placement[]>();
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
                night: day === 2 ? 'past' : 'tonight',
                tonightPost: day === 2 ? 't3_local' : null,
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
      server.middlewares.use('/api/progress', (request, response) => {
        let text = '';
        request.on('data', (chunk: Buffer) => {
          text += chunk.toString();
        });
        request.on('end', () => {
          try {
            const parsed: unknown = JSON.parse(text);
            const fields: Record<string, unknown> =
              typeof parsed === 'object' && parsed !== null
                ? { ...parsed }
                : {};
            const island = load().days[Number(fields['day']) - 1];
            const check =
              island === undefined
                ? undefined
                : validatePlacements(
                    puzzleOfDaily(island),
                    fields['placements']
                  );
            if (island !== undefined && check?.ok === true)
              progress.set(island.day, check.placements);
          } catch {
            // Nothing saved.
          }
          response.end('{"ok":true}');
        });
      });
      server.middlewares.use('/api/forget', (_request, response) => {
        solved.clear();
        progress.clear();
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
      // Made-up islands for "See others' islands": the first three at par, the rest with one
      // extra mirror on a spare grass tile (the fifth with no stored pieces). A day solved here with a ranked Lock in counts as
      // tonight (with the player's own island, no par answer); any other day as an earlier night.
      server.middlewares.use('/api/others', (request, response) => {
        const day = Number(
          new URL(request.url ?? '', 'http://localhost').searchParams.get(
            'day'
          ) ?? '1'
        );
        const island = load().days[day - 1];
        let body: OthersResponse = { ok: false, reason: 'not-found' };
        if (island !== undefined) {
          const puzzle = puzzleOfDaily(island);
          const used = new Set(
            island.solution.map((p) => p.y * puzzle.width + p.x)
          );
          const spare = puzzle.terrain.flatMap((ground, tile) =>
            ground === 'grass' &&
            !used.has(tile) &&
            !puzzle.fixedMirrors.some(
              (m) => m.y * puzzle.width + m.x === tile
            ) &&
            !puzzle.sources.some((m) => m.y * puzzle.width + m.x === tile) &&
            !puzzle.lanterns.some((m) => m.y * puzzle.width + m.x === tile)
              ? [tile]
              : []
          );
          const top = Array.from({ length: 10 }, (_, i) => {
            const tile = spare[(i * 7) % Math.max(1, spare.length)];
            const extra: Placement[] =
              i < 3 || tile === undefined
                ? []
                : [
                    {
                      x: tile % puzzle.width,
                      y: Math.floor(tile / puzzle.width),
                      piece: {
                        kind: 'mirror',
                        orientation: i % 2 === 0 ? 'slash' : 'backslash',
                      },
                    },
                  ];
            return {
              rank: i + 1,
              username: `test_${i + 1}`,
              snoovatar: '',
              pieces: island.par + extra.length,
              timeMs: 41_000 + i * 9_000,
              // The fifth stands for a solve locked in before pieces were stored.
              placements: i === 4 ? null : [...island.solution, ...extra],
            };
          });
          const mine = solved.get(day);
          body = {
            ok: true,
            day,
            top,
            me:
              mine === undefined
                ? null
                : {
                    rank: 23,
                    username: 'you',
                    snoovatar: '',
                    pieces: mine.result.pieces,
                    timeMs: mine.result.elapsedMs,
                    placements: mine.placements,
                  },
            solves: 140,
            parHits: 25,
            parSolution: mine === undefined ? island.solution : null,
            creator: null,
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
              // Seeded so the map can be looked at: a medal on some days, a made-up crowd on all.
              medal:
                solved.get(island.day)?.result.medal ??
                (island.day % 3 === 0
                  ? 'lamplighter'
                  : island.day % 4 === 0
                    ? 'glow'
                    : null),
              rows: island.rows,
              solves: (island.day * 137) % 420,
            })),
        };
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(body));
      });
      server.middlewares.use('/api/island', (request, response) => {
        const asked = new URL(request.url ?? '', 'http://localhost')
          .searchParams;
        const day = Number(asked.get('day') ?? '1');
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
                  sharedComment: null,
                  skyNoteSeen: false,
                  rulesSeen: [],
                  progress: solved.has(day)
                    ? null
                    : (progress.get(day) ?? null),
                },
                rankedOpen: false,
                skyCount: 140,
                night: asked.get('night') === 'past' ? 'past' : 'tonight',
                tonightPost: null,
                sharedUrl: null,
                ...(asked.get('styles') === '1' ? { stylePreview: true } : {}),
                ...(asked.get('trailer') === '1'
                  ? { trailer: { solution: island.solution } }
                  : {}),
              };
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(body));
      });
      // A stand-in sky for looking at the rendering locally: made-up test names, never shipped.
      // Made-up test names. Day 6 is a quiet night (4 lanterns) so that last night's can be
      // seen behind it; every other night has 140.
      server.middlewares.use('/api/sky', (request, response) => {
        const day = Number(
          new URL(request.url ?? '', 'http://localhost').searchParams.get(
            'day'
          ) ?? '1'
        );
        const styles = [
          'plain',
          'plain',
          'paper',
          'star',
          'koi',
          'comet',
        ] as const;
        // The hero island (days 900 and up, for scripts/hero.mjs) has an empty sky.
        const count = day >= 900 ? 0 : day === 6 ? 4 : 140;
        const body: SkyResponse = {
          ok: true,
          day,
          count,
          lanterns: Array.from({ length: count }, (_, i) => ({
            u: `test_${day}_${i}`,
            s: styles[i % styles.length] ?? 'plain',
            a: '',
          })),
        };
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(body));
      });
      // The Island Builder, with the real check and test proof on an in-memory store. The local
      // player is signed in as "you". ?signedout=1 on the page is not modelled here.
      // The local player is signed in. The check is the server's own; the test proof is kept here.
      let builderDraft: unknown = null;
      let builderTutorial = false;
      /** Islands published locally, served as community islands. */
      const localIslands: {
        index: number;
        draft: IslandDraft;
        par: number;
        label: DifficultyLabel;
        inventory: { mirrors: number; prisms: number };
        creatorPieces: number;
      }[] = [];
      let builderChecked: {
        key: string;
        par: number;
        label: string;
        inventory: { mirrors: number; prisms: number };
        tested: number | null;
      } | null = null;
      const send = (
        response: import('node:http').ServerResponse,
        body: unknown
      ): void => {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(body));
      };
      server.middlewares.use('/api/builder/draft', (request, response) => {
        if (request.method === 'PUT') {
          void readBody(request).then((body) => {
            const draft = readDraft(body['draft']);
            if (draft !== null) builderDraft = draft;
            send(response, { ok: draft !== null });
          });
          return;
        }
        const draft = readDraft(builderDraft);
        const same =
          draft !== null &&
          builderChecked !== null &&
          checkKey(draft) === builderChecked.key;
        send(response, {
          ok: true,
          loggedIn: true,
          draft,
          status: {
            checked:
              same && builderChecked !== null
                ? {
                    par: builderChecked.par,
                    inventory: builderChecked.inventory,
                    label: builderChecked.label,
                  }
                : null,
            tested:
              same && builderChecked?.tested != null
                ? { pieces: builderChecked.tested }
                : null,
          },
          tutorialDone: builderTutorial,
        });
      });
      server.middlewares.use('/api/builder/check', (request, response) => {
        void readBody(request).then((body) => {
          const draft = readDraft(body['draft']);
          if (draft === null)
            return send(response, { ok: false, problem: 'malformed' });
          const outcome = checkIsland(draft, {
            daily: dailyHashes(),
            clock: () => performance.now(),
          });
          console.log(
            `[builder] check ${draft.size}x${draft.size}: ${outcome.ok ? `par ${outcome.par}` : outcome.problem}, ${outcome.nodes} nodes, ${Math.round(outcome.ms)} ms`
          );
          if (!outcome.ok)
            return send(response, { ok: false, problem: outcome.problem });
          builderChecked = {
            key: checkKey(draft),
            par: outcome.par,
            label: outcome.label,
            inventory: outcome.inventory,
            tested: null,
          };
          send(response, {
            ok: true,
            par: outcome.par,
            inventory: outcome.inventory,
            difficulty: outcome.difficulty,
            label: outcome.label,
          });
        });
      });
      server.middlewares.use('/api/builder/test-start', (request, response) => {
        void readBody(request).then((body) => {
          const draft = readDraft(body['draft']);
          const ok =
            draft !== null &&
            builderChecked !== null &&
            checkKey(draft) === builderChecked.key;
          if (ok && builderChecked !== null) builderChecked.tested = null;
          send(response, ok ? { ok } : { ok, problem: 'not-checked' });
        });
      });
      server.middlewares.use('/api/builder/test-solve', (request, response) => {
        void readBody(request).then((body) => {
          const draft = readDraft(body['draft']);
          if (
            draft === null ||
            builderChecked === null ||
            checkKey(draft) !== builderChecked.key
          )
            return send(response, { ok: false, problem: 'changed' });
          const puzzle = puzzleFromText(
            draftPuzzleText(draft, builderChecked.inventory)
          );
          const check = validatePlacements(puzzle, body['placements']);
          if (!check.ok)
            return send(response, { ok: false, problem: 'bad-pieces' });
          if (!trace(puzzle, check.placements).solved)
            return send(response, { ok: false, problem: 'not-lit' });
          builderChecked.tested = check.placements.length;
          send(response, { ok: true, pieces: check.placements.length, ms: 0 });
        });
      });
      // Publishing, locally: the island joins a list served as a community island at
      // /game.html?day=<COMMUNITY.numberBase + k>; `?user=name` plays it as someone else.
      const tokens = new Map<string, unknown>();
      server.middlewares.use('/api/builder/publish', (request, response) => {
        void readBody(request).then((body) => {
          const token = String(body['token'] ?? '');
          const earlier = tokens.get(token);
          if (earlier !== undefined) return send(response, earlier);
          const draft = readDraft(body['draft']);
          if (
            draft === null ||
            builderChecked === null ||
            checkKey(draft) !== builderChecked.key
          )
            return send(response, { ok: false, problem: 'not-checked' });
          if (builderChecked.tested === null)
            return send(response, { ok: false, problem: 'not-tested' });
          const name = draft.name.trim();
          if (name !== '' && (nameProblem(name) !== null || nameFiltered(name)))
            return send(response, { ok: false, problem: 'name' });
          const index = localIslands.length + 1;
          const label = builderChecked.label;
          localIslands.push({
            index,
            draft: { ...draft, name: name || fallbackName(draft.biome, index) },
            par: builderChecked.par,
            label:
              label === 'tricky' || label === 'fiendish' ? label : 'gentle',
            inventory: builderChecked.inventory,
            creatorPieces: builderChecked.tested,
          });
          const answer = {
            ok: true,
            postId: `t3_local${index}`,
            permalink: `/r/lumen_game_dev/comments/local${index}/`,
            url: `http://localhost:5199/game.html?day=${COMMUNITY.numberBase + index}`,
          };
          tokens.set(token, answer);
          builderDraft = null;
          builderChecked = null;
          // A real publish takes a moment (check, post, comment): so does this one.
          setTimeout(() => send(response, answer), 700);
        });
      });
      server.middlewares.use('/api/builder/mine', (_request, response) =>
        send(response, {
          ok: true,
          loggedIn: true,
          islands: localIslands
            .map((island) => ({
              name: island.draft.name,
              biome: island.draft.biome,
              rows: island.draft.rows,
              created: island.index,
              plays: island.index === 1 ? 12 : 0,
              parHits: island.index === 1 ? 5 : 0,
              active: true,
              url: `http://localhost:5199/game.html?day=${COMMUNITY.numberBase + island.index}`,
            }))
            .reverse(),
        })
      );
      server.middlewares.use(
        '/api/builder/tutorial-done',
        (_request, response) => {
          builderTutorial = true;
          send(response, { ok: true });
        }
      );
      server.middlewares.use('/api/start', (_request, response) =>
        response.end('{"ok":true}')
      );
      server.middlewares.use('/api/rule-seen', (_request, response) =>
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
                  // Day 6 is the quiet night: its four made-up lanterns, and this one.
                  skyCount: island.day === 6 ? 5 : 141,
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
